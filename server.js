const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Job storage (in production, use Redis or database)
const jobs = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Montage Maker Backend is running'
  });
});

// Generate montage (ACTUAL IMPLEMENTATION)
app.post('/api/generate-montage', async (req, res) => {
  try {
    const { 
      videoUrls, 
      montageType, 
      layoutType, 
      interval, 
      montageLength, 
      startCutAt, 
      endCutAt, 
      resolution, 
      variations,
      customFilename,
      keepAudio,
      linearMode,
      addCopyrightLine,
      textOverlay,
      textFont,
      textSize,
      textOutline
    } = req.body;
    
    if (!videoUrls || videoUrls.length === 0) {
      return res.status(400).json({ error: 'At least one video URL is required' });
    }
    
    const jobId = uuidv4();
    const job = {
      id: jobId,
      type: 'montage',
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      data: { 
        videoUrls, 
        montageType, 
        layoutType, 
        interval, 
        montageLength, 
        startCutAt, 
        endCutAt, 
        resolution, 
        variations,
        customFilename,
        keepAudio,
        linearMode,
        addCopyrightLine,
        textOverlay,
        textFont,
        textSize,
        textOutline
      }
    };
    
    jobs.set(jobId, job);
    
    // Start actual montage generation
    generateMontage(jobId, job.data);
    
    res.json({ jobId, status: 'queued' });
  } catch (error) {
    console.error('Error in generate-montage:', error);
    res.status(500).json({ error: 'Failed to start montage generation' });
  }
});

// Actual montage generation function
async function generateMontage(jobId, data) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Update job status
    job.status = 'processing';
    job.progress = 10;
    jobs.set(jobId, job);

    // Create output directory
    const outputDir = path.join(process.cwd(), 'outputs', jobId);
    fs.mkdirSync(outputDir, { recursive: true });

    // Generate the script content (using the corrected logic)
    const scriptContent = generateScriptContent(data, outputDir);
    
    // Write script to file
    const scriptPath = path.join(outputDir, 'montage_script.sh');
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    
    // Make script executable
    fs.chmodSync(scriptPath, '755');

    job.progress = 30;
    jobs.set(jobId, job);

    // Execute the script
    exec(`bash "${scriptPath}"`, { cwd: outputDir }, (error, stdout, stderr) => {
      if (error) {
        console.error('Script execution error:', error);
        job.status = 'failed';
        job.error = error.message;
        job.progress = 100;
        jobs.set(jobId, job);
        return;
      }

      if (stderr) {
        console.log('Script stderr:', stderr);
      }

      console.log('Script stdout:', stdout);

      // Check if output files were created
      const outputFiles = fs.readdirSync(outputDir).filter(file => file.endsWith('.mp4'));
      
      if (outputFiles.length > 0) {
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date();
        job.outputFiles = outputFiles.map(file => `/api/download/${jobId}/${file}`);
        jobs.set(jobId, job);
      } else {
        job.status = 'failed';
        job.error = 'No output files were generated';
        job.progress = 100;
        jobs.set(jobId, job);
      }
    });

  } catch (error) {
    console.error('Error in generateMontage:', error);
    job.status = 'failed';
    job.error = error.message;
    job.progress = 100;
    jobs.set(jobId, job);
  }
}

// Generate script content (using the corrected logic from the frontend)
function generateScriptContent(data, outputDir) {
  const {
    videoUrls,
    montageType,
    layoutType,
    interval,
    montageLength,
    startCutAt,
    endCutAt,
    resolution,
    variations,
    customFilename,
    keepAudio,
    linearMode,
    addCopyrightLine,
    textOverlay,
    textFont,
    textSize,
    textOutline
  } = data;

  // Get resolution dimensions
  const getResolutionDimensions = () => {
    switch (resolution) {
      case "1080p":
        return { width: 1920, height: 1080, label: "1920x1080" }
      case "720p":
        return { width: 1280, height: 720, label: "1280x720" }
      case "480p":
        return { width: 854, height: 480, label: "854x480" }
      default:
        return { width: 1920, height: 1080, label: "Original Resolution" }
    }
  };

  const { width, height } = getResolutionDimensions();
  const clipDuration = montageType === "fixed" ? Number.parseFloat(interval) : 60 / Number.parseInt(interval);
  const numClips = Math.ceil(Number.parseInt(montageLength) / clipDuration);

  // Clean video URLs
  const cleanVideoUrls = videoUrls
    .filter((url) => url.trim())
    .map((url) => {
      const trimmedUrl = url.trim();
      if (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')) {
        try {
          const urlObj = new URL(trimmedUrl);
          const videoId = urlObj.searchParams.get('v');
          if (videoId) {
            return `"https://www.youtube.com/watch?v=${videoId}"`
          }
        } catch (e) {
          return `"${trimmedUrl}"`
        }
      }
      return `"${trimmedUrl}"`
    });

  return `#!/bin/bash
# Generated Montage Script
# Created: ${new Date().toLocaleString()}

set -e  # Exit on any error

# Configuration
SOURCE_URLS=(${cleanVideoUrls.join(" ")})
OUTPUT_DIR="${outputDir}"
MONTAGE_LENGTH=${montageLength}
CLIP_DURATION=${clipDuration}
NUM_CLIPS=${numClips}
START_CUT=${startCutAt}
END_CUT=${endCutAt}
LAYOUT="${layoutType}"
KEEP_AUDIO=${keepAudio ? "true" : "false"}
LINEAR_MODE=${linearMode ? "true" : "false"}
OUTPUT_WIDTH=${width}
OUTPUT_HEIGHT=${height}
CUSTOM_FILENAME="${customFilename || 'montage'}"
ADD_COPYRIGHT_LINE=${addCopyrightLine ? "true" : "false"}
TEXT_OVERLAY="${textOverlay || ''}"
TEXT_FONT="${textFont || 'Arial'}"
TEXT_SIZE=${textSize || 48}
TEXT_OUTLINE=${textOutline ? "true" : "false"}
VARIATIONS=${variations || 1}

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

print_status() {
    echo -e "\${BLUE}[INFO]\${NC} $1"
}

print_success() {
    echo -e "\${GREEN}[SUCCESS]\${NC} $1"
}

print_error() {
    echo -e "\${RED}[ERROR]\${NC} $1"
}

print_warning() {
    echo -e "\${YELLOW}[WARNING]\${NC} $1"
}

# Check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v ffmpeg &> /dev/null; then
        print_error "FFmpeg is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v yt-dlp &> /dev/null && ! command -v youtube-dl &> /dev/null; then
        print_warning "yt-dlp not found. Installing..."
        if command -v pip3 &> /dev/null; then
            pip3 install yt-dlp
        elif command -v pip &> /dev/null; then
            pip install yt-dlp
        else
            print_error "pip not found. Please install yt-dlp manually."
            exit 1
        fi
    fi
    
    print_success "All dependencies are available"
}

# Create working directory
setup_workspace() {
    WORK_DIR=\$(mktemp -d)
    print_status "Created workspace: \$WORK_DIR"
    
    # Create output directory
    mkdir -p "\$OUTPUT_DIR"
}

# Download videos
download_videos() {
    print_status "Downloading videos..."
    
    local index=0
    for url in "\${SOURCE_URLS[@]}"; do
        local output_file="\$WORK_DIR/source_\$index.mp4"
        print_status "Downloading video \$((index + 1)): \$url"
        
        if [[ "\$url" == *"youtube.com"* ]] || [[ "\$url" == *"youtu.be"* ]]; then
            # YouTube video
            local temp_output="\$WORK_DIR/source_\$index.%(ext)s"
            if command -v yt-dlp &> /dev/null; then
                yt-dlp --no-playlist -f "best[height<=720]" -o "\$temp_output" "\$url"
            else
                youtube-dl --no-playlist -f "best[height<=720]" -o "\$temp_output" "\$url"
            fi
            
            # Find the actual downloaded file and rename it
            local downloaded_file=\$(find "\$WORK_DIR" -name "source_\$index.*" -type f | head -1)
            if [[ -n "\$downloaded_file" ]]; then
                mv "\$downloaded_file" "\$output_file"
            fi
            
        else
            # Direct video URL or other services
            print_status "Downloading as direct URL"
            
            # Try with curl first
            if curl -L -f "\$url" -o "\$output_file"; then
                print_success "Downloaded via direct URL"
            else
                print_warning "Direct download failed, trying with yt-dlp..."
                # Try with yt-dlp as fallback
                local temp_output="\$WORK_DIR/source_\$index.%(ext)s"
                if command -v yt-dlp &> /dev/null; then
                    if yt-dlp --no-playlist -f "best[height<=720]" -o "\$temp_output" "\$url"; then
                        local downloaded_file=\$(find "\$WORK_DIR" -name "source_\$index.*" -type f | head -1)
                        if [[ -n "\$downloaded_file" ]]; then
                            mv "\$downloaded_file" "\$output_file"
                            print_success "Downloaded via yt-dlp"
                        fi
                    else
                        print_error "Failed to download video \$((index + 1))"
                        exit 1
                    fi
                else
                    print_error "Failed to download video \$((index + 1))"
                    exit 1
                fi
            fi
        fi
        
        # Verify the file was downloaded and has content
        if [[ -f "\$output_file" ]] && [[ -s "\$output_file" ]]; then
            print_success "Downloaded video \$((index + 1))"
        else
            print_error "Downloaded file is empty or missing: \$output_file"
            exit 1
        fi
        
        ((index++))
    done
}

# Extract clips from videos (FIXED VERSION based on GAWX script)
extract_clips() {
    print_status "Extracting clips..."
    
    # Get video duration from first source
    local source_file="\$WORK_DIR/source_0.mp4"
    if [[ ! -f "\$source_file" ]]; then
        print_error "Source file not found: \$source_file"
        exit 1
    fi
    
    local video_duration=\$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "\$source_file" | cut -d. -f1)
    print_status "Video duration: \${video_duration}s"
    
    # Calculate usable range
    local max_offset=\$((video_duration - END_CUT - CLIP_DURATION))
    if [[ \$max_offset -le \$START_CUT ]]; then
        max_offset=\$((START_CUT + 1))
        print_warning "Video may be too short for selected parameters"
    fi
    
    local successful_clips=0
    
    for j in \$(seq 1 \$NUM_CLIPS); do
        # Calculate start time
        local start_time
        if [[ "\$LINEAR_MODE" == "true" ]]; then
            # Linear mode: distribute clips evenly
            local usable_duration=\$((max_offset - START_CUT))
            local segment_size=\$((usable_duration / NUM_CLIPS))
            start_time=\$((START_CUT + (j - 1) * segment_size))
        else
            # Random mode: random position within usable range
            local range=\$((max_offset - START_CUT))
            start_time=\$((START_CUT + RANDOM % range))
        fi
        
        # Ensure we don't go past the end
        if [[ \$((start_time + CLIP_DURATION)) -gt \$((video_duration - END_CUT)) ]]; then
            start_time=\$((video_duration - END_CUT - CLIP_DURATION))
        fi
        
        local output_clip="\$WORK_DIR/clip\$(printf "%02d" \$j).mp4"
        
        print_status "Extracting clip \$j at position \${start_time}s"
        
        # Extract clip (simplified, no scaling for now)
        if ffmpeg -ss \$start_time -i "\$source_file" -t \$CLIP_DURATION -c:v libx264 -pix_fmt yuv420p -an -y "\$output_clip" < /dev/null 2>/dev/null; then
            print_success "Successfully extracted clip \$j"
            successful_clips=\$((successful_clips + 1))
        else
            print_error "Failed to create clip \$j — skipping..."
        fi
    done
    
    print_status "Successfully extracted \$successful_clips out of \$NUM_CLIPS clips"
    
    if [[ \$successful_clips -eq 0 ]]; then
        print_error "No clips were successfully extracted. Exiting..."
        exit 1
    fi
}

# Create montage (FIXED VERSION based on GAWX script)
create_montage() {
    print_status "Creating montage..."
    
    local output_file="\$OUTPUT_DIR/\${CUSTOM_FILENAME}_v\$(printf "%02d" \$1).mp4"
    
    if [[ "\$LAYOUT" == "cut" ]]; then
        print_status "Creating cut montage..."
        
        # Create clip list for ffmpeg
        local clip_list="\$WORK_DIR/clip_list.txt"
        print_status "Creating clip list..."
        > "\$clip_list"
        
        # Find all mp4 files in the temp directory and add them to the clip list
        local clip_index=0
        for f in "\$WORK_DIR"/clip*.mp4; do
            if [[ -f "\$f" ]] && [[ -s "\$f" ]]; then  # Check if file exists and is not empty
                clip_index=\$((clip_index + 1))
                echo "file '\$(basename "\$f")'" >> "\$clip_list"
                print_status "✓ Including clip: \$(basename "\$f")"
            fi
        done
        
        print_status "Added \$clip_index clips to the list"
        
        # Check if we have clips in the list
        if [[ \$clip_index -eq 0 ]]; then
            print_error "No valid clips found for concatenation. Skipping..."
            return 1
        fi
        
        # Check if clip list exists and is not empty
        if [[ ! -s "\$clip_list" ]]; then
            print_error "Clip list file missing or empty. Skipping..."
            return 1
        fi
        
        # Create the montage
        print_status "Creating montage variation \$1..."
        cd "\$WORK_DIR"
        if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p "\$output_file"; then
            # Wait a moment to ensure file is written
            sleep 1
            
            # Check if output file exists and has size
            if [[ -f "\$output_file" ]] && [[ -s "\$output_file" ]]; then
                print_success "Montage created: \$output_file"
                print_success "Duration: \${MONTAGE_LENGTH}s, Interval: \${CLIP_DURATION}s, Clips: \${clip_index}"
                cd - > /dev/null
                return 0
            else
                cd - > /dev/null
                print_error "Output file not found or empty"
                return 1
            fi
        else
            cd - > /dev/null
            print_error "Failed to create montage for variation \$1"
            return 1
        fi
        
    else
        print_status "Creating stacked montage..."
        
        # Check if we have any clips to work with
        local clip_count=\$(find "\$WORK_DIR" -name "clip*.mp4" -type f | wc -l)
        if [[ "\$clip_count" -eq 0 ]]; then
            print_error "No clips found in temp directory. Skipping stacked montage."
            return 1
        fi
        
        print_status "Found \$clip_count clips to include in stacked montage"
        
        # Create a list of all clips
        local clips=(\$(find "\$WORK_DIR" -name "clip*.mp4" -type f | sort))
        
        # Build input files array
        local input_files=()
        for clip in "\${clips[@]}"; do
            input_files+=(-i "\$clip")
        done
        
        # Get source video dimensions
        local source_width=\$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "\$WORK_DIR/source_0.mp4")
        local source_height=\$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=noprint_wrappers=1:nokey=1 "\$WORK_DIR/source_0.mp4")
        
        # Create a filter complex for the stacked layout
        local filter="color=s=\${source_width}x\${source_height}:d=\${MONTAGE_LENGTH}:c=black[bg];"
        local last_output="bg"
        
        # Process clips in REVERSE order so newer clips appear on top
        for i in \$(seq \$((\${#clips[@]} - 1)) -1 0); do
            # Calculate appearance time (first clip at 0, others 1 second apart)
            local clip_index=\$((\${#clips[@]} - 1 - i))
            if [[ \$clip_index -eq 0 ]]; then
                local appear_time=0
                local scale_factor=1.0
            else
                local appear_time=\$clip_index
                # Calculate scale factor based on the clip index
                local scale_factor=1.0
                for j in \$(seq 1 \$clip_index); do
                    scale_factor=\$(echo "scale=2; \$scale_factor * 0.75" | bc)
                done
            fi
          
            # Calculate scaled dimensions
            local scaled_width=\$(echo "\$source_width * \$scale_factor" | bc | awk '{printf "%d", \$0}')
            local scaled_height=\$(echo "\$source_height * \$scale_factor" | bc | awk '{printf "%d", \$0}')
            
            # For clips after the first, calculate position
            if [[ \$clip_index -gt 0 ]]; then
                # Calculate maximum position to ensure clip is within bounds
                local max_x=\$(( source_width - scaled_width ))
                local max_y=\$(( source_height - scaled_height ))
                
                # Ensure max_x and max_y are at least 0
                if [[ \$max_x -lt 0 ]]; then max_x=0; fi
                if [[ \$max_y -lt 0 ]]; then max_y=0; fi
                
                # Generate position (random or centered)
                local x=\$(( RANDOM % (max_x + 1) ))
                local y=\$(( RANDOM % (max_y + 1) ))
            else
                # First clip is centered and full size
                local x=0
                local y=0
            fi
            
            # Add to filter complex
            filter="\${filter}[\$i:v]setpts=PTS-STARTPTS+\${appear_time}/TB,scale=\${scaled_width}:\${scaled_height}[v\$i];"
            filter="\${filter}[\$last_output][v\$i]overlay=\${x}:\${y}[out\$i];"
            last_output="out\$i"
        done
        
        # Execute the ffmpeg command
        if ffmpeg "\${input_files[@]}" -filter_complex "\${filter}" -map "[\${last_output}]" -c:v libx264 -preset fast -pix_fmt yuv420p -t "\${MONTAGE_LENGTH}" "\${output_file}"; then
            print_success "Stacked montage created: \$output_file"
            print_success "Duration: \${MONTAGE_LENGTH}s, Clips: \${#clips[@]}"
            return 0
        else
            print_error "Failed to create stacked montage"
            return 1
        fi
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "         Montage Generator Script        "
    echo "========================================="
    echo ""
    
    check_dependencies
    setup_workspace
    download_videos
    extract_clips
    
    # Generate variations
    for i in \$(seq 1 \$VARIATIONS); do
        echo ""
        print_status "🎬 Creating variation \$i of \$VARIATIONS..."
        
        if create_montage \$i; then
            print_success "Variation \$i completed successfully"
        else
            print_error "Variation \$i failed"
        fi
    done
    
    # Clean up temp directory
    rm -rf "\$WORK_DIR"
    
    print_success "Montage generation complete!"
    print_success "Files saved to: \$OUTPUT_DIR"
}

# Run main function
main "$@"
`;
}

