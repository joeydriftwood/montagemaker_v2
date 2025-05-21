"use client"

import { useState } from "react"
import { Plus, Trash2, Download } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import * as z from "zod"

const formSchema = z.object({
  topVideoUrl: z.string().url({ message: "Please enter a valid URL" }),
  bottomVideoUrl: z.string().url({ message: "Please enter a valid URL" }),
  topStartTime: z.string().refine((value) => !isNaN(Number.parseFloat(value)), {
    message: "Please enter a valid number",
  }),
  topDuration: z.string().refine((value) => !isNaN(Number.parseFloat(value)), {
    message: "Please enter a valid number",
  }),
  bottomStartTime: z.string().refine((value) => !isNaN(Number.parseFloat(value)), {
    message: "Please enter a valid number",
  }),
  bottomDuration: z.string().refine((value) => !isNaN(Number.parseFloat(value)), {
    message: "Please enter a valid number",
  }),
  topVolume: z.number().min(0).max(100),
  bottomVolume: z.number().min(0).max(100),
})

export function MontageGenerator() {
  // State for form inputs
  const [videoLinks, setVideoLinks] = useState<string[]>([""])
  const [montageType, setMontageType] = useState<string>("fixed")
  const [layoutType, setLayoutType] = useState<string>("cut")
  const [useRandomPositions, setUseRandomPositions] = useState<boolean>(true)
  const [interval, setInterval] = useState<string>("1")
  const [bpm, setBpm] = useState<string>("120")
  const [montageLength, setMontageLength] = useState<string>("15")
  const [linearMode, setLinearMode] = useState<boolean>(false)
  const [customFilename, setCustomFilename] = useState<string>("")
  const [resolution, setResolution] = useState<string>("original")
  const [keepAudio, setKeepAudio] = useState<boolean>(false)
  const [variations, setVariations] = useState<string>("1")
  const [startCutAt, setStartCutAt] = useState<string>("180")
  const [endCutAt, setEndCutAt] = useState<string>("300")

  // State for job status
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [jobId, setJobId] = useState<string>("")
  const [jobStatus, setJobStatus] = useState<string>("")
  const [jobProgress, setJobProgress] = useState<number>(0)
  const [jobError, setJobError] = useState<string>("")
  const [downloadUrl, setDownloadUrl] = useState<string>("")

  const { toast } = useToast()

  // State for script generation and download
  const [generatedScript, setGeneratedScript] = useState<string>("")
  const [scriptFilename, setScriptFilename] = useState<string>("montage.sh")
  const [copyNotification, setCopyNotification] = useState<string>("")
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState<boolean>(false)
  const [outputPath, setOutputPath] = useState<string>("~/Downloads")

  // Add a new video link input field
  const addVideoLink = () => {
    if (videoLinks.length < 5) {
      setVideoLinks([...videoLinks, ""])
    }
  }

  // Remove a video link input field
  const removeVideoLink = (index: number) => {
    if (videoLinks.length > 1) {
      const newLinks = [...videoLinks]
      newLinks.splice(index, 1)
      setVideoLinks(newLinks)
    }
  }

  // Update a video link value with automatic conversion for Dropbox links
  const updateVideoLink = (index: number, value: string) => {
    // Auto-convert Dropbox links to direct download links
    let processedValue = value

    // Check if it's a Dropbox link that needs conversion
    if (value.includes("dropbox.com") && !value.includes("raw=1")) {
      // If it ends with dl=0, replace it with raw=1
      if (value.endsWith("dl=0")) {
        processedValue = value.slice(0, -4) + "raw=1"
      }
      // If it doesn't have a query parameter, add ?raw=1
      else if (!value.includes("?")) {
        processedValue = value + "?raw=1"
      }
    }

    const newLinks = [...videoLinks]
    newLinks[index] = processedValue
    setVideoLinks(newLinks)
  }

  // Generate montage on the server
  const generateMontage = async () => {
    if (videoLinks[0].trim() === "") {
      toast({
        title: "Error",
        description: "Please enter at least one video URL",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setJobStatus("pending")
    setJobProgress(0)
    setJobError("")
    setDownloadUrl("")

    try {
      const response = await fetch("https://montagemaker-seven.vercel.app/api/generate-montage"
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrls: videoLinks,
          montageType,
          layoutType,
          useRandomPositions,
          interval: Number.parseFloat(interval),
          bpm: Number.parseInt(bpm),
          montageLength: Number.parseInt(montageLength),
          keepAudio,
          resolution,
          linearMode,
          customFilename,
          startCutAt: Number.parseInt(startCutAt),
          endCutAt: Number.parseInt(endCutAt),
          variations: Number.parseInt(variations),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to start montage generation")
      }

      const data = await response.json()
      setJobId(data.jobId)

      // Poll for job status
      const statusInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/job-status?jobId=${data.jobId}`)
          if (!statusResponse.ok) {
            clearInterval(statusInterval)
            throw new Error("Failed to get job status")
          }

          const statusData = await statusResponse.json()
          setJobStatus(statusData.status)
          setJobProgress(statusData.progress || 0)

          if (statusData.error) {
            setJobError(statusData.error)
            clearInterval(statusInterval)
            setIsGenerating(false)
          }

          if (statusData.downloadUrl) {
            setDownloadUrl(statusData.downloadUrl)
          }

          if (statusData.status === "completed" || statusData.status === "failed") {
            clearInterval(statusInterval)
            setIsGenerating(statusData.status !== "failed")

            if (statusData.status === "completed") {
              toast({
                title: "Success",
                description: "Your montage is ready to download!",
              })
            } else if (statusData.status === "failed") {
              toast({
                title: "Error",
                description: statusData.error || "Failed to generate montage",
                variant: "destructive",
              })
            }
          }
        } catch (error) {
          clearInterval(statusInterval)
          setIsGenerating(false)
          setJobStatus("failed")
          toast({
            title: "Error",
            description: error.message || "Failed to check job status",
            variant: "destructive",
          })
        }
      }, 2000)
    } catch (error) {
      setIsGenerating(false)
      setJobStatus("failed")
      toast({
        title: "Error",
        description: error.message || "Failed to start montage generation",
        variant: "destructive",
      })
    }
  }

  // Generate the script
  const generateScript = () => {
    let scriptHeader = "#!/bin/bash\n"
    scriptHeader += "# Note: All paths with ~ are expanded to $HOME for compatibility\n\n"

    // Add a safe math function to handle calculation errors
    scriptHeader += "# Function for safe math calculations\n"
    scriptHeader += "safe_calc() {\n"
    scriptHeader += '  result=$(awk "$1" 2>/dev/null)\n'
    scriptHeader +=
      '  if [ -z "$result" ] || [ "$result" = "inf" ] || [ "$result" = "-inf" ] || [ "$result" = "nan" ]; then\n'
    scriptHeader += '    echo "$2" # fallback value\n'
    scriptHeader += "  else\n"
    scriptHeader += '    echo "$result"\n'
    scriptHeader += "  fi\n"
    scriptHeader += "}\n\n"

    let script = scriptHeader
    script += "# Note: All paths with ~ are expanded to $HOME for compatibility\n\n"

    // Add film source with Dropbox links or YouTube URLs
    script += "# --- CONFIG ---\n"

    // Handle multiple sources
    if (videoLinks.length === 1) {
      script += `SOURCE="${videoLinks[0]}"\n`
    } else {
      script += "# Multiple sources for random selection\n"
      videoLinks.forEach((link, index) => {
        script += `SOURCE_${index + 1}="${link}"\n`
      })

      script += "\n# Randomly select one source if multiple are provided\n"
      script += "SOURCES=("
      videoLinks.forEach((_, index) => {
        script += `"$SOURCE_${index + 1}" `
      })
      script += ")\n"
      script += 'SOURCE="${SOURCES[$RANDOM % ${#SOURCES[@]}]}"\n'
    }

    script += `DEBUG_MODE="false"                   # Set to true to keep temp files for debugging\n`
    script += `KEEP_AUDIO="${keepAudio ? "true" : "false"}"           # Keep audio in clips\n`

    // Add YouTube support with full video length
    script += `
# --- YOUTUBE SUPPORT ---
# Check if source is a YouTube URL
if [[ "$SOURCE" == *"youtube.com"* || "$SOURCE" == *"youtu.be"* ]]; then
echo "YouTube URL detected. Downloading video..."

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
  echo "❌ Error: yt-dlp is not installed. Please install it with: brew install yt-dlp"
  exit 1
fi

# Create temp directory for YouTube download
YT_TMP_DIR=$(mktemp -d)
YT_OUTPUT="$YT_TMP_DIR/downloaded_yt_video.mp4"

# Download YouTube video
echo "Downloading YouTube video to $YT_OUTPUT..."
if yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" "$SOURCE" -o "$YT_OUTPUT"; then
  echo "✅ YouTube video downloaded successfully"
  # Replace source with local file
  SOURCE="$YT_OUTPUT"
  # For YouTube videos, use the full video length (no exclusions)
  USE_FULL_VIDEO="true"
else
  echo "❌ Failed to download YouTube video. Check the URL and your internet connection."
  rm -rf "$YT_TMP_DIR"
  exit 1
fi
else
# For regular videos, use default exclusion ranges
USE_FULL_VIDEO="false"
fi
`

    // Add montage logic
    const intervalSeconds = interval

    if (montageType === "fixed") {
      script += `
DURATION="${montageLength}"              # Length of final montage in seconds
`
      script += `INTERVAL="${intervalSeconds}"              # Interval per clip (fixed)
`
    } else {
      // Calculate interval based on BPM
      script += `
BPM="${bpm}"                             # Beats per minute
`
      script += `DURATION="${montageLength}"                # Length of final montage in seconds
`
      script += `INTERVAL_RAW=$(awk "BEGIN {print 60/$BPM}")   # Raw interval calculation
`
      script += `INTERVAL=$(echo "$INTERVAL_RAW" | awk '{printf "%.2f", $0}')  # Format with proper decimal places
`
    }

    script += `VARIATIONS="${variations}"                 # Number of unique montages to generate
`
    // Expand ~ to $HOME in output path
    script += `OUTPUT_DIR="${outputPath.replace(/^~\//, "$HOME/")}"
`
    script += `LAYOUT_TYPE="${layoutType}"                # Montage layout type (cut or stacked)
`
    script += `LINEAR_MODE="${linearMode ? "true" : "false"}"           # Linear clip selection mode
`
    script += `CUSTOM_NAME="${customFilename}"  # Custom name for output files
`
    script += `RESOLUTION="${resolution}"              # Output resolution
`

    if (layoutType === "stacked") {
      script += `RANDOM_POSITIONS="${useRandomPositions ? "true" : "false"}"  # Use random positions for stacked layout
`
    }

    script += "\n"

    // Get video duration
    script += "# Get video duration\n"
    script += 'echo "Getting video duration..."\n'
    script +=
      'DURATION_RAW=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SOURCE")\n'
    script += 'if [ -z "$DURATION_RAW" ]; then\n'
    script += '  echo "❌ Error: Could not determine video duration. Check if the source URL is accessible."\n'
    script += "  exit 1\n"
    script += "fi\n"
    script += "VIDEO_DURATION=${DURATION_RAW%.*}  # Strip decimal\n"
    script += 'echo "Video duration: ${VIDEO_DURATION}s"\n\n'

    // Get source video dimensions
    script += "# Get source video dimensions\n"
    script += 'echo "Getting source video dimensions..."\n'
    script +=
      'SOURCE_WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of default=noprint_wrappers=1:nokey=1 "$SOURCE")\n'
    script +=
      'SOURCE_HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=noprint_wrappers=1:nokey=1 "$SOURCE")\n'
    script += 'echo "Source video dimensions: ${SOURCE_WIDTH}x${SOURCE_HEIGHT}"\n\n'

    // Calculate number of clips
    script += "# Calculate number of clips\n"
    script += 'NUM_CLIPS=$(safe_calc "BEGIN {printf \\"%d\\", $DURATION / $INTERVAL}" 15)\n'
    script += "# Ensure NUM_CLIPS is at least 1\n"
    script += 'if [ -z "$NUM_CLIPS" ] || [ "$NUM_CLIPS" -lt 1 ]; then\n'
    script += "  NUM_CLIPS=1\n"
    script += '  echo "Warning: Calculated number of clips was invalid, setting to 1"\n'
    script += "fi\n"
    script += 'echo "Will generate $NUM_CLIPS clips at ${INTERVAL}s intervals for each variation"\n\n'

    // Get film name for output filename
    script += "# Extract filename for output naming\n"
    script += 'FILENAME=$(basename "$SOURCE")\n'
    script += 'FILM="${FILENAME%.*}"\n'
    script += 'TYPE="' + (montageType === "fixed" ? "fixed${INTERVAL}" : "bpm${BPM}") + '"\n'
    script += 'LAYOUT="' + (layoutType === "cut" ? "cut" : "stacked") + '"\n'
    script += 'MODE="' + (linearMode ? "linear" : "random") + '"\n\n'

    // Loop for variations
    script += "# --- GENERATE VARIATIONS ---\n"
    script += "for i in $(seq 1 $VARIATIONS); do\n"
    script += '  echo "\n🎬 Creating variation $i of $VARIATIONS..."\n\n'

    // Create temp directory for clips
    script += "  # Create temp directory for this variation\n"
    script += "  TMP_DIR=$(mktemp -d)\n"
    script += '  echo "Created temp directory: $TMP_DIR"\n\n'

    // Extract clips with improved random timestamps - with optional custom ranges
    script += "  # Extract clips with timestamps\n"
    script += '  if [ "$USE_FULL_VIDEO" = "true" ]; then\n'
    script += '    echo "  Using full video length (no exclusions)"\n'
    script += "    START_EXCLUDE=0\n"
    script += "    END_EXCLUDE=0\n"
    script += '  elif [ "$USE_CUSTOM_RANGE" = "true" ]; then\n'
    script += `    START_EXCLUDE="${startCutAt}"  # Custom start exclusion time\n`
    script += `    END_EXCLUDE="${endCutAt}"      # Custom end exclusion time\n`
    script += "  else\n"
    script += "    START_EXCLUDE=180  # Default: exclude first 3 mins\n"
    script += "    END_EXCLUDE=300    # Default: exclude last 5 mins\n"
    script += "  fi\n"
    script += "  SUCCESSFUL_CLIPS=0\n"

    // Add linear mode logic for clip extraction
    script += '  if [ "$LINEAR_MODE" = "true" ]; then\n'
    script += '    echo "  Using linear clip selection mode"\n'

    script += "    # Calculate usable video duration\n"
    script += '    USABLE_DURATION=$(awk "BEGIN {print $VIDEO_DURATION - $START_EXCLUDE - $END_EXCLUDE}")\n'
    script += "    # Calculate segment size for linear distribution\n"
    script += '    SEGMENT_SIZE=$(awk "BEGIN {print $USABLE_DURATION / $NUM_CLIPS}")\n'
    script +=
      '    echo "  Dividing usable video duration ($USABLE_DURATION seconds) into $NUM_CLIPS segments of $SEGMENT_SIZE seconds each"\n\n'

    script += "    for j in $(seq 1 $NUM_CLIPS); do\n"
    script += "      # Calculate segment boundaries\n"
    script += '      SEGMENT_START=$(awk "BEGIN {print $START_EXCLUDE + ($j - 1) * $SEGMENT_SIZE}")\n'
    script += '      SEGMENT_END=$(awk "BEGIN {print $SEGMENT_START + $SEGMENT_SIZE}")\n'

    script += "      # Add some randomness within the segment (up to 50% of segment size)\n"
    script += '      MAX_RANDOM=$(awk "BEGIN {print $SEGMENT_SIZE * 0.5}")\n'
    script += '      RANDOM_OFFSET=$(awk "BEGIN {print $RANDOM / 32767 * $MAX_RANDOM}")\n'
    script += '      OFFSET=$(awk "BEGIN {printf \\"%d\\", $SEGMENT_START + $RANDOM_OFFSET}")\n'

    // Add check to avoid timestamps too close to the end of the video
    script += "      # Check if timestamp is too close to the end of the video\n"
    if (layoutType === "cut") {
      script += '      CLIP_LENGTH="$INTERVAL"\n'
    } else {
      // For stacked layout, extract longer clips to ensure they play out fully
      script += '      CLIP_LENGTH="$DURATION"\n'
    }
    script += '      if (( $(awk "BEGIN {print ($OFFSET > $VIDEO_DURATION - $CLIP_LENGTH - 1) ? 1 : 0}") )); then\n'
    script += '        echo "  ⚠️ Timestamp $OFFSET is too close to the end of the video, adjusting..."\n'
    script += '        OFFSET=$(awk "BEGIN {printf \\"%d\\", $VIDEO_DURATION - $CLIP_LENGTH - 1}")\n'
    script += "      fi\n"

    script += '      OUT_CLIP="$TMP_DIR/clip$(printf "%02d" $j).mp4"\n'
    script +=
      '      echo "  Extracting clip $j from segment $(printf "%.0f" $SEGMENT_START)-$(printf "%.0f" $SEGMENT_END)s at position $OFFSET seconds"\n'

    // For cut layout, extract clips with the interval duration
    // For stacked layout, extract clips with the full montage duration
    // Always use fast mode (seek first, then input)
    if (layoutType === "cut") {
      script += "      # Fast mode: seek first, then input (faster but less accurate)\n"

      // Add resolution scaling if not using original resolution
      if (resolution !== "original") {
        const width = resolution === "1080p" ? "1920" : "1280"
        const height = resolution === "1080p" ? "1080" : "720"

        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      } else {
        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      }

      script += '        echo "  ✅ Successfully extracted clip $j"\n'
      script += "        SUCCESSFUL_CLIPS=$((SUCCESSFUL_CLIPS + 1))\n"
      script += "      else\n"
      script += '        echo "  ❌ Failed to create clip $j — skipping..."\n'
      script += "        fi\n"
    } else {
      script += "      # Fast mode: seek first, then input (faster but less accurate)\n"
      script += "      # For stacked layout, extract longer clips to ensure they play out fully\n"

      // Add resolution scaling if not using original resolution
      if (resolution !== "original") {
        const width = resolution === "1080p" ? "1920" : "1280"
        const height = resolution === "1080p" ? "1080" : "720"

        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      } else {
        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      }

      script += '        echo "  ✅ Successfully extracted clip $j"\n'
      script += "        SUCCESSFUL_CLIPS=$((SUCCESSFUL_CLIPS + 1))\n"
      script += "      else\n"
      script += '        echo "  ❌ Failed to create clip $j — skipping..."\n'
      script += "        fi\n"
    }

    script += "    done\n"

    // Random mode (original logic)
    script += "  else\n"
    script += '    echo "  Using random clip selection mode"\n'
    script += "    for j in $(seq 1 $NUM_CLIPS); do\n"

    // For cut layout, we need to account for the interval duration
    // For stacked layout, we need to account for the full montage duration
    // Using awk for floating point arithmetic
    if (layoutType === "cut") {
      script += "      # Ensure clip fits within video by accounting for clip duration\n"
      script += '      CLIP_LENGTH="$INTERVAL"\n'
      script += '      MAX_OFFSET=$(awk "BEGIN {printf \\"%d\\", $VIDEO_DURATION - $END_EXCLUDE - $INTERVAL}")\n'
    } else {
      script += "      # Ensure clip fits within video by accounting for clip duration\n"
      script += '      CLIP_LENGTH="$DURATION"\n'
      script += '      MAX_OFFSET=$(awk "BEGIN {printf \\"%d\\", $VIDEO_DURATION - $END_EXCLUDE - $DURATION}")\n'
    }

    script += "      # Ensure MAX_OFFSET is at least START_EXCLUDE to avoid negative range\n"
    script += '      if (( $(awk "BEGIN {print ($MAX_OFFSET <= $START_EXCLUDE) ? 1 : 0}") )); then\n'
    script += '        MAX_OFFSET=$(awk "BEGIN {print $START_EXCLUDE + 1}")\n'
    script += '        echo "  ⚠️ Warning: Video may be too short for selected parameters"\n'
    script += "      fi\n"

    // Use awk for random offset calculation with floating point
    script += '      RANGE=$(awk "BEGIN {print $MAX_OFFSET - $START_EXCLUDE}")\n'
    script += '      RANDOM_OFFSET=$(awk "BEGIN {print $RANDOM / 32767 * $RANGE}")\n'
    script += '      OFFSET=$(awk "BEGIN {printf \\"%d\\", $START_EXCLUDE + $RANDOM_OFFSET}")\n'

    // Add check to avoid timestamps too close to the end of the video
    script += "      # Check if timestamp is too close to the end of the video\n"
    script += '      if (( $(awk "BEGIN {print ($OFFSET > $VIDEO_DURATION - $CLIP_LENGTH - 1) ? 1 : 0}") )); then\n'
    script += '        echo "  ⚠️ Timestamp $OFFSET is too close to the end of the video, adjusting..."\n'
    script += '        OFFSET=$(awk "BEGIN {printf \\"%d\\", $VIDEO_DURATION - $CLIP_LENGTH - 1}")\n'
    script += "      fi\n"

    script += '      OUT_CLIP="$TMP_DIR/clip$(printf "%02d" $j).mp4"\n'
    script += '      echo "  Extracting clip $j at position $OFFSET seconds"\n'

    // For cut layout, extract clips with the interval duration
    // For stacked layout, extract clips with the full montage duration
    // Always use fast mode (seek first, then input)
    if (layoutType === "cut") {
      script += "      # Fast mode: seek first, then input (faster but less accurate)\n"

      // Add resolution scaling if not using original resolution
      if (resolution !== "original") {
        const width = resolution === "1080p" ? "1920" : "1280"
        const height = resolution === "1080p" ? "1080" : "720"

        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      } else {
        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$INTERVAL" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      }

      script += '          echo "  ✅ Successfully extracted clip $j"\n'
      script += "          SUCCESSFUL_CLIPS=$((SUCCESSFUL_CLIPS + 1))\n"
      script += "        else\n"
      script += '          echo "  ❌ Failed to create clip $j — skipping..."\n'
      script += "        fi\n"
    } else {
      script += "      # Fast mode: seek first, then input (faster but less accurate)\n"
      script += "      # For stacked layout, extract longer clips to ensure they play out fully\n"

      // Add resolution scaling if not using original resolution
      if (resolution !== "original") {
        const width = resolution === "1080p" ? "1920" : "1280"
        const height = resolution === "1080p" ? "1080" : "720"

        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -vf "scale=' +
            width +
            ":" +
            height +
            ":force_original_aspect_ratio=decrease,pad=" +
            width +
            ":" +
            height +
            ':(ow-iw)/2:(oh-ih)/2" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      } else {
        // Conditionally include or exclude the -an flag based on keepAudio
        if (keepAudio) {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -c:v libx264 -pix_fmt yuv420p -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        } else {
          script +=
            '      if ffmpeg -ss "$OFFSET" -i "$SOURCE" -t "$DURATION" -c:v libx264 -pix_fmt yuv420p -an -y "$OUT_CLIP" < /dev/null 2>/dev/null; then\n'
        }
      }

      script += '          echo "  ✅ Successfully extracted clip $j"\n'
      script += "          SUCCESSFUL_CLIPS=$((SUCCESSFUL_CLIPS + 1))\n"
      script += "        else\n"
      script += '          echo "  ❌ Failed to create clip $j — skipping..."\n'
      script += "        fi\n"
    }

    script += "    done\n"
    script += "  fi\n\n"

    // The rest of the script generation remains the same
    // Check if we have clips to work with
    script += "  # Check if we have clips to work with\n"
    script += '  echo "  Successfully extracted $SUCCESSFUL_CLIPS out of $NUM_CLIPS clips"\n\n'
    script += "  if [ $SUCCESSFUL_CLIPS -eq 0 ]; then\n"
    script += '    echo "  ❌ No clips were successfully extracted for variation $i. Skipping..."\n'
    script += '    rm -rf "$TMP_DIR"\n'
    script += "    continue\n"
    script += "  fi\n\n"

    // Different processing based on layout type
    // Replace this line:
    // OUTPUT="$OUTPUT_DIR/montage_${FILM}_${TYPE}_${LAYOUT}_${MODE}_${DURATION}s_v$(printf "%02d" $i).mp4"
    script += '  if [ -n "$CUSTOM_NAME" ]; then\n'
    script += '    OUTPUT="$OUTPUT_DIR/${CUSTOM_NAME}_v$(printf "%02d" $i).mp4"\n'
    script += "  else\n"
    script +=
      '    OUTPUT="$OUTPUT_DIR/montage_${FILM}_${TYPE}_${LAYOUT}_${MODE}_${DURATION}s_v$(printf "%02d" $i).mp4"\n'
    script += "  fi\n"

    // Add cleanup for YouTube temp directory at the end of the script
    // Find the end of the script and add:
    // Create output directory
    script += "  # Create output directory if it doesn't exist\n"
    script += '  mkdir -p "$OUTPUT_DIR"\n'
    script += '  echo "Created output directory: $OUTPUT_DIR"\n\n'

    // CUT layout
    script += '  if [ "$LAYOUT_TYPE" = "cut" ]; then\n'
    script += '    echo "  Using cut layout: concatenating clips..."\n'
    script += "    # Create clip list for ffmpeg\n"
    script += '    CLIP_LIST="$TMP_DIR/clip_list.txt"\n'
    script += '    echo "  Creating clip list..."\n'
    script += "    # Only include clips that were successfully created\n"
    script += "    CLIP_INDEX=0\n"
    script += "    # Clear the clip list file if it exists\n"
    script += '  > "$CLIP_LIST"\n\n'
    script += "    # Find all mp4 files in the temp directory and add them to the clip list\n"
    script += '    for f in "$TMP_DIR"/clip*.mp4; do\n'
    script += '      if [ -f "$f" ] && [ -s "$f" ]; then  # Check if file exists and is not empty\n'
    script += "        CLIP_INDEX=$((CLIP_INDEX + 1))\n"
    script += '        echo "file \'$(basename "$f")\'" >> "$CLIP_LIST"\n'
    script += '        echo "  ✓ Including clip: $(basename "$f")"\n'
    script += "      fi\n"
    script += "    done\n\n"
    script += '    echo "  Added $CLIP_INDEX clips to the list"\n'
    script += "    # Check if we have clips in the list\n"
    script += "    if [ $CLIP_INDEX -eq 0 ]; then\n"
    script += '      echo "  ❌ No valid clips found for concatenation. Skipping..."\n'
    script += '      rm -rf "$TMP_DIR"\n'
    script += "    continue\n"
    script += "    fi\n\n"
    script += "    # Check if clip list exists and is not empty\n"
    script += '    if [ ! -s "$CLIP_LIST" ]; then\n'
    script += '      echo "  ❌ Clip list file missing or empty. Skipping..."\n'
    script += '      rm -rf "$TMP_DIR"\n'
    script += "    continue\n"
    script += "    fi\n\n"
    script += "    # Create the montage for this variation\n"
    script += '  echo "  Creating montage variation $i..."\n'
    script += "    # Change to the temp directory before running ffmpeg\n"
    script += '    cd "$TMP_DIR"\n'

    // Conditionally include or exclude the -an flag based on keepAudio for the final output
    if (keepAudio) {
      script += '    if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p "$OUTPUT"; then\n'
    } else {
      script += '    if ffmpeg -f concat -safe 0 -i "clip_list.txt" -c:v libx264 -pix_fmt yuv420p -an "$OUTPUT"; then\n'
    }

    script += "      # Wait a moment to ensure file is written\n"
    script += "      sleep 1\n"
    script += "      \n"
    script += "      # Check if output file exists and has size\n"
    script += '      if [ -f "$OUTPUT" ] && [ -s "$OUTPUT" ]; then\n'
    script += '        echo "  ✅ Montage created: $OUTPUT"\n'
    script += '        echo "  Duration: ${DURATION}s, Interval: ${INTERVAL}s, Clips: ${CLIP_INDEX}"\n'
    script += "        # Return to the original directory\n"
    script += "        cd - > /dev/null\n"
    script += '        echo "  Cleaning up temporary files..."\n'
    script += '        rm -rf "$TMP_DIR"\n'
    script += '        echo "  Temporary files removed"\n'
    script += "      else\n"
    script += "        # Return to the original directory\n"
    script += "        cd - > /dev/null\n"
    script += '      echo "  ⚠️ Output file not found or empty, keeping temp files for debugging"\n'
    script += '        echo "  Temp directory: $TMP_DIR"\n'
    script += "      fi\n"
    script += "    else\n"
    script += '      echo "  ❌ Failed to create montage for variation $i. Check the logs above for errors."\n'
    script += "      # Return to the original directory\n"
    script += "        cd - > /dev/null\n"
    script += '      echo "  Keeping temporary files for debugging at: $TMP_DIR"\n'
    script += "    fi\n"

    // STACKED layout - completely rewritten for better performance and continuous playback
    script += "  else\n"
    script += '    echo "  Using stacked layout: creating timed stacking montage..."\n'
    script += "    \n"
    script += "    # Check if we have any clips to work with\n"
    script += '  CLIP_COUNT=$(find "$TMP_DIR" -name "clip*.mp4" -type f | wc -l)\n'
    script += '  if [ "$CLIP_COUNT" -eq 0 ]; then\n'
    script += '    echo "  ❌ No clips found in temp directory. Skipping stacked montage."\n'
    script += '  rm -rf "$TMP_DIR"\n'
    script += "    continue\n"
    script += "  fi\n"
    script += "    \n"
    script += '  echo "  Found $CLIP_COUNT clips to include in stacked montage"\n'
    script += "    \n"
    script += "    # Create a list of all clips\n"
    script += '  CLIPS=( $(find "$TMP_DIR" -name "clip*.mp4" -type f | sort) )\n'
    script += "    \n"
    script += "    # Build input files array\n"
    script += "    INPUT_FILES=()\n"
    script += '  for clip in "${CLIPS[@]}"; do\n'
    script += '    INPUT_FILES+=(-i "$clip")\n'
    script += "    done\n"
    script += "    \n"
    script += "    # Create a filter complex for the stacked layout - FIXED FOR FULL CLIP PLAYBACK\n"
    script += "    # Start with a black background canvas\n"
    if (resolution !== "original") {
      const width = resolution === "1080p" ? "1920" : "1280"
      const height = resolution === "1080p" ? "1080" : "720"
      script += '    FILTER="color=s=' + width + ":" + height + ':d=${DURATION}:c=black[bg];"'
    } else {
      script += '    FILTER="color=s=${SOURCE_WIDTH}x${SOURCE_HEIGHT}:d=${DURATION}:c=black[bg];"'
    }
    script += "\n    \n"
    script += "    # Process all clips with proper scaling and positioning\n"
    script += "    SCALE_FACTOR=1.0\n"
    script += '  LAST_OUTPUT="bg"\n'
    script += "    \n"
    script += "    # Process clips in REVERSE order so newer clips appear on top\n"
    script += "    for i in $(seq $((${#CLIPS[@]} - 1)) -1 0); do\n"
    script += "      # Calculate appearance time (first clip at 0, others 1 second apart)\n"
    script += "      # Note: i is now in reverse order, so we need to adjust the appearance time\n"
    script += "      CLIP_INDEX=$((${#CLIPS[@]} - 1 - i))\n"
    script += "      if [ $CLIP_INDEX -eq 0 ]; then\n"
    script += "        APPEAR_TIME=0\n"
    script += "        SCALE_FACTOR=1.0\n"
    script += "      else\n"
    script += "        APPEAR_TIME=$CLIP_INDEX\n"
    script += "        # Calculate scale factor based on the clip index\n"
    script += "        SCALE_FACTOR=1.0\n"

    script += "        for j in $(seq 1 $CLIP_INDEX); do\n"
    script += '          SCALE_FACTOR=$(awk "BEGIN {printf \\"%.2f\\", $SCALE_FACTOR * 0.75}")\n'
    script += "        done\n"
    script += "      fi\n"
    script += "      \n"
    script += "      # Calculate scaled dimensions\n"
    script += '    SCALED_WIDTH=$(awk "BEGIN {printf \\"%d\\", $SOURCE_WIDTH * $SCALE_FACTOR}")\n'
    script += '    SCALED_HEIGHT=$(awk "BEGIN {printf \\"%d\\", $SOURCE_HEIGHT * $SCALE_FACTOR}")\n'
    script += "      \n"
    script += "      # For clips after the first, calculate position\n"
    script += "      if [ $CLIP_INDEX -gt 0 ]; then\n"
    script += "        # Calculate maximum position to ensure clip is within bounds\n"
    script += "        MAX_X=$(( SOURCE_WIDTH - SCALED_WIDTH ))\n"
    script += "        MAX_Y=$(( SOURCE_HEIGHT - SCALED_HEIGHT ))\n"
    script += "        \n"
    script += "        # Ensure MAX_X and MAX_Y are at least 0\n"
    script += "        if [ $MAX_X -lt 0 ]; then MAX_X=0; fi\n"
    script += "        if [ $MAX_Y -lt 0 ]; then MAX_Y=0; fi\n"
    script += "        \n"
    script += "        # Generate position (random or centered)\n"
    script += '      if [ "$RANDOM_POSITIONS" = "true" ]; then\n'
    script += "          X=$(( RANDOM % (MAX_X + 1) ))\n"
    script += "          Y=$(( RANDOM % (MAX_Y + 1) ))\n"
    script += "        else\n"
    script += "          # Center the clip\n"
    script += "          X=$(( (SOURCE_WIDTH - SCALED_WIDTH) / 2 ))\n"
    script += "          Y=$(( (SOURCE_HEIGHT - SCALED_HEIGHT) / 2 ))\n"
    script += "        fi\n"
    script += "      else\n"
    script += "        # First clip is centered and full size\n"
    script += "        X=0\n"
    script += "        Y=0\n"
    script += "      fi\n"
    script += "      \n"
    script += "      # Add to filter complex - FIXED for full clip playback using setpts\n"
    script += '    FILTER="${FILTER}[$i:v]setpts=PTS-STARTPTS+${APPEAR_TIME}/TB,"\n'
    script += "      # Then scale the video to the appropriate size\n"
    script += '    FILTER="${FILTER}scale=${SCALED_WIDTH}:${SCALED_HEIGHT}[v$i];"\n'
    script += "      \n"
    script += "      # Overlay the video on top of the previous output\n"
    script += '    FILTER="${FILTER}[$LAST_OUTPUT][v$i]overlay=${X}:${Y}[out$i];"\n'
    script += "      \n"
    script += "      # Update the last output name for the next iteration\n"
    script += '    LAST_OUTPUT="out$i"\n'
    script += "    done\n"
    script += "    \n"
    script += "    # Execute the ffmpeg command with the fixed filter complex\n"
    if (resolution !== "original") {
      const width = resolution === "1080p" ? "1920" : "1280"
      const height = resolution === "1080p" ? "1080" : "720"

      // Conditionally include or exclude the -an flag based on keepAudio for the final output
      if (keepAudio) {
        script +=
          '    if ffmpeg "${INPUT_FILES[@]}" -filter_complex "${FILTER}" -map "[${LAST_OUTPUT}]" -c:v libx264 -preset fast -pix_fmt yuv420p -t "${DURATION}" -vf "scale=' +
          width +
          ":" +
          height +
          ":force_original_aspect_ratio=decrease,pad=" +
          width +
          ":" +
          height +
          ':(ow-iw)/2:(oh-ih)/2" "${OUTPUT}"; then\n'
      } else {
        script +=
          '    if ffmpeg "${INPUT_FILES[@]}" -filter_complex "${FILTER}" -map "[${LAST_OUTPUT}]" -c:v libx264 -preset fast -pix_fmt yuv420p -an -t "${DURATION}" -vf "scale=' +
          width +
          ":" +
          height +
          ":force_original_aspect_ratio=decrease,pad=" +
          width +
          ":" +
          height +
          ':(ow-iw)/2:(oh-ih)/2" "${OUTPUT}"; then\n'
      }
    } else {
      // Conditionally include or exclude the -an flag based on keepAudio for the final output
      if (keepAudio) {
        script +=
          '    if ffmpeg "${INPUT_FILES[@]}" -filter_complex "${FILTER}" -map "[${LAST_OUTPUT}]" -c:v libx264 -preset fast -pix_fmt yuv420p -t "${DURATION}" "${OUTPUT}"; then\n'
      } else {
        script +=
          '    if ffmpeg "${INPUT_FILES[@]}" -filter_complex "${FILTER}" -map "[${LAST_OUTPUT}]" -c:v libx264 -preset fast -pix_fmt yuv420p -an -t "${DURATION}" "${OUTPUT}"; then\n'
      }
    }
    script += '      echo "  ✅ Stacked montage created: $OUTPUT"\n'
    script += '      echo "  Duration: ${DURATION}s, Clips: ${#CLIPS[@]}"\n'
    script += '      echo "  Cleaning up temporary files..."\n'
    script += '      rm -rf "$TMP_DIR"\n'
    script += "    else\n"
    script += '      echo "  ❌ Failed to create stacked montage. Keeping temp files for debugging at: $TMP_DIR"\n'
    script += "    fi\n"
    script += "  fi\n"
    script += "done\n\n"

    script += "# Only clean up YouTube temp directory if not in debug mode\n"
    script += 'if [ "$DEBUG_MODE" = "false" ] && [ -n "$YT_TMP_DIR" ] && [ -d "$YT_TMP_DIR" ]; then\n'
    script += '  echo "Cleaning up YouTube temporary files..."\n'
    script += '  rm -rf "$YT_TMP_DIR"\n'
    script += "fi\n\n"

    script += 'echo "\n✨ Finished generating $VARIATIONS montage variations"\n'
    script += 'echo "Files saved to: $OUTPUT_DIR"\n'
    script += 'echo "\n🎬 Your montages are ready! Open them in your video player to view."\n'

    // Set the generated script
    setGeneratedScript(script)

    // Set default filename - Fixed to use string concatenation instead of template literals
    if (customFilename) {
      setScriptFilename(customFilename + "_montage.sh")
    } else {
      setScriptFilename(
        "montage_" +
          (montageType === "fixed" ? "fixed" + interval : "bpm" + bpm) +
          "_" +
          layoutType +
          "_" +
          (linearMode ? "linear" : "random") +
          "_" +
          montageLength +
          "s_" +
          variations +
          "var.sh",
      )
    }
  }

  // Copy command to clipboard with platform selection
  const copyCommand = (platform: "mac" | "pc") => {
    const command =
      platform === "mac"
        ? `cd ~/Downloads && chmod +x ${scriptFilename} && ./${scriptFilename}`
        : `cd ~/Downloads && bash ${scriptFilename}`

    navigator.clipboard.writeText(command)
    setCopyNotification(`${platform.toUpperCase()} command copied!`)

    // Clear notification after 3 seconds
    setTimeout(() => {
      setCopyNotification("")
    }, 3000)
  }

  // Prepare download with custom filename
  const prepareDownload = () => {
    setIsDownloadDialogOpen(true)
  }

  // Download script as a file with custom filename
  const downloadScript = () => {
    const element = document.createElement("a")
    const file = new Blob([generatedScript], { type: "text/plain" })
    element.href = URL.createObjectURL(file)
    element.download = scriptFilename
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    setIsDownloadDialogOpen(false)
  }

  return (
    <div className="space-y-8">
      {/* Video Source */}
      <div className="border border-gray-300 p-6 rounded">
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-4">Video Sources</h2>
          <p className="text-sm text-gray-600 mb-4">
            Add up to 5 video links (YouTube, Dropbox, or direct video URLs). If multiple links are provided, a random
            one will be selected.
          </p>

          {videoLinks.map((link, index) => (
            <div key={index} className="flex items-center gap-2 mb-3">
              <Input
                value={link}
                onChange={(e) => updateVideoLink(index, e.target.value)}
                placeholder="https://youtube.com/... or https://www.dropbox.com/s/..."
                className="border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {videoLinks.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeVideoLink(index)}
                  className="border-gray-400 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {videoLinks.length < 5 && (
            <Button
              type="button"
              variant="outline"
              onClick={addVideoLink}
              className="mt-2 border-gray-400 text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Source
            </Button>
          )}

          <p className="text-xs mt-3 text-gray-600">
            Supported formats: YouTube links, Dropbox links (automatically converted), and direct video URLs
          </p>
        </div>

        {/* Clip Selection */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-4">Clip Selection</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="start-cut-at" className="text-sm font-normal">
                Start Cut At (seconds)
              </Label>
              <Input
                id="start-cut-at"
                type="number"
                value={startCutAt}
                onChange={(e) => setStartCutAt(e.target.value)}
                placeholder="180"
                className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs mt-1 text-gray-600">Exclude the first X seconds of the video</p>
            </div>

            <div>
              <Label htmlFor="end-cut-at" className="text-sm font-normal">
                End Cut At (seconds)
              </Label>
              <Input
                id="end-cut-at"
                type="number"
                value={endCutAt}
                onChange={(e) => setEndCutAt(e.target.value)}
                placeholder="300"
                className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs mt-1 text-gray-600">Exclude the last X seconds of the video</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 mt-4">
            <Switch id="linear-mode" checked={linearMode} onCheckedChange={setLinearMode} />
            <Label htmlFor="linear-mode" className="text-sm font-normal">
              Use Linear Clip Selection
            </Label>
          </div>
          <p className="text-xs mt-1 text-gray-600">Select clips in a linear fashion instead of randomly</p>
        </div>

        {/* Montage Logic */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-4">Montage Logic</h2>
          <RadioGroup value={montageType} onValueChange={setMontageType} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="fixed" className="text-blue-600 border-gray-400" />
              <Label htmlFor="fixed" className="text-sm font-normal">
                Fixed Interval
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="bpm" id="bpm" className="text-blue-600 border-gray-400" />
              <Label htmlFor="bpm" className="text-sm font-normal">
                BPM Synced
              </Label>
            </div>
          </RadioGroup>

          {montageType === "fixed" ? (
            <div className="mt-4">
              <Label htmlFor="interval" className="text-sm font-normal">
                Interval Duration (seconds)
              </Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger
                  id="interval"
                  className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="0.5" className="text-black hover:bg-blue-50">
                    0.5
                  </SelectItem>
                  <SelectItem value="0.75" className="text-black hover:bg-blue-50">
                    0.75
                  </SelectItem>
                  <SelectItem value="1" className="text-black hover:bg-blue-50">
                    1
                  </SelectItem>
                  <SelectItem value="1.5" className="text-black hover:bg-blue-50">
                    1.5
                  </SelectItem>
                  <SelectItem value="2" className="text-black hover:bg-blue-50">
                    2
                  </SelectItem>
                  <SelectItem value="5" className="text-black hover:bg-blue-50">
                    5
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mt-4">
              <Label htmlFor="bpm-input" className="text-sm font-normal">
                Enter BPM (beats per minute)
              </Label>
              <div className="flex mt-2 gap-2">
                <Input
                  id="bpm-input"
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  min="60"
                  max="200"
                  className="border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.open("https://www.chosic.com/song-bpm-key-finder/", "_blank")}
                  className="whitespace-nowrap border-gray-400 text-blue-600 hover:bg-blue-50"
                >
                  Check BPM
                </Button>
              </div>
              <p className="text-xs mt-1 text-gray-600">
                Not sure about the BPM? Click "Check BPM" to find the tempo of any Spotify song.
              </p>
            </div>
          )}
        </div>

        {/* Montage Layout Type */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-4">Montage Layout Type</h2>
          <Select value={layoutType} onValueChange={setLayoutType}>
            <SelectTrigger className="border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <SelectValue placeholder="Select layout type" />
            </SelectTrigger>
            <SelectContent className="bg-white border-gray-300">
              <SelectItem value="cut" className="text-black hover:bg-blue-50">
                Cut to Each Clip
              </SelectItem>
              <SelectItem value="stacked" className="text-black hover:bg-blue-50">
                Stacked Layers
              </SelectItem>
            </SelectContent>
          </Select>

          {layoutType === "stacked" && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="position-type" className="text-sm font-normal">
                  Position Type
                </Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="position-type" className="text-xs text-gray-600">
                    Centered
                  </Label>
                  <Switch id="position-type" checked={useRandomPositions} onCheckedChange={setUseRandomPositions} />
                  <Label htmlFor="position-type" className="text-xs text-gray-600">
                    Random
                  </Label>
                </div>
              </div>
              <p className="text-xs mt-1 text-gray-600">Choose how clips are positioned in the stacked layout</p>
            </div>
          )}
        </div>

        {/* Output Settings */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-4">Output Settings</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="length" className="text-sm font-normal">
                Montage Length
              </Label>
              <Select value={montageLength} onValueChange={setMontageLength}>
                <SelectTrigger
                  id="length"
                  className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <SelectValue placeholder="Select length" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="15" className="text-black hover:bg-blue-50">
                    15 seconds
                  </SelectItem>
                  <SelectItem value="25" className="text-black hover:bg-blue-50">
                    25 seconds
                  </SelectItem>
                  <SelectItem value="30" className="text-black hover:bg-blue-50">
                    30 seconds
                  </SelectItem>
                  <SelectItem value="35" className="text-black hover:bg-blue-50">
                    35 seconds
                  </SelectItem>
                  <SelectItem value="45" className="text-black hover:bg-blue-50">
                    45 seconds
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="resolution" className="text-sm font-normal">
                Output Resolution
              </Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger
                  id="resolution"
                  className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="original" className="text-black hover:bg-blue-50">
                    Original
                  </SelectItem>
                  <SelectItem value="720p" className="text-black hover:bg-blue-50">
                    720p
                  </SelectItem>
                  <SelectItem value="1080p" className="text-black hover:bg-blue-50">
                    1080p
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Switch id="keep-audio" checked={keepAudio} onCheckedChange={setKeepAudio} />
                <Label htmlFor="keep-audio" className="text-sm font-normal">
                  Keep Audio
                </Label>
              </div>
              <p className="text-xs mt-1 text-gray-600">Keep the audio from the original video in the montage</p>
            </div>

            <div>
              <Label htmlFor="variations" className="text-sm font-normal">
                Number of Variations
              </Label>
              <Select value={variations} onValueChange={setVariations}>
                <SelectTrigger
                  id="variations"
                  className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <SelectValue placeholder="Select number of variations" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-300">
                  <SelectItem value="1" className="text-black hover:bg-blue-50">
                    1
                  </SelectItem>
                  <SelectItem value="2" className="text-black hover:bg-blue-50">
                    2
                  </SelectItem>
                  <SelectItem value="3" className="text-black hover:bg-blue-50">
                    3
                  </SelectItem>
                  <SelectItem value="4" className="text-black hover:bg-blue-50">
                    4
                  </SelectItem>
                  <SelectItem value="5" className="text-black hover:bg-blue-50">
                    5
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="custom-filename" className="text-sm font-normal">
              Custom Filename
            </Label>
            <Input
              id="custom-filename"
              type="text"
              value={customFilename}
              onChange={(e) => setCustomFilename(e.target.value)}
              placeholder="MyMontage"
              className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs mt-1 text-gray-600">Customize the output filename (optional)</p>
          </div>
        </div>

        {/* Generate Montage Button */}
        <div className="mt-6">
          <Button
            onClick={generateMontage}
            disabled={isGenerating || videoLinks[0].trim() === ""}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            {isGenerating ? "Generating Montage..." : "Generate Montage"}
          </Button>
        </div>

        {/* Job Status */}
        {jobId && (
          <div className="mt-6 p-4 border border-gray-300 rounded">
            <h3 className="text-base font-medium mb-2">Montage Generation Status</h3>

            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm">Status: {jobStatus}</span>
                <span className="text-sm">{Math.round(jobProgress)}%</span>
              </div>
              <Progress value={jobProgress} className="h-2" />
            </div>

            {jobError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{jobError}</AlertDescription>
              </Alert>
            )}

            {downloadUrl && (
              <Button
                onClick={() => window.open(downloadUrl, "_blank")}
                className="bg-green-600 hover:bg-green-700 text-white w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Montage
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
