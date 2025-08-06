import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

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

    // Generate unique script name
    const scriptName = `${customFilename}_${Date.now()}.sh`;
    
    // In Vercel environment, we can't write to filesystem, so we'll return the script content directly
    // The client will handle creating and downloading the file

    // Generate the bash script content
    const scriptContent = `#!/bin/bash
# Generated Montage Script
# Created: ${new Date().toLocaleString()}

# set -e  # Exit on any error - temporarily disabled to debug

# Configuration
SOURCE_URLS=(${videoUrls.map((url: string) => `"${url}"`).join(" ")})
OUTPUT_DIR="$HOME/Downloads/${customFilename}"
MONTAGE_LENGTH=${montageLength}
CLIP_DURATION=${interval}
NUM_CLIPS=${Math.floor(montageLength / interval)}
START_CUT=${startCutAt}
END_CUT=${endCutAt}
LAYOUT="${layoutType}"
KEEP_AUDIO=${keepAudio}
LINEAR_MODE=${linearMode}
OUTPUT_WIDTH=${outputWidth}
OUTPUT_HEIGHT=${outputHeight}
CUSTOM_FILENAME="${customFilename}"
ADD_COPYRIGHT_LINE=${addCopyrightLine}
TEXT_OVERLAY="${textOverlay}"
TEXT_FONT="${textFont}"
TEXT_SIZE=${textSize}
TEXT_OUTLINE=${textOutline}
VARIATIONS=${variations}

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
BLUE='\\033[0;34m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

print_status() {
    echo -e "\${BLUE}[INFO]\${NC} \$1"
}

print_success() {
    echo -e "\${GREEN}[SUCCESS]\${NC} \$1"
}

print_error() {
    echo -e "\${RED}[ERROR]\${NC} \$1"
}

print_warning() {
    echo -e "\${YELLOW}[WARNING]\${NC} \$1"
}

# Check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v ffmpeg &> /dev/null; then
        print_error "FFmpeg is not installed. Please install it first:"
        echo "  macOS: brew install ffmpeg"
        echo "  Ubuntu/Debian: sudo apt install ffmpeg"
        echo "  Windows: Download from https://ffmpeg.org/download.html"
        exit 1
    fi
    
    if ! command -v yt-dlp &> /dev/null && ! command -v youtube-dl &> /dev/null; then
        print_warning "yt-dlp not found. Installing..."
        if command -v pip3 &> /dev/null; then
            pip3 install yt-dlp
        elif command -v pip &> /dev/null; then
            pip install yt-dlp
        else
            print_error "pip not found. Please install yt-dlp manually:"
            echo "  pip install yt-dlp"
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

# Download specific clips directly (no full video download)
download_clips() {
    print_status "Downloading specific clips directly..."
    
    local index=0
    for url in \${SOURCE_URLS[@]}; do
        print_status "Processing source \$((index + 1)): \$url"
        
        # Get video duration first (without downloading full video)
        local video_duration=0
        if [[ "\$url" == *"youtube.com"* ]] || [[ "\$url" == *"youtu.be"* ]]; then
            # Get duration from YouTube without downloading
            if command -v yt-dlp &> /dev/null; then
                # Parse duration and convert to seconds, handling leading zeros properly
                local duration_str=\$(yt-dlp --get-duration "\$url" 2>/dev/null || echo "0:00")
                if [[ "\$duration_str" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
                    # HH:MM:SS format
                    local hours=\${BASH_REMATCH[1]#0}  # Remove leading zeros
                    local minutes=\${BASH_REMATCH[2]#0}  # Remove leading zeros
                    local secs=\${BASH_REMATCH[3]#0}     # Remove leading zeros
                    video_duration=\$((hours * 3600 + minutes * 60 + secs))
                elif [[ "\$duration_str" =~ ^([0-9]+):([0-9]+)$ ]]; then
                    # MM:SS format
                    local minutes=\${BASH_REMATCH[1]#0}  # Remove leading zeros
                    local secs=\${BASH_REMATCH[2]#0}     # Remove leading zeros
                    video_duration=\$((minutes * 60 + secs))
                else
                    video_duration=0
                fi
            else
                # Parse duration and convert to seconds, handling leading zeros properly
                local duration_str=\$(youtube-dl --get-duration "\$url" 2>/dev/null || echo "0:00")
                if [[ "\$duration_str" =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
                    # HH:MM:SS format
                    local hours=\${BASH_REMATCH[1]#0}  # Remove leading zeros
                    local minutes=\${BASH_REMATCH[2]#0}  # Remove leading zeros
                    local secs=\${BASH_REMATCH[3]#0}     # Remove leading zeros
                    video_duration=\$((hours * 3600 + minutes * 60 + secs))
                elif [[ "\$duration_str" =~ ^([0-9]+):([0-9]+)$ ]]; then
                    # MM:SS format
                    local minutes=\${BASH_REMATCH[1]#0}  # Remove leading zeros
                    local secs=\${BASH_REMATCH[2]#0}     # Remove leading zeros
                    video_duration=\$((minutes * 60 + secs))
                else
                    video_duration=0
                fi
            fi
        else
            # For other sources, we'll need to download a small sample to get duration
            local temp_file="\$WORK_DIR/temp_duration.mp4"
            if [[ "\$url" == *"dropbox.com"* ]]; then
                # Convert Dropbox URL
                local direct_url="\$url"
                if [[ "\$url" == *"&dl=0"* ]]; then
                    direct_url=\$(echo "\$url" | sed 's/&dl=0/&raw=1/g')
                elif [[ "\$url" == *"?dl=0"* ]]; then
                    direct_url=\$(echo "\$url" | sed 's/?dl=0/?raw=1/g')
                fi
                curl -L -f "\$direct_url" -o "\$temp_file" -r 0-1048576 2>/dev/null || true
            else
                curl -L -f "\$url" -o "\$temp_file" -r 0-1048576 2>/dev/null || true
            fi
            if [[ -f "\$temp_file" ]]; then
                # Get duration from ffprobe and ensure it's a valid integer
                local duration_raw=\$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "\$temp_file" 2>/dev/null || echo "0")
                # Convert to integer seconds, handling decimal values
                video_duration=\$(printf "%.0f" "\$duration_raw" 2>/dev/null || echo "0")
                rm -f "\$temp_file"
            fi
        fi
        
        if [[ "\$video_duration" -eq 0 ]]; then
            print_warning "Could not determine video duration, using default 60 seconds"
            video_duration=60
        fi
        
        print_status "Video duration: \${video_duration}s"
        
        # Calculate usable range
        local max_offset=\$((video_duration - END_CUT - CLIP_DURATION))
        if [[ \$max_offset -le \$START_CUT ]]; then
            max_offset=\$((START_CUT + 1))
            print_warning "Video may be too short for selected parameters"
        fi
        
        # Download clips directly for each variation
        for variation in \$(seq 1 \$VARIATIONS); do
            print_status "Downloading clips for variation \$variation..."
            
            # Set random seed for this variation
            RANDOM=\$((variation * 12345))
            
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
                
                local output_clip="\$WORK_DIR/clip_v\${variation}_\$(printf "%02d" \$j).mp4"
                
                print_status "Downloading clip \$j for variation \$variation at position \${start_time}s"
                
                # Download specific clip directly
                if [[ "\$url" == *"youtube.com"* ]] || [[ "\$url" == *"youtu.be"* ]]; then
                    # YouTube - download specific time range
                    if command -v yt-dlp &> /dev/null; then
                        if yt-dlp --download-sections "*\${start_time}-\$((start_time + CLIP_DURATION))" -f "best[height<=720]" -o "\$output_clip" "\$url" > /dev/null 2>&1; then
                            print_success "Downloaded YouTube clip \$j for variation \$variation"
                        else
                            print_error "Failed to download YouTube clip \$j for variation \$variation"
                        fi
                    else
                        if youtube-dl --download-sections "*\${start_time}-\$((start_time + CLIP_DURATION))" -f "best[height<=720]" -o "\$output_clip" "\$url" > /dev/null 2>&1; then
                            print_success "Downloaded YouTube clip \$j for variation \$variation"
                        else
                            print_error "Failed to download YouTube clip \$j for variation \$variation"
                        fi
                    fi
                else
                    # Other sources - use ffmpeg to extract clip
                    local temp_source="\$WORK_DIR/temp_source_\$index.mp4"
                    
                    # Download small portion around the clip time
                    local download_start=\$((start_time - 5))
                    if [[ \$download_start -lt 0 ]]; then download_start=0; fi
                    local download_duration=\$((CLIP_DURATION + 10))
                    
                    if [[ "\$url" == *"dropbox.com"* ]]; then
                        # Convert Dropbox URL
                        local direct_url="\$url"
                        if [[ "\$url" == *"&dl=0"* ]]; then
                            direct_url=\$(echo "\$url" | sed 's/&dl=0/&raw=1/g')
                        elif [[ "\$url" == *"?dl=0"* ]]; then
                            direct_url=\$(echo "\$url" | sed 's/?dl=0/?raw=1/g')
                        fi
                        curl -L -f "\$direct_url" -o "\$temp_source" -r \$((download_start * 1024))-\$(((download_start + download_duration) * 1024)) 2>/dev/null || true
                    else
                        curl -L -f "\$url" -o "\$temp_source" -r \$((download_start * 1024))-\$(((download_start + download_duration) * 1024)) 2>/dev/null || true
                    fi
                    
                    if [[ -f "\$temp_source" ]] && [[ -s "\$temp_source" ]]; then
                        # Extract the specific clip
                        if ffmpeg -ss 5 -i "\$temp_source" -t \$CLIP_DURATION -c:v libx264 -pix_fmt yuv420p -an -y "\$output_clip" > /dev/null 2>&1; then
                            print_success "Downloaded clip \$j for variation \$variation"
                        else
                            print_error "Failed to extract clip \$j for variation \$variation"
                        fi
                        rm -f "\$temp_source"
                    else
                        print_error "Failed to download source portion for clip \$j"
                    fi
                fi
                
                # Verify clip was created
                if [[ -f "\$output_clip" ]] && [[ -s "\$output_clip" ]]; then
                    local clip_size=\$(stat -f%z "\$output_clip" 2>/dev/null || stat -c%s "\$output_clip" 2>/dev/null || echo "0")
                    print_success "Clip \$j for variation \$variation ready (\${clip_size} bytes)"
                else
                    print_error "Clip \$j for variation \$variation is empty or missing"
                fi
            done
        done
        
        ((index++))
    done
}

# Create montage (FIXED VERSION with proper text positioning)
create_montage() {
    print_status "Creating montage..."
    
    local output_file="\$OUTPUT_DIR/\${CUSTOM_FILENAME}_v\$(printf "%02d" \$1).mp4"
    
    if [[ "\$LAYOUT" == "cut" ]]; then
        print_status "Creating cut montage..."
        
        # Create clip list for ffmpeg
        local clip_list="\$WORK_DIR/clip_list.txt"
        print_status "Creating clip list..."
        > "\$clip_list"
        
        # Find clips for this specific variation
        local clip_index=0
        for f in "\$WORK_DIR"/clip_v\$1_*.mp4; do
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
        
        # Build ffmpeg command with scaling and text overlay
        local ffmpeg_cmd="ffmpeg -f concat -safe 0 -i \"clip_list.txt\""
        
        # Add scaling filter
        ffmpeg_cmd="\${ffmpeg_cmd} -vf \"scale=\${OUTPUT_WIDTH}:\${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad=\${OUTPUT_WIDTH}:\${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2"
        
        # Add text overlay if enabled (simplified for testing)
        if [[ "\$ADD_COPYRIGHT_LINE" == "true" ]] && [[ -n "\$TEXT_OVERLAY" ]]; then
            print_status "Adding text overlay: \$TEXT_OVERLAY"
            # Use a simpler text filter without font file specification
            local text_filter=",drawtext=text='\${TEXT_OVERLAY}':fontsize=\${TEXT_SIZE}:fontcolor=white"
            
            # Add outline if enabled
            if [[ "\$TEXT_OUTLINE" == "true" ]]; then
                text_filter="\${text_filter}:bordercolor=black:borderw=2"
            fi
            
            # Position text (center)
            text_filter="\${text_filter}:x=(w-tw)/2:y=(h-th)/2"
            ffmpeg_cmd="\${ffmpeg_cmd}\${text_filter}"
        fi
        
        ffmpeg_cmd="\${ffmpeg_cmd}\" -c:v libx264 -pix_fmt yuv420p \"\$output_file\""
        
        # Create the montage
        print_status "Creating montage variation \$1..."
        print_status "Target resolution: \${OUTPUT_WIDTH}x\${OUTPUT_HEIGHT}"
        cd "\$WORK_DIR"
        
        if eval "\$ffmpeg_cmd"; then
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
        local clip_count=\$(find "\$WORK_DIR" -name "clip_v\$1_*.mp4" -type f | wc -l)
        if [[ "\$clip_count" -eq 0 ]]; then
            print_error "No clips found for variation \$1. Skipping stacked montage."
            return 1
        fi
        
        print_status "Found \$clip_count clips to include in stacked montage for variation \$1"
        
        # Create a list of clips for this variation
        local clips=(\$(find "\$WORK_DIR" -name "clip_v\$1_*.mp4" -type f | sort))
        
        # Use configured output dimensions instead of source dimensions
        local source_width=\$OUTPUT_WIDTH
        local source_height=\$OUTPUT_HEIGHT
        
        print_status "Using dimensions: \${source_width}x\${source_height}"
        
        # Build input files array
        local input_files=()
        for clip in "\${clips[@]}"; do
            input_files+=(-i "\$clip")
        done
        
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
        
        # Add text overlay if enabled (simplified for testing)
        if [[ "\$ADD_COPYRIGHT_LINE" == "true" ]] && [[ -n "\$TEXT_OVERLAY" ]]; then
            print_status "Adding text overlay to stacked montage: \$TEXT_OVERLAY"
            # Use a simpler text filter without font file specification
            local text_filter="drawtext=text='\${TEXT_OVERLAY}':fontsize=\${TEXT_SIZE}:fontcolor=white"
            
            # Add outline if enabled
            if [[ "\$TEXT_OUTLINE" == "true" ]]; then
                text_filter="\${text_filter}:bordercolor=black:borderw=2"
            fi
            
            # Position text (center)
            text_filter="\${text_filter}:x=(w-tw)/2:y=(h-th)/2"
            filter="\${filter}[\${last_output}]\${text_filter}[final];"
            last_output="final"
        fi
        
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
    download_clips
    
    # Generate variations (clips already downloaded for each variation)
    for i in \$(seq 1 \$VARIATIONS); do
        echo ""
        print_status "🎬 Creating variation \$i of \$VARIATIONS..."
        
        # Debug: Check what clips are available
        print_status "Checking available clips for variation \$i..."
        local clip_count=\$(find "\$WORK_DIR" -name "clip_v\${i}_*.mp4" -type f | wc -l)
        print_status "Found \$clip_count clips for variation \$i"
        
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
    
    # Open output directory
    if command -v open &> /dev/null; then
        open "\$OUTPUT_DIR"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "\$OUTPUT_DIR"
    fi
}

# Run main function
main "\$@"
`;

    // Return the script content directly for client-side download
    return NextResponse.json({ 
      success: true, 
      scriptName,
      scriptContent,
      message: "Montage script generated successfully. Download and run it to create your montage."
    });

  } catch (err) {
    console.error("Error in generate-montage:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 