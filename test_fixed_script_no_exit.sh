#!/bin/bash
# Test script with fixed URL array format

# set -e

# Configuration with correct array format
SOURCE_URLS=("https://www.youtube.com/watch?v=FIEKXjHgSbs")
OUTPUT_DIR="$HOME/Downloads/test_fixed"
MONTAGE_LENGTH=5
CLIP_DURATION=1
NUM_CLIPS=5
START_CUT=0
END_CUT=10
LAYOUT="cut"
VARIATIONS=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    if ! command -v ffmpeg &> /dev/null; then
        print_error "FFmpeg is not installed"
        exit 1
    fi
    
    if ! command -v yt-dlp &> /dev/null; then
        print_error "yt-dlp is not installed"
        exit 1
    fi
    
    print_success "All dependencies are available"
}

# Create working directory
setup_workspace() {
    WORK_DIR=$(mktemp -d)
    print_status "Created workspace: $WORK_DIR"
    mkdir -p "$OUTPUT_DIR"
}

# Download videos
download_videos() {
    print_status "Downloading videos..."
    
    local index=0
    for url in "${SOURCE_URLS[@]}"; do
        local output_file="$WORK_DIR/source_$index.mp4"
        print_status "Downloading video $((index + 1)): $url"
        
        if [[ "$url" == *"youtube.com"* ]] || [[ "$url" == *"youtu.be"* ]]; then
            local temp_output="$WORK_DIR/source_$index.%(ext)s"
            yt-dlp --no-playlist -f "best[height<=720]" -o "$temp_output" "$url"
            
            local downloaded_file=$(find "$WORK_DIR" -name "source_$index.*" -type f | head -1)
            if [[ -n "$downloaded_file" ]]; then
                mv "$downloaded_file" "$output_file"
            fi
        fi
        
        if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
            print_success "Downloaded video $((index + 1))"
        else
            print_error "Downloaded file is empty or missing: $output_file"
            exit 1
        fi
        
        ((index++))
    done
}

# Extract clips
extract_clips() {
    print_status "Extracting clips..."
    
    local source_file="$WORK_DIR/source_0.mp4"
    local video_duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$source_file" | cut -d. -f1)
    print_status "Video duration: ${video_duration}s"
    
    local max_offset=$((video_duration - END_CUT - CLIP_DURATION))
    if [[ $max_offset -le $START_CUT ]]; then
        max_offset=$((START_CUT + 1))
    fi
    
    local successful_clips=0
    
    for j in $(seq 1 $NUM_CLIPS); do
        local start_time=$((START_CUT + (j - 1) * ((max_offset - START_CUT) / NUM_CLIPS)))
        local output_clip="$WORK_DIR/clip$(printf "%02d" $j).mp4"
        
        print_status "Extracting clip $j at position ${start_time}s"
        
        if ffmpeg -ss $start_time -i "$source_file" -t $CLIP_DURATION -c:v libx264 -pix_fmt yuv420p -an -y "$output_clip"; then
            if [[ -f "$output_clip" ]] && [[ -s "$output_clip" ]]; then
                print_success "Successfully extracted clip $j"
                successful_clips=$((successful_clips + 1))
            fi
        fi
    done
    
    print_status "Successfully extracted $successful_clips out of $NUM_CLIPS clips"
}

# Create montage
create_montage() {
    print_status "Creating montage..."
    
    local output_file="$OUTPUT_DIR/test_v01.mp4"
    local clip_list="$WORK_DIR/clip_list.txt"
    > "$clip_list"
    
    local clip_index=0
    for f in "$WORK_DIR"/clip*.mp4; do
        if [[ -f "$f" ]] && [[ -s "$f" ]]; then
            clip_index=$((clip_index + 1))
            echo "file '$(basename "$f")'" >> "$clip_list"
        fi
    done
    
    if [[ $clip_index -eq 0 ]]; then
        print_error "No valid clips found"
        return 1
    fi
    
    cd "$WORK_DIR"
    if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p "$output_file"; then
        if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
            print_success "Montage created: $output_file"
            cd - > /dev/null
            return 0
        fi
    fi
    
    cd - > /dev/null
    return 1
}

# Main execution
main() {
    echo "========================================="
    echo "         Fixed Montage Test Script       "
    echo "========================================="
    echo ""
    
    check_dependencies
    setup_workspace
    download_videos
    extract_clips
    
    if create_montage; then
        print_success "Test completed successfully!"
    else
        print_error "Test failed"
        exit 1
    fi
    
    rm -rf "$WORK_DIR"
    print_success "Files saved to: $OUTPUT_DIR"
}

main "$@" 