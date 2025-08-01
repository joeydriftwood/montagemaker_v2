#!/bin/bash
# Test Montage Script with Debugging

set -e  # Exit on any error

# Configuration
SOURCE_URLS=("https://www.youtube.com/watch?v=hN5X4kGhAtU")
OUTPUT_DIR="$HOME/Downloads/test_montage"
MONTAGE_LENGTH=10
CLIP_DURATION=1
NUM_CLIPS=10
START_CUT=0
END_CUT=20
LAYOUT="cut"
KEEP_AUDIO=true
LINEAR_MODE=true
OUTPUT_WIDTH=1280
OUTPUT_HEIGHT=720
CUSTOM_FILENAME="test"
ADD_COPYRIGHT_LINE=false
TEXT_OVERLAY=""
TEXT_FONT="Arial"
TEXT_SIZE=48
TEXT_OUTLINE=true
VARIATIONS=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
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
    WORK_DIR=$(mktemp -d)
    print_status "Created workspace: $WORK_DIR"
    
    # Create output directory
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
            # YouTube video
            local temp_output="$WORK_DIR/source_$index.%(ext)s"
            if command -v yt-dlp &> /dev/null; then
                yt-dlp --no-playlist -f "best[height<=720]" -o "$temp_output" "$url"
            else
                youtube-dl --no-playlist -f "best[height<=720]" -o "$temp_output" "$url"
            fi
            
            # Find the actual downloaded file and rename it
            local downloaded_file=$(find "$WORK_DIR" -name "source_$index.*" -type f | head -1)
            if [[ -n "$downloaded_file" ]]; then
                mv "$downloaded_file" "$output_file"
            fi
        fi
        
        # Verify the file was downloaded and has content
        if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
            local file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
            print_success "Downloaded video $((index + 1)) (${file_size} bytes)"
        else
            print_error "Downloaded file is empty or missing: $output_file"
            exit 1
        fi
        
        ((index++))
    done
}

# Extract clips from videos
extract_clips() {
    print_status "Extracting clips..."
    
    # Get video duration from first source
    local source_file="$WORK_DIR/source_0.mp4"
    if [[ ! -f "$source_file" ]]; then
        print_error "Source file not found: $source_file"
        exit 1
    fi
    
    # Check file size
    local file_size=$(stat -f%z "$source_file" 2>/dev/null || stat -c%s "$source_file" 2>/dev/null || echo "0")
    print_status "Source file size: ${file_size} bytes"
    
    local video_duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$source_file" | cut -d. -f1)
    print_status "Video duration: ${video_duration}s"
    
    # Calculate usable range
    local max_offset=$((video_duration - END_CUT - CLIP_DURATION))
    if [[ $max_offset -le $START_CUT ]]; then
        max_offset=$((START_CUT + 1))
        print_warning "Video may be too short for selected parameters"
    fi
    
    print_status "Will extract clips from ${START_CUT}s to ${max_offset}s"
    
    local successful_clips=0
    
    for j in $(seq 1 $NUM_CLIPS); do
        # Calculate start time
        local start_time
        if [[ "$LINEAR_MODE" == "true" ]]; then
            # Linear mode: distribute clips evenly
            local usable_duration=$((max_offset - START_CUT))
            local segment_size=$((usable_duration / NUM_CLIPS))
            start_time=$((START_CUT + (j - 1) * segment_size))
        else
            # Random mode: random position within usable range
            local range=$((max_offset - START_CUT))
            start_time=$((START_CUT + RANDOM % range))
        fi
        
        # Ensure we don't go past the end
        if [[ $((start_time + CLIP_DURATION)) -gt $((video_duration - END_CUT)) ]]; then
            start_time=$((video_duration - END_CUT - CLIP_DURATION))
        fi
        
        local output_clip="$WORK_DIR/clip$(printf "%02d" $j).mp4"
        
        print_status "Extracting clip $j at position ${start_time}s"
        
        # Extract clip with proper error handling
        if ffmpeg -ss $start_time -i "$source_file" -t $CLIP_DURATION -c:v libx264 -pix_fmt yuv420p -an -y "$output_clip"; then
            # Check if the clip was actually created and has content
            if [[ -f "$output_clip" ]] && [[ -s "$output_clip" ]]; then
                local clip_size=$(stat -f%z "$output_clip" 2>/dev/null || stat -c%s "$output_clip" 2>/dev/null || echo "0")
                print_success "Successfully extracted clip $j (${clip_size} bytes)"
                successful_clips=$((successful_clips + 1))
            else
                print_error "Clip $j was created but is empty or missing"
            fi
        else
            print_error "Failed to create clip $j — skipping..."
        fi
    done
    
    print_status "Successfully extracted $successful_clips out of $NUM_CLIPS clips"
    
    if [[ $successful_clips -eq 0 ]]; then
        print_error "No clips were successfully extracted. Exiting..."
        exit 1
    fi
}

# Create montage
create_montage() {
    print_status "Creating montage..."
    
    local output_file="$OUTPUT_DIR/${CUSTOM_FILENAME}_v$(printf "%02d" $1).mp4"
    
    if [[ "$LAYOUT" == "cut" ]]; then
        print_status "Creating cut montage..."
        
        # Create clip list for ffmpeg
        local clip_list="$WORK_DIR/clip_list.txt"
        print_status "Creating clip list..."
        > "$clip_list"
        
        # Find all mp4 files in the temp directory and add them to the clip list
        local clip_index=0
        for f in "$WORK_DIR"/clip*.mp4; do
            if [[ -f "$f" ]] && [[ -s "$f" ]]; then  # Check if file exists and is not empty
                clip_index=$((clip_index + 1))
                echo "file '$(basename "$f")'" >> "$clip_list"
                print_status "✓ Including clip: $(basename "$f")"
            fi
        done
        
        print_status "Added $clip_index clips to the list"
        
        # Check if we have clips in the list
        if [[ $clip_index -eq 0 ]]; then
            print_error "No valid clips found for concatenation. Skipping..."
            return 1
        fi
        
        # Check if clip list exists and is not empty
        if [[ ! -s "$clip_list" ]]; then
            print_error "Clip list file missing or empty. Skipping..."
            return 1
        fi
        
        # Create the montage
        print_status "Creating montage variation $1..."
        cd "$WORK_DIR"
        if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p "$output_file"; then
            # Wait a moment to ensure file is written
            sleep 1
            
            # Check if output file exists and has size
            if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
                local output_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
                print_success "Montage created: $output_file (${output_size} bytes)"
                print_success "Duration: ${MONTAGE_LENGTH}s, Interval: ${CLIP_DURATION}s, Clips: ${clip_index}"
                cd - > /dev/null
                return 0
            else
                cd - > /dev/null
                print_error "Output file not found or empty"
                return 1
            fi
        else
            cd - > /dev/null
            print_error "Failed to create montage for variation $1"
            return 1
        fi
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "         Test Montage Generator Script   "
    echo "========================================="
    echo ""
    
    check_dependencies
    setup_workspace
    download_videos
    extract_clips
    
    # Generate variations
    for i in $(seq 1 $VARIATIONS); do
        echo ""
        print_status "🎬 Creating variation $i of $VARIATIONS..."
        
        if create_montage $i; then
            print_success "Variation $i completed successfully"
        else
            print_error "Variation $i failed"
        fi
    done
    
    # Clean up temp directory
    rm -rf "$WORK_DIR"
    
    print_success "Montage generation complete!"
    print_success "Files saved to: $OUTPUT_DIR"
    
    # List output files
    echo ""
    print_status "Output files:"
    ls -la "$OUTPUT_DIR"
    
    # Open output directory
    if command -v open &> /dev/null; then
        open "$OUTPUT_DIR"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$OUTPUT_DIR"
    fi
}

# Run main function
main "$@" 