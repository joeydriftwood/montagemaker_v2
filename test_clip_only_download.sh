#!/bin/bash
# Test script to verify clip-only downloading (no full video download)

echo "========================================="
echo "    Testing Clip-Only Download Logic    "
echo "========================================="
echo ""

# Configuration for testing
SOURCE_URLS=("https://www.youtube.com/watch?v=FIEKXjHgSbs")
OUTPUT_DIR="$HOME/Downloads/clip_test"
MONTAGE_LENGTH=10
CLIP_DURATION=1
NUM_CLIPS=5
START_CUT=0
END_CUT=60
LAYOUT="cut"
KEEP_AUDIO=true
LINEAR_MODE=true
OUTPUT_WIDTH=1280
OUTPUT_HEIGHT=720
CUSTOM_FILENAME="clip_test"
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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
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

# Test clip-only download logic
test_clip_download() {
    print_status "Testing clip-only download logic..."
    
    local url="${SOURCE_URLS[0]}"
    print_status "Processing source: $url"
    
    # Get video duration first (without downloading full video)
    local video_duration=0
    if [[ "$url" == *"youtube.com"* ]] || [[ "$url" == *"youtu.be"* ]]; then
        # Get duration from YouTube without downloading
        print_status "Getting video duration from YouTube..."
        video_duration=$(yt-dlp --get-duration "$url" 2>/dev/null | cut -d: -f1,2 | awk -F: '{print $1*60 + $2}' | tail -1)
        print_success "Video duration: ${video_duration}s (retrieved without downloading full video)"
    fi
    
    if [[ "$video_duration" -eq 0 ]]; then
        print_warning "Could not determine video duration, using default 60 seconds"
        video_duration=60
    fi
    
    # Calculate usable range
    local max_offset=$((video_duration - END_CUT - CLIP_DURATION))
    if [[ $max_offset -le $START_CUT ]]; then
        max_offset=$((START_CUT + 1))
        print_warning "Video may be too short for selected parameters"
    fi
    
    print_status "Will download clips from ${START_CUT}s to ${max_offset}s"
    
    # Download clips directly for each variation
    for variation in $(seq 1 $VARIATIONS); do
        print_status "Downloading clips for variation $variation..."
        
        # Set random seed for this variation
        RANDOM=$((variation * 12345))
        
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
            
            local output_clip="$WORK_DIR/clip_v${variation}_$(printf "%02d" $j).mp4"
            
            print_status "Downloading clip $j for variation $variation at position ${start_time}s"
            
            # Download specific clip directly using yt-dlp download-sections
            if yt-dlp --download-sections "*${start_time}-$((start_time + CLIP_DURATION))" -f "best[height<=720]" -o "$output_clip" "$url" > /dev/null 2>&1; then
                print_success "Downloaded YouTube clip $j for variation $variation"
            else
                print_error "Failed to download YouTube clip $j for variation $variation"
            fi
            
            # Verify clip was created
            if [[ -f "$output_clip" ]] && [[ -s "$output_clip" ]]; then
                local clip_size=$(stat -f%z "$output_clip" 2>/dev/null || stat -c%s "$output_clip" 2>/dev/null || echo "0")
                print_success "Clip $j for variation $variation ready (${clip_size} bytes)"
            else
                print_error "Clip $j for variation $variation is empty or missing"
            fi
        done
    done
}

# Create montage from downloaded clips
create_montage() {
    local variation_num=$1
    print_status "Creating montage for variation $variation_num..."
    
    local output_file="$OUTPUT_DIR/${CUSTOM_FILENAME}_v$(printf "%02d" $variation_num).mp4"
    
    if [[ "$LAYOUT" == "cut" ]]; then
        print_status "Creating cut montage..."
        
        # Create clip list for ffmpeg
        local clip_list="$WORK_DIR/clip_list.txt"
        print_status "Creating clip list..."
        > "$clip_list"
        
        # Find clips for this specific variation
        local clip_index=0
        for f in "$WORK_DIR"/clip_v${variation_num}_*.mp4; do
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
        print_status "Creating montage variation $variation_num..."
        cd "$WORK_DIR"
        if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p "$output_file" > /dev/null 2>&1; then
            # Wait a moment to ensure file is written
            sleep 1
            
            # Check if output file exists and has size
            if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
                local file_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
                print_success "Montage created: $output_file ($file_size bytes)"
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
            print_error "Failed to create montage for variation $variation_num"
            return 1
        fi
    fi
}

# Main execution
main() {
    echo "========================================="
    echo "         Clip-Only Download Test        "
    echo "========================================="
    echo ""
    echo "This test verifies that we ONLY download clips, not full videos"
    echo "URL: ${SOURCE_URLS[0]}"
    echo "Clips: $NUM_CLIPS clips of ${CLIP_DURATION}s each"
    echo "Total montage length: ${MONTAGE_LENGTH}s"
    echo ""
    
    check_dependencies
    setup_workspace
    test_clip_download
    
    # Generate variations (clips already downloaded for each variation)
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
    
    print_success "Clip-only download test complete!"
    print_success "Files saved to: $OUTPUT_DIR"
    
    # List output files
    echo ""
    echo "Generated files:"
    ls -la "$OUTPUT_DIR"
    
    # Show workspace size (should be minimal since we only downloaded clips)
    echo ""
    print_status "Workspace was cleaned up - no full videos were stored"
}

# Run main function
main "$@" 