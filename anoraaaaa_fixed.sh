# Extract clips from videos (FIXED VERSION based on GAWX script)
extract_clips() {
    print_status "Extracting clips..."
    
    # Get video duration from first source
    local source_file="$WORK_DIR/source_0.mp4"
    if [[ ! -f "$source_file" ]]; then
        print_error "Source file not found: $source_file"
        exit 1
    fi
    
    local video_duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$source_file" | cut -d. -f1)
    print_status "Video duration: ${video_duration}s"
    
    # Calculate usable range
    local max_offset=$((video_duration - END_CUT - CLIP_DURATION))
    if [[ $max_offset -le $START_CUT ]]; then
        max_offset=$((START_CUT + 1))
        print_warning "Video may be too short for selected parameters"
    fi
    
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
        
        # Extract clip (simplified, no scaling for now)
        if ffmpeg -ss $start_time -i "$source_file" -t $CLIP_DURATION -c:v libx264 -pix_fmt yuv420p -an -y "$output_clip" < /dev/null 2>/dev/null; then
            print_success "Successfully extracted clip $j"
            successful_clips=$((successful_clips + 1))
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