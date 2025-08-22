import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob } from "@/lib/jobs";
import { downloadVideo, uploadToBlob, getVideoDuration } from "@/lib/ffmpeg-utils";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      videoUrls, 
      montageType = "fixed",
      layoutType = "cut",
      useRandomPositions = false,
      interval = 1,
      bpm = 120,
      montageLength = 30,
      keepAudio = true,
      resolution = "720p",
      linearMode = true,
      customFilename = "montage",
      startCutAt = 0,
      endCutAt = 60,
      variations = 1,
      addCopyrightLine = true,
      textOverlay = "",
      textFont = "Arial",
      textSize = 24,
      textColor = "white",
      textOutline = true
    } = body;

    if (!videoUrls || !videoUrls[0]) {
      return NextResponse.json({ error: "No video URL provided" }, { status: 400 });
    }

    // Parse resolution
    let outputWidth = 1920;
    let outputHeight = 1080;
    if (resolution === "720p") {
      outputWidth = 1280;
      outputHeight = 720;
    } else if (resolution === "480p") {
      outputWidth = 854;
      outputHeight = 480;
    }

    // Create a job for tracking progress
    const job = createJob({
      videoUrls,
      montageType,
      layoutType,
      interval,
      montageLength,
      resolution,
      linearMode,
      customFilename,
      startCutAt,
      endCutAt,
      variations,
      addCopyrightLine,
      textOverlay,
      textSize,
      textColor,
      textOutline,
      outputWidth,
      outputHeight
    });

    // Start processing in the background
    processMontageJob(job.id, job.params);

    return NextResponse.json({ 
      success: true, 
      jobId: job.id,
      message: "Montage generation started. Use the job ID to check progress."
    });

  } catch (err) {
    console.error("Error in generate-montage-cloud:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function processMontageJob(jobId: string, params: any) {
  try {
    const workDir = path.join(os.tmpdir(), `montage-${jobId}`);
    fs.mkdirSync(workDir, { recursive: true });

    updateJob(jobId, { status: 'processing', progress: 5 });

    // Download videos
    const videoFiles: string[] = [];
    console.log(`Starting download of ${params.videoUrls.length} videos`);
    
    for (let i = 0; i < params.videoUrls.length; i++) {
      let url = params.videoUrls[i];
      const videoPath = path.join(workDir, `source_${i}.mp4`);
      
      // Validate and fix YouTube URLs
      if (url && !url.startsWith('http') && url.length > 10) {
        // This might be a YouTube video ID, convert to full URL
        url = `https://www.youtube.com/watch?v=${url}`;
        console.log(`Converted video ID to full URL: ${url}`);
      }
      
      console.log(`Downloading video ${i + 1}/${params.videoUrls.length}: ${url}`);
      updateJob(jobId, { progress: 10 + (i * 10) });
      
      try {
        // Download video (including YouTube URLs)
        await downloadVideo(url, videoPath);
        videoFiles.push(videoPath);
        console.log(`Successfully downloaded video ${i}: ${url}`);
      } catch (error) {
        console.error(`Failed to download video ${i}:`, error);
        // Continue with other videos
      }
    }

    if (videoFiles.length === 0) {
      // Try to provide more helpful error messages
      const failedUrls = params.videoUrls.filter((_: string, index: number) => !videoFiles[index])
      const errorMessage = failedUrls.length > 0 
        ? `Failed to download videos: ${failedUrls.join(', ')}. This might be due to region restrictions, age restrictions, or YouTube's anti-bot measures. Please try different videos or contact support if the issue persists.`
        : "No videos were successfully downloaded. Please check that your video URLs are valid and accessible."
      
      throw new Error(errorMessage);
    }

    console.log(`Successfully downloaded ${videoFiles.length} videos`);
    updateJob(jobId, { progress: 40 });

    // Get actual video duration using ffprobe
    const sourceVideo = videoFiles[0];
    let videoDuration = 240; // Default fallback
    
    try {
      console.log(`Getting actual video duration for: ${sourceVideo}`);
      const durationResult = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${sourceVideo}"`);
      const durationStr = durationResult.stdout.trim();
      videoDuration = Math.round(parseFloat(durationStr)) || 240;
      console.log(`Detected video duration: ${videoDuration}s`);
      
      // Validate the detected duration
      if (videoDuration <= 0) {
        console.warn(`Invalid video duration detected: ${videoDuration}s, using fallback`);
        videoDuration = 240;
      }
    } catch (error) {
      console.error('Error getting video duration with ffprobe:', error);
      console.log(`Using fallback duration: ${videoDuration}s`);
    }
    
    console.log(`Using video duration: ${videoDuration}s, cutting from ${params.startCutAt}s to ${params.endCutAt}s`);

    // Generate clips for each variation
    const numClips = Math.floor(params.montageLength / params.interval);
    console.log(`Generating ${numClips} clips for ${params.variations} variations, each ${params.interval}s long`);

    for (let variation = 1; variation <= params.variations; variation++) {
      console.log(`Creating variation ${variation}/${params.variations}`);
      const variationClipFiles: string[] = [];
      
      // Calculate clip start times for this variation
      const clipStartTimes: number[] = [];
      
      // Calculate the actual usable duration for clip selection
      // endCutAt represents "seconds from the end" of the video
      // So if video is 840s and endCutAt is 30s, we use 0-810s (stopping 30s from end)
      // If endCutAt is 0 or greater than or equal to video duration, use the full video
      const effectiveEndCutAt = params.endCutAt > 0 && params.endCutAt < videoDuration 
        ? videoDuration - params.endCutAt 
        : videoDuration;
      const usableDuration = Math.max(0, effectiveEndCutAt - params.startCutAt);
      
      console.log(`Video duration: ${videoDuration}s, Start: ${params.startCutAt}s, End Cut At: ${params.endCutAt}s from end, Effective end: ${effectiveEndCutAt}s, Usable duration: ${usableDuration}s`);
      
      // Safety check: ensure we have a valid usable duration
      if (usableDuration <= 0) {
        throw new Error(`Invalid video range: Start at ${params.startCutAt}s, End Cut At ${params.endCutAt}s from end, resulting in ${usableDuration}s usable duration. Please adjust your settings.`);
      }
      
      if (params.linearMode) {
        // Linear mode: spread clips chronologically across the entire duration
        // Each variation uses the full video range but with different starting points
        const segmentSize = usableDuration / numClips;
        
        // Use variation number to create different starting points within the full range
        // This ensures each variation uses the full video but starts from different positions
        const variationStartOffset = ((variation - 1) * segmentSize) % usableDuration;
        
        for (let clipIndex = 0; clipIndex < numClips; clipIndex++) {
          // Calculate segment boundaries using the full video range
          const segmentStart = params.startCutAt + variationStartOffset + (clipIndex * segmentSize);
          const segmentEnd = params.startCutAt + variationStartOffset + ((clipIndex + 1) * segmentSize) - params.interval;
          
          // Ensure we don't go past the end of the video
          const safeSegmentEnd = Math.min(segmentEnd, effectiveEndCutAt - params.interval);
          const safeSegmentStart = Math.min(segmentStart, safeSegmentEnd);
          
          // Add some randomness within each segment, but ensure we have a valid range
          let startTime;
          if (safeSegmentEnd > safeSegmentStart) {
            const randomOffset = Math.random() * (safeSegmentEnd - safeSegmentStart);
            startTime = safeSegmentStart + randomOffset;
          } else {
            // If segment is too small, just use the start
            startTime = safeSegmentStart;
          }
          
          clipStartTimes.push(startTime);
        }
        
        // Sort to ensure chronological order
        clipStartTimes.sort((a, b) => a - b);
        
              // Generate extra clips for linear mode too to account for failures
      const extraClips = Math.ceil(numClips * 2.5); // Generate 2.5x more clips to ensure we get enough valid ones
      while (clipStartTimes.length < extraClips) {
        const randomValue = Math.random();
        const startTime = params.startCutAt + randomValue * (usableDuration - params.interval);
        const validStartTime = Math.max(params.startCutAt, Math.min(startTime, effectiveEndCutAt - params.interval));
        
        // Only add if it's not too close to existing positions
        const tooClose = clipStartTimes.some(existing => Math.abs(existing - validStartTime) < params.interval);
        if (!tooClose) {
          clipStartTimes.push(validStartTime);
        }
      }
      } else {
        // Random mode: completely random positions within the specified range
        // Each variation should have different random selections
        const usedPositions = new Set<number>();
        
        // Use variation number to seed different random selections
        const variationSeed = variation * 1000 + Date.now() % 10000;
        
        // Create a pool of available positions to avoid duplicates
        const availablePositions: number[] = [];
        const stepSize = Math.max(1, Math.floor((usableDuration - params.interval) / (numClips * 2))); // Ensure good spacing
        
        for (let pos = params.startCutAt; pos <= effectiveEndCutAt - params.interval; pos += stepSize) {
          availablePositions.push(pos);
        }
        
        // Shuffle the available positions using variation-specific seed
        for (let i = availablePositions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.abs(Math.sin(variationSeed + i)) * (i + 1));
          [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
        }
        
        // Generate extra clips to account for potential failures
        const extraClips = Math.ceil(numClips * 2.5); // Generate 2.5x more clips to ensure we get enough valid ones
        
        // Take the first extraClips positions
        for (let clipIndex = 0; clipIndex < extraClips && clipIndex < availablePositions.length; clipIndex++) {
          clipStartTimes.push(availablePositions[clipIndex]);
        }
        
        // If we don't have enough positions, add some random ones
        while (clipStartTimes.length < extraClips) {
          const randomValue = Math.abs(Math.sin(variationSeed + clipStartTimes.length * 100)) % 1;
          const startTime = params.startCutAt + randomValue * (usableDuration - params.interval);
          const validStartTime = Math.max(params.startCutAt, Math.min(startTime, effectiveEndCutAt - params.interval));
          
          // Only add if it's not too close to existing positions
          const tooClose = clipStartTimes.some(existing => Math.abs(existing - validStartTime) < params.interval);
          if (!tooClose) {
            clipStartTimes.push(validStartTime);
          }
        }
        
        // For random mode, we don't sort - keep the random order
      }
      
      // Create clips using the calculated start times
      for (let clipIndex = 0; clipIndex < clipStartTimes.length; clipIndex++) {
        const clipPath = path.join(workDir, `clip_v${variation}_${(clipIndex + 1).toString().padStart(2, '0')}.mp4`);
        
        // Update progress during clip generation
        const clipProgress = 40 + (variation - 1) * 20 + (clipIndex / clipStartTimes.length) * 20;
        updateJob(jobId, { progress: Math.floor(clipProgress) });
        
        const startTime = clipStartTimes[clipIndex];
        
        // Ensure start time is valid and within bounds
        const validStartTime = Math.max(params.startCutAt, Math.min(startTime, effectiveEndCutAt - params.interval));
        
        // Additional safety check
        if (validStartTime < 0 || validStartTime + params.interval > videoDuration) {
          console.error(`Invalid clip time: ${validStartTime}s to ${validStartTime + params.interval}s (video duration: ${videoDuration}s)`);
          throw new Error(`Invalid clip time range: ${validStartTime}s to ${validStartTime + params.interval}s`);
        }
        
        console.log(`Clip ${clipIndex + 1}: extracting from ${validStartTime}s to ${validStartTime + params.interval}s`);

        // Extract clip using FFmpeg
        let ffmpegCmd = `ffmpeg -y -ss ${validStartTime} -i "${sourceVideo}" -t ${params.interval}`;
        
        // Handle audio based on keepAudio setting
        if (params.keepAudio) {
          ffmpegCmd += ` -c:v libx264 -c:a aac -pix_fmt yuv420p "${clipPath}"`;
        } else {
          ffmpegCmd += ` -c:v libx264 -an -pix_fmt yuv420p "${clipPath}"`;
        }
        console.log(`Executing FFmpeg command: ${ffmpegCmd}`);
        await execAsync(ffmpegCmd);
        
        // Verify the clip was created and is valid
        if (fs.existsSync(clipPath)) {
          const stats = fs.statSync(clipPath);
          console.log(`Clip ${clipIndex + 1} created successfully: ${clipPath} (${stats.size} bytes)`);
          
          // Only add clips that are reasonably sized (not empty/corrupted)
          if (stats.size > 500) { // Reduced threshold to 500 bytes to be more lenient
            variationClipFiles.push(clipPath);
          } else {
            console.warn(`Clip ${clipIndex + 1} is too small (${stats.size} bytes), skipping...`);
          }
        } else {
          console.error(`Clip ${clipIndex + 1} was not created: ${clipPath}`);
          throw new Error(`Failed to create clip ${clipIndex + 1}`);
        }
      }
      
      // Ensure we have enough valid clips for the montage
      if (variationClipFiles.length === 0) {
        throw new Error(`No valid clips were created for variation ${variation}. Please try with different settings.`);
      }
      
      // If we don't have enough clips to reach the target duration, generate more
      const targetClips = Math.ceil(params.montageLength / params.interval);
      if (variationClipFiles.length < targetClips) {
        console.log(`Need ${targetClips} clips for ${params.montageLength}s montage, but only have ${variationClipFiles.length}. Generating more clips...`);
        
        // Generate additional clips until we have enough
        let attempts = 0;
        const maxAttempts = targetClips * 3; // Try up to 3x the target number
        
        while (variationClipFiles.length < targetClips && attempts < maxAttempts) {
          attempts++;
          
          // Generate a random clip time
          const randomValue = Math.random();
          const startTime = params.startCutAt + randomValue * (usableDuration - params.interval);
          const validStartTime = Math.max(params.startCutAt, Math.min(startTime, effectiveEndCutAt - params.interval));
          
          // Check if this position is too close to existing clips
          const tooClose = variationClipFiles.some((_, index) => {
            const existingTime = clipStartTimes[index];
            return Math.abs(existingTime - validStartTime) < params.interval;
          });
          
          if (!tooClose) {
            const clipIndex = variationClipFiles.length;
            const clipPath = path.join(workDir, `clip_v${variation}_${(clipIndex + 1).toString().padStart(2, '0')}.mp4`);
            
            console.log(`Additional clip ${clipIndex + 1}: extracting from ${validStartTime}s to ${validStartTime + params.interval}s`);
            
            // Extract clip using FFmpeg
            let ffmpegCmd = `ffmpeg -y -ss ${validStartTime} -i "${sourceVideo}" -t ${params.interval}`;
            
            // Handle audio based on keepAudio setting
            if (params.keepAudio) {
              ffmpegCmd += ` -c:v libx264 -c:a aac -pix_fmt yuv420p "${clipPath}"`;
            } else {
              ffmpegCmd += ` -c:v libx264 -an -pix_fmt yuv420p "${clipPath}"`;
            }
            
            try {
              await execAsync(ffmpegCmd);
              
              // Verify the clip was created and is valid
              if (fs.existsSync(clipPath)) {
                const stats = fs.statSync(clipPath);
                console.log(`Additional clip ${clipIndex + 1} created successfully: ${clipPath} (${stats.size} bytes)`);
                
                // Only add clips that are reasonably sized (not empty/corrupted)
                if (stats.size > 500) {
                  variationClipFiles.push(clipPath);
                  clipStartTimes.push(validStartTime);
                } else {
                  console.warn(`Additional clip ${clipIndex + 1} is too small (${stats.size} bytes), skipping...`);
                }
              }
            } catch (error) {
              console.warn(`Failed to create additional clip ${clipIndex + 1}:`, error);
            }
          }
        }
        
        console.log(`Generated ${variationClipFiles.length} total valid clips after additional attempts.`);
      }
      
      console.log(`Creating montage for variation ${variation} with ${variationClipFiles.length} clips...`);
      
      // Calculate actual montage length based on valid clips
      const actualMontageLength = variationClipFiles.length * params.interval;
      console.log(`Actual montage length will be ${actualMontageLength} seconds (${variationClipFiles.length} clips × ${params.interval}s each)`);
      
      // If we still have significantly fewer clips than requested, log a warning
      if (variationClipFiles.length < targetClips * 0.8) {
        console.warn(`Warning: Only ${variationClipFiles.length} valid clips out of ${targetClips} needed for ${params.montageLength}s montage. This may result in a shorter montage.`);
      }
      
      // Create montage for this variation
      const outputPath = path.join(workDir, `${params.customFilename}_v${variation.toString().padStart(2, '0')}.mp4`);
      
      if (params.layoutType === "cut") {
        // Create clip list for concatenation
        const clipListPath = path.join(workDir, `clip_list_v${variation}.txt`);
        let clipListContent = "";
        
        for (const clip of variationClipFiles) {
          clipListContent += `file '${clip}'\n`;
        }
        
        fs.writeFileSync(clipListPath, clipListContent);

        // Build FFmpeg command for cut montage
        let ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${clipListPath}" -vf "scale=${params.outputWidth}:${params.outputHeight}:force_original_aspect_ratio=decrease,pad=${params.outputWidth}:${params.outputHeight}:(ow-iw)/2:(oh-ih)/2`;
        
        // Add text overlay if enabled
        if (params.textOverlay && params.textOverlay.trim() !== "") {
          let textFilter = `,drawtext=text='${params.textOverlay}':fontsize=${params.textSize}:fontcolor=${params.textColor}:x=(w-tw)/2:y=(h-th)/2`;
          
          if (params.textOutline) {
            textFilter = textFilter.replace(`:fontcolor=${params.textColor}`, `:fontcolor=${params.textColor}:bordercolor=black:borderw=2`);
          }
          
          ffmpegCmd += textFilter;
        }
        
        // Handle audio based on keepAudio setting
        if (params.keepAudio) {
          ffmpegCmd += `" -c:v libx264 -c:a aac -pix_fmt yuv420p "${outputPath}"`;
        } else {
          ffmpegCmd += `" -c:v libx264 -an -pix_fmt yuv420p "${outputPath}"`;
        }
        
        console.log(`Creating montage for variation ${variation}...`);
        await execAsync(ffmpegCmd);
        
        // Verify the montage was created
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`Created variation ${variation}: ${outputPath} (${stats.size} bytes)`);
        } else {
          console.error(`Variation ${variation} was not created: ${outputPath}`);
          throw new Error(`Failed to create variation ${variation}`);
        }
      }
    }

    updateJob(jobId, { progress: 80 });

    // Upload all variations to blob storage
    const downloadUrls: string[] = [];
    
    for (let variation = 1; variation <= params.variations; variation++) {
      const outputPath = path.join(workDir, `${params.customFilename}_v${variation.toString().padStart(2, '0')}.mp4`);
      
      if (fs.existsSync(outputPath)) {
        const fileName = `${params.customFilename}_v${variation.toString().padStart(2, '0')}_${Date.now()}.mp4`;
        console.log(`Preparing to upload variation ${variation}: ${outputPath} as ${fileName}`);
        
        const downloadUrl = await uploadToBlob(outputPath, fileName);
        downloadUrls.push(downloadUrl);
        console.log(`Variation ${variation} uploaded successfully, download URL: ${downloadUrl}`);
      }
    }

    // For now, return the first variation's URL (we can enhance this later to return all URLs)
    const primaryDownloadUrl = downloadUrls[0] || '';

    updateJob(jobId, { 
      status: 'completed', 
      progress: 100, 
      downloadUrl: primaryDownloadUrl,
      allDownloadUrls: downloadUrls // Store all URLs for future enhancement
    });
    
    console.log(`Job ${jobId} updated with download URL: ${primaryDownloadUrl}`);

    // Clean up temp files
    fs.rmSync(workDir, { recursive: true, force: true });

  } catch (error) {
    console.error("Error processing montage job:", error);
    updateJob(jobId, { 
      status: 'failed', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}
