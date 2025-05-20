#!/bin/bash
# Universal Montage Script - Compatible with Mac Terminal and Windows Git Bash

# Print colorized text if supported
print_colored() {
  if [ -t 1 ]; then  # Check if stdout is a terminal
    echo -e "\033[1;34m$1\033[0m"  # Blue text
  else
    echo "$1"
  fi
}

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function for safe math calculations
safe_calc() {
  result=$(awk "$1" 2>/dev/null)
  if [ -z "$result" ] || [ "$result" = "inf" ] || [ "$result" = "-inf" ] || [ "$result" = "nan" ]; then
    echo "$2" # fallback value
    return 1
  else
    echo "$result"
    return 0
  fi
}

# Welcome message
clear
print_colored "=================================="
print_colored "  Universal Montage Generator"
print_colored "=================================="
echo ""
echo "This script will help you create video montages using FFmpeg."
echo ""

# Check for FFmpeg
if ! command_exists ffmpeg; then
  echo "❌ Error: FFmpeg is not installed or not in your PATH."
  echo ""
  echo "Please install FFmpeg before continuing:"
  echo "- Mac: brew install ffmpeg"
  echo "- Windows (Git Bash): Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH"
  echo ""
  exit 1
fi

# Get FFmpeg version
FFMPEG_VERSION=$(ffmpeg -version | head -n 1)
echo "✅ Found: $FFMPEG_VERSION"
echo ""

# Create temp directory for working files
TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t 'montage')
echo "Created temporary directory: $TMP_DIR"

# Ensure temp directory is cleaned up on exit
cleanup() {
  echo ""
  echo "Cleaning up temporary files..."
  rm -rf "$TMP_DIR"
  echo "Done!"
}
trap cleanup EXIT

# Configuration
echo "Setting up montage configuration..."
SOURCE_URL=""
OUTPUT_DIR="$HOME/Downloads/montages"
DURATION=15
INTERVAL=1
NUM_CLIPS=15
LAYOUT="cut"  # cut or stacked

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Get source URL from user
echo "Please enter a video URL (Dropbox, direct link, etc.):"
read -r SOURCE_URL

if [ -z "$SOURCE_URL" ]; then
  echo "❌ No URL provided. Using a sample video for demonstration."
  SOURCE_URL="https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4"
fi

echo ""
print_colored "Montage Configuration:"
echo "Source: $SOURCE_URL"
echo "Duration: ${DURATION}s"
echo "Interval: ${INTERVAL}s"

# Calculate number of clips
NUM_CLIPS=$(safe_calc "BEGIN {printf \"%d\", $DURATION / $INTERVAL}" "15")
if [ -z "$NUM_CLIPS" ] || [ "$NUM_CLIPS" -lt 1 ]; then
  NUM_CLIPS=15
  echo "Warning: Calculated number of clips was invalid, setting to 15"
fi
echo "Will generate $NUM_CLIPS clips at ${INTERVAL}s intervals"
echo "Layout: $LAYOUT"
echo ""

# Download source video
echo "Downloading source video..."
SOURCE_FILE="$TMP_DIR/source.mp4"
if curl -s -L "$SOURCE_URL" -o "$SOURCE_FILE"; then
  echo "✅ Download complete!"
else
  echo "❌ Failed to download video. Please check your URL and internet connection."
  exit 1
fi

# Get video duration
echo "Getting video duration..."
DURATION_RAW=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SOURCE_FILE")
if [ -z "$DURATION_RAW" ]; then
  echo "❌ Error: Could not determine video duration."
  exit 1
fi
VIDEO_DURATION=${DURATION_RAW%.*}  # Strip decimal
echo "Video duration: ${VIDEO_DURATION}s"

# Get source video dimensions
echo "Getting source video dimensions..."
SOURCE_WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "$SOURCE_FILE")
SOURCE_HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=noprint_wrappers=1:nokey=1 "$SOURCE_FILE")
echo "Source video dimensions: ${SOURCE_WIDTH}x${SOURCE_HEIGHT}"
echo ""

# Extract clips
echo "Extracting clips..."
SUCCESSFUL_CLIPS=0

# Calculate usable video duration (exclude first 10% and last 10%)
START_EXCLUDE=$(safe_calc "BEGIN {printf \"%d\", $VIDEO_DURATION * 0.1}" "30")
END_EXCLUDE=$(safe_calc "BEGIN {printf \"%d\", $VIDEO_DURATION * 0.1}" "30")
USABLE_DURATION=$(safe_calc "BEGIN {print $VIDEO_DURATION - $START_EXCLUDE - $END_EXCLUDE}" "$VIDEO_DURATION")
echo "Usable duration: ${USABLE_DURATION}s (excluding first ${START_EXCLUDE}s and last ${END_EXCLUDE}s)"

# Extract clips with timestamps
for j in $(seq 1 $NUM_CLIPS); do
  # Calculate random offset within usable range
  RANDOM_OFFSET=$(awk "BEGIN {print $RANDOM % $USABLE_DURATION}")
  OFFSET=$(safe_calc "BEGIN {printf \"%d\", $START_EXCLUDE + $RANDOM_OFFSET}" "0")
  
  # Ensure offset is within valid range
  if (( $(safe_calc "BEGIN {print ($OFFSET > $VIDEO_DURATION - $INTERVAL - 1) ? 1 : 0}" "0") )); then
    OFFSET=$(awk "BEGIN {printf \"%d\", $VIDEO_DURATION - $INTERVAL - 1}")
  fi
  
  OUT_CLIP="$TMP_DIR/clip$(printf "%02d" $j).mp4"
  echo "Extracting clip $j at position ${OFFSET}s..."
  
  # Extract clip
  if ffmpeg -ss "$OFFSET" -i "$SOURCE_FILE" -t "$INTERVAL" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then
    echo "✅ Successfully extracted clip $j"
    SUCCESSFUL_CLIPS=$((SUCCESSFUL_CLIPS + 1))
  else
    echo "❌ Failed to create clip $j — skipping..."
  fi
done

echo ""
echo "Successfully extracted $SUCCESSFUL_CLIPS out of $NUM_CLIPS clips"

# Check if we have clips to work with
if [ $SUCCESSFUL_CLIPS -eq 0 ]; then
  echo "❌ No clips were successfully extracted. Exiting..."
  exit 1
fi

# Create output filename
FILENAME=$(basename "$SOURCE_URL" | sed 's/[^a-zA-Z0-9]/_/g')
OUTPUT="$OUTPUT_DIR/montage_${FILENAME}_${DURATION}s.mp4"

# Create montage based on layout type
if [ "$LAYOUT" = "cut" ]; then
  echo ""
  print_colored "Creating cut montage..."
  
  # Create clip list for ffmpeg
  CLIP_LIST="$TMP_DIR/clip_list.txt"
  echo "Creating clip list..."
  > "$CLIP_LIST"
  
  # Find all mp4 files in the temp directory and add them to the clip list
  for f in "$TMP_DIR"/clip*.mp4; do
    if [ -f "$f" ] && [ -s "$f" ]; then  # Check if file exists and is not empty
      echo "file '$(basename "$f")'" >> "$CLIP_LIST"
      echo "✓ Including clip: $(basename "$f")"
    fi
  done
  
  # Create the montage
  echo "Creating montage..."
  cd "$TMP_DIR" || exit
  
  if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p -an "$OUTPUT"; then
    echo "✅ Montage created: $OUTPUT"
  else
    echo "❌ Failed to create montage. Check the logs above for errors."
    exit 1
  fi
else
  echo ""
  print_colored "Creating stacked montage..."
  
  # Find all clips
  CLIPS=( $(find "$TMP_DIR" -name "clip*.mp4" -type f | sort) )
  
  # Build input files array
  INPUT_FILES=()
  for clip in "${CLIPS[@]}"; do
    INPUT_FILES+=(-i "$clip")
  endfore

  # Create a filter complex for the stacked layout
  FILTER="color=s=${SOURCE_WIDTH}x${SOURCE_HEIGHT}:d=${DURATION}:c=black[bg];"
  
  LAST_OUTPUT="bg"
  
  # Process clips in reverse order so newer clips appear on top
  for i in $(seq $((${#CLIPS[@]} - 1)) -1 0); do
    # Calculate appearance time (first clip at 0, others 1 second apart)
    CLIP_INDEX=$((${#CLIPS[@]} - 1 - i))
    
    if [ $CLIP_INDEX -eq 0 ]; then
      APPEAR_TIME=0
      SCALE_FACTOR=1.0
    else
      APPEAR_TIME=$CLIP_INDEX
      # Calculate scale factor based on the clip index
      SCALE_FACTOR=$(awk "BEGIN {printf \"%.2f\", $SCALE_FACTOR * 0.75}")
    fi
    
    # Calculate scaled dimensions
    SCALED_WIDTH=$(awk "BEGIN {printf \"%d\", $SOURCE_WIDTH * $SCALE_FACTOR}")
    SCALED_HEIGHT=$(awk "BEGIN {printf \"%d\", $SOURCE_HEIGHT * $SCALE_FACTOR}")
    
    # For clips after the first, calculate position
    if [ $CLIP_INDEX -gt 0 ]; then
      # Calculate maximum position to ensure clip is within bounds
      MAX_X=$(( SOURCE_WIDTH - SCALED_WIDTH ))
      MAX_Y=$(( SOURCE_HEIGHT - SCALED_HEIGHT ))
      
      # Ensure MAX_X and MAX_Y are at least 0
      if [ $MAX_X -lt 0 ]; then MAX_X=0; fi
      if [ $MAX_Y -lt 0 ]; then MAX_Y=0; fi
      
      # Generate random position
      X=$(( RANDOM % (MAX_X + 1) ))
      Y=$(( RANDOM % (MAX_Y + 1) ))
    else
      # First clip is centered and full size
      X=0
      Y=0
    fi
    
    # Add to filter complex
    FILTER="${FILTER}[$i:v]setpts=PTS-STARTPTS+${APPEAR_TIME}/TB,"
    # Scale the video
    FILTER="${FILTER}scale=${SCALED_WIDTH}:${SCALED_HEIGHT}[v$i];"
    # Overlay the video
    FILTER="${FILTER}[$LAST_OUTPUT][v$i]overlay=${X}:${Y}[out$i];"
    
    # Update the last output name
    LAST_OUTPUT="out$i"
  done
  
  # Execute the ffmpeg command
  if ffmpeg "${INPUT_FILES[@]}" -filter_complex "${FILTER}" -map "[${LAST_OUTPUT}]" -c:v libx264 -preset fast -pix_fmt yuv420p -an -t "${DURATION}" "${OUTPUT}"; then
    echo "✅ Stacked montage created: $OUTPUT"
  else
    echo "❌ Failed to create stacked montage."
    exit 1
  fi
fi

echo ""
print_colored "✨ Montage generation complete!"
echo "Your montage is saved at: $OUTPUT"
echo ""
echo "To view your montage, open the file in your video player."
echo "Location: $OUTPUT"
