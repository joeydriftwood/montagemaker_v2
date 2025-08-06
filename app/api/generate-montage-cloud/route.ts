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
      textOverlay = "montage",
      textFont = "Arial",
      textSize = 24,
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
    for (let i = 0; i < params.videoUrls.length; i++) {
      const url = params.videoUrls[i];
      const videoPath = path.join(workDir, `source_${i}.mp4`);
      
      updateJob(jobId, { progress: 10 + (i * 10) });
      
      try {
        await downloadVideo(url, videoPath);
        videoFiles.push(videoPath);
      } catch (error) {
        console.error(`Failed to download video ${i}:`, error);
        // Continue with other videos
      }
    }

    if (videoFiles.length === 0) {
      throw new Error("No videos were successfully downloaded");
    }

    updateJob(jobId, { progress: 40 });

    // Generate clips for each variation
    const clipFiles: string[] = [];
    const numClips = Math.floor(params.montageLength / params.interval);

    for (let variation = 1; variation <= params.variations; variation++) {
      for (let clipIndex = 1; clipIndex <= numClips; clipIndex++) {
        const sourceVideo = videoFiles[clipIndex % videoFiles.length];
        const sourceUrl = params.videoUrls[clipIndex % params.videoUrls.length];
        const clipPath = path.join(workDir, `clip_v${variation}_${clipIndex.toString().padStart(2, '0')}.mp4`);
        
        // Get video duration
        const videoDuration = await getVideoDuration(sourceUrl);
        
        // Calculate start time
        let startTime = params.startCutAt;
        if (params.linearMode) {
          const usableDuration = videoDuration - params.startCutAt - params.endCutAt;
          const segmentSize = usableDuration / numClips;
          startTime = params.startCutAt + (clipIndex - 1) * segmentSize;
        } else {
          // Random mode
          const range = videoDuration - params.startCutAt - params.endCutAt - params.interval;
          startTime = params.startCutAt + Math.floor(Math.random() * range);
        }

        // Ensure start time is valid
        if (startTime < 0) startTime = 0;
        if (startTime + params.interval > videoDuration) {
          startTime = videoDuration - params.interval;
        }

        // Extract clip using FFmpeg
        const ffmpegCmd = `ffmpeg -y -ss ${startTime} -i "${sourceVideo}" -t ${params.interval} -c:v libx264 -pix_fmt yuv420p "${clipPath}"`;
        await execAsync(ffmpegCmd);
        
        clipFiles.push(clipPath);
      }
    }

    updateJob(jobId, { progress: 60 });

    // Create montage
    const outputPath = path.join(workDir, `${params.customFilename}_v01.mp4`);
    
    if (params.layoutType === "cut") {
      // Create clip list for concatenation
      const clipListPath = path.join(workDir, "clip_list.txt");
      let clipListContent = "";
      
      for (const clip of clipFiles) {
        clipListContent += `file '${clip}'\n`;
      }
      
      fs.writeFileSync(clipListPath, clipListContent);

      // Build FFmpeg command for cut montage
      let ffmpegCmd = `ffmpeg -y -f concat -safe 0 -i "${clipListPath}" -vf "scale=${params.outputWidth}:${params.outputHeight}:force_original_aspect_ratio=decrease,pad=${params.outputWidth}:${params.outputHeight}:(ow-iw)/2:(oh-ih)/2`;
      
      // Add text overlay if enabled
      if (params.addCopyrightLine && params.textOverlay) {
        let textFilter = `,drawtext=text='${params.textOverlay}':fontsize=${params.textSize}:fontcolor=white:x=(w-tw)/2:y=(h-th)/2`;
        
        if (params.textOutline) {
          textFilter = textFilter.replace(':fontcolor=white', ':fontcolor=white:bordercolor=black:borderw=2');
        }
        
        ffmpegCmd += textFilter;
      }
      
      ffmpegCmd += `" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;
      
      await execAsync(ffmpegCmd);
    } else {
      // Stacked montage (simplified version)
      const inputFiles = clipFiles.map(clip => `-i "${clip}"`).join(' ');
      const filterComplex = `color=s=${params.outputWidth}x${params.outputHeight}:d=${params.montageLength}:c=black[bg];[0:v]scale=${params.outputWidth}:${params.outputHeight}[v0];[bg][v0]overlay=0:0[out0]`;
      
      const ffmpegCmd = `ffmpeg -y ${inputFiles} -filter_complex "${filterComplex}" -map "[out0]" -c:v libx264 -pix_fmt yuv420p -t ${params.montageLength} "${outputPath}"`;
      
      await execAsync(ffmpegCmd);
    }

    updateJob(jobId, { progress: 80 });

    // Upload to blob storage
    const fileName = `${params.customFilename}_${Date.now()}.mp4`;
    const downloadUrl = await uploadToBlob(outputPath, fileName);

    updateJob(jobId, { 
      status: 'completed', 
      progress: 100, 
      downloadUrl 
    });

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