// Generate reaction video (simplified for now)
app.post('/api/generate-reaction', async (req, res) => {
  try {
    const { videoUrl, splitInterval } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }
    
    const jobId = uuidv4();
    const job = {
      id: jobId,
      type: 'reaction',
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      data: { videoUrl, splitInterval }
    };
    
    jobs.set(jobId, job);
    
    // Simulate processing (for now)
    setTimeout(() => {
      job.status = 'processing';
      job.progress = 50;
      jobs.set(jobId, job);
      
      setTimeout(() => {
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date();
        jobs.set(jobId, job);
      }, 2000);
    }, 1000);
    
    res.json({ jobId, status: 'queued' });
  } catch (error) {
    console.error('Error in generate-reaction:', error);
    res.status(500).json({ error: 'Failed to start reaction generation' });
  }
});

// Get job status
app.get('/api/job-status', (req, res) => {
  const { jobId } = req.query;
  const job = jobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

// Download generated video
app.get('/api/download/:jobId/:filename', async (req, res) => {
  try {
    const { jobId, filename } = req.params;
    const job = jobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Job not completed yet' });
    }
    
    const filePath = path.join(process.cwd(), 'outputs', jobId, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath);
  } catch (error) {
    console.error('Error in download:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Montage Maker Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      generateMontage: '/api/generate-montage',
      generateReaction: '/api/generate-reaction',
      jobStatus: '/api/job-status/:jobId',
      download: '/api/download/:jobId'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}); 