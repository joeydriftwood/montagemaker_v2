"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Download, Loader2, Plus, Trash2, FileText, Copy, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Slider } from "@/components/ui/slider"

export function MontageGenerator() {
  const { toast } = useToast()

  // Form state
  const [videoLinks, setVideoLinks] = useState<string[]>([""])
  const [montageType, setMontageType] = useState<string>("fixed")
  const [layoutType, setLayoutType] = useState<string>("cut")
  const [useRandomPositions, setUseRandomPositions] = useState<boolean>(false)
  const [interval, setInterval] = useState<string>("1")
  const [bpm, setBpm] = useState<string>("120")
  const [montageLength, setMontageLength] = useState<string>("30")
  const [keepAudio, setKeepAudio] = useState<boolean>(true)
  const [resolution, setResolution] = useState<string>("720p")
  const [linearMode, setLinearMode] = useState<boolean>(true)
  const [customFilename, setCustomFilename] = useState<string>("montage")
  const [folderName, setFolderName] = useState<string>("montages")
  const [startCutAt, setStartCutAt] = useState<string>("0")
  const [endCutAt, setEndCutAt] = useState<string>("60")
  const [variations, setVariations] = useState<string>("1")
  const [addCopyrightLine, setAddCopyrightLine] = useState<boolean>(false)

  // Text overlay settings
  const [textOverlay, setTextOverlay] = useState<string>("")
  const [textFont, setTextFont] = useState<string>("Arial")
  const [textSize, setTextSize] = useState<number[]>([48])
  const [textOutline, setTextOutline] = useState<boolean>(true)

  // Job state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<number>(0)
  const [jobError, setJobError] = useState<string>("")
  const [downloadUrl, setDownloadUrl] = useState<string>("")

  // Script generation state
  const [lastGeneratedScript, setLastGeneratedScript] = useState<string>("")
  const [commandCopied, setCommandCopied] = useState<boolean>(false)

  // Add video link field
  const addVideoLink = () => {
    setVideoLinks([...videoLinks, ""])
  }

  // Remove video link field
  const removeVideoLink = (index: number) => {
    const newLinks = [...videoLinks]
    newLinks.splice(index, 1)
    if (newLinks.length === 0) {
      newLinks.push("")
    }
    setVideoLinks(newLinks)
  }

  // Update video link
  const updateVideoLink = (index: number, value: string) => {
    const newLinks = [...videoLinks]
    newLinks[index] = value
    setVideoLinks(newLinks)
  }

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
  }

  // Get aspect ratio for preview
  const getAspectRatio = () => {
    const { width, height } = getResolutionDimensions()
    return width / height
  }

  // Copy command to clipboard
  const copyCommand = async () => {
    if (!lastGeneratedScript) return

    const command = `cd ~/Downloads && chmod +x ${lastGeneratedScript} && ./${lastGeneratedScript}`

    try {
      await navigator.clipboard.writeText(command)
      setCommandCopied(true)
      toast({
        title: "Command Copied!",
        description: `Terminal command copied to clipboard`,
      })

      // Reset the copied state after 3 seconds
      setTimeout(() => setCommandCopied(false), 3000)
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard. Please copy manually.",
        variant: "destructive",
      })
    }
  }

  // Generate local script
  const generateLocalScript = () => {
    if (videoLinks[0].trim() === "") {
      toast({
        title: "Error",
        description: "Please enter at least one video URL",
        variant: "destructive",
      })
      return
    }

    // Clean filename and ensure it has .sh extension
    const cleanFilename = customFilename.replace(/[^a-zA-Z0-9_-]/g, "_")
    const scriptFilename = cleanFilename.endsWith(".sh") ? cleanFilename : `${cleanFilename}.sh`
    
    // Clean folder name for safe use in file paths
    const cleanFolderName = folderName.replace(/[^a-zA-Z0-9_-]/g, "_") || "montages"

    const { width, height } = getResolutionDimensions()
    const clipDuration = montageType === "fixed" ? Number.parseFloat(interval) : 60 / Number.parseInt(bpm)
    const numClips = Math.ceil(Number.parseInt(montageLength) / clipDuration)

    // Clean YouTube URLs to remove playlist parameters
    const cleanVideoUrls = videoLinks
      .filter((url) => url.trim())
      .map((url) => {
        const trimmedUrl = url.trim()
        // Remove playlist parameters from YouTube URLs
        if (trimmedUrl.includes('youtube.com') || trimmedUrl.includes('youtu.be')) {
          try {
            const urlObj = new URL(trimmedUrl)
            // Keep only the video ID parameter
            const videoId = urlObj.searchParams.get('v')
            if (videoId) {
              return `"https://www.youtube.com/watch?v=${videoId}"`
            }
          } catch (e) {
            // If URL parsing fails, return original
            return `"${trimmedUrl}"`
          }
        }
        return `"${trimmedUrl}"`
      })

    const script = `#!/bin/bash
# Generated Montage Script
# Created: ${new Date().toLocaleString()}

set -e  # Exit on any error

# Configuration
SOURCE_URLS=(${cleanVideoUrls.join(" ")})
OUTPUT_DIR="$HOME/Downloads/${cleanFolderName}"
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
CUSTOM_FILENAME="${customFilename}"
ADD_COPYRIGHT_LINE=${addCopyrightLine ? "true" : "false"}
TEXT_OVERLAY="${textOverlay}"
TEXT_FONT="${textFont}"
TEXT_SIZE=${textSize[0]}
TEXT_OUTLINE=${textOutline ? "true" : "false"}
VARIATIONS=${variations}

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
            
        elif [[ "\$url" == *"dropbox.com"* ]]; then
            # Dropbox link - convert share link to direct download
            local direct_url="\$url"
            
            # Convert Dropbox share link to direct download link
            if [[ "\$url" == *"dropbox.com/s/"* ]]; then
                # Replace dropbox.com with dl.dropboxusercontent.com and remove ?dl=0
                direct_url=\$(echo "\$url" | sed 's/dropbox\\.com/dl.dropboxusercontent.com/g' | sed 's/?dl=0//g')
            elif [[ "\$url" == *"?dl=0"* ]]; then
                # Just change dl=0 to dl=1
                direct_url=\$(echo "\$url" | sed 's/?dl=0/?dl=1/g')
            fi
            
            print_status "Converted Dropbox URL: \$direct_url"
            
            # Download with curl, following redirects
            if curl -L -f "\$direct_url" -o "\$output_file"; then
                print_success "Downloaded from Dropbox"
            else
                print_error "Failed to download from Dropbox. Try using a direct download link."
                exit 1
            fi
            
        elif [[ "\$url" == *"drive.google.com"* ]]; then
            # Google Drive link
            print_status "Detected Google Drive link"
            
            # Extract file ID from various Google Drive URL formats
            local file_id=""
            if [[ "\$url" == *"/file/d/"* ]]; then
                file_id=\$(echo "\$url" | sed -n 's/.*\\/file\\/d\\/([^\\/]*).*/\\1/p')
            elif [[ "\$url" == *"id="* ]]; then
                file_id=\$(echo "\$url" | sed -n 's/.*id=\$$[^&]*\$$.*/\\1/p')
            fi
            
            if [[ -n "\$file_id" ]]; then
                local gdrive_url="https://drive.google.com/uc?export=download&id=\$file_id"
                print_status "Using Google Drive direct URL: \$gdrive_url"
                
                if curl -L -f "\$gdrive_url" -o "\$output_file"; then
                    print_success "Downloaded from Google Drive"
                else
                    print_error "Failed to download from Google Drive. File may be too large or require permissions."
                    exit 1
                fi
            else
                print_error "Could not extract file ID from Google Drive URL"
                exit 1
            fi
            
        else
            # Direct video URL or other services
            print_status "Downloading as direct URL"
            
            # Try with curl first
            if curl -L -f "\$url" -o "\$output_file"; then
                print_success "Downloaded via direct URL"
            else
                print_warning "Direct download failed, trying with yt-dlp..."
                # Try with yt-dlp as fallback (supports many sites)
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
    
    # Open output directory
    if command -v open &> /dev/null; then
        open "\$OUTPUT_DIR"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "\$OUTPUT_DIR"
    fi
}

# Run main function
main "$@"
`

    // Create and download the script
    const blob = new Blob([script], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = scriptFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Store the generated script filename
    setLastGeneratedScript(scriptFilename)
    setCommandCopied(false)

    toast({
      title: "Script Generated!",
      description: `Downloaded ${scriptFilename} - Use the copy command button to get terminal instructions`,
    })
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

    // Clear previous job state
    setIsGenerating(true)
    setJobStatus("pending")
    setJobProgress(0)
    setJobError("")
    setDownloadUrl("")

    try {
      console.log("Sending request to /api/generate-montage")

      const response = await fetch("/api/generate-montage", {
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
          addCopyrightLine,
          textOverlay,
          textFont,
          textSize: textSize[0],
          textOutline,
        }),
      })

      console.log("Response status:", response.status)

      // Check if the response is JSON
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        // Handle non-JSON response
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 500))
        throw new Error(`Server returned non-JSON response (${response.status}).`)
      }

      const data = await response.json()
      console.log("Response data:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to start montage generation")
      }

      setJobId(data.jobId)
      console.log("Job ID set:", data.jobId)

      // Poll for job status
      const statusInterval = setInterval(() => {
        const pollStatus = async () => {
          try {
            console.log("Polling job status for:", data.jobId)
            const statusResponse = await fetch(`/api/job-status?jobId=${data.jobId}`)

            // Check if the status response is JSON
            const statusContentType = statusResponse.headers.get("content-type")
            if (!statusContentType || !statusContentType.includes("application/json")) {
              const text = await statusResponse.text()
              console.error("Non-JSON status response:", text.substring(0, 500))
              throw new Error(`Server returned non-JSON status response (${statusResponse.status})`)
            }

            const statusData = await statusResponse.json()
            console.log("Job status update:", statusData)

            if (!statusResponse.ok) {
              throw new Error(statusData.error || "Failed to get job status")
            }

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

                // Trigger download if available
                if (statusData.downloadUrl) {
                  const a = document.createElement("a")
                  a.href = statusData.downloadUrl
                  a.download = customFilename || "montage.mp4"
                  document.body.appendChild(a)
                  a.click()
                  document.body.removeChild(a)
                }
              } else if (statusData.status === "failed") {
                toast({
                  title: "Error",
                  description: statusData.error || "Failed to generate montage",
                  variant: "destructive",
                })
              }
            }
          } catch (error) {
            console.error("Error polling job status:", error)
            clearInterval(statusInterval)
            setIsGenerating(false)
            setJobStatus("failed")
            setJobError((error as Error).message || "Failed to check job status")
            toast({
              title: "Error",
              description: (error as Error).message || "Failed to check job status",
              variant: "destructive",
            })
          }
        }
        pollStatus()
      }, 1000) // Poll every 1 second instead of 2
    } catch (error) {
      console.error("Error starting montage generation:", error)
      setIsGenerating(false)
      setJobStatus("failed")
      setJobError((error as Error).message || "Failed to start montage generation")
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to start montage generation",
        variant: "destructive",
      })
    }
  }

  const renderMontagePreview = () => {
    const { label } = getResolutionDimensions()
    const aspectRatio = getAspectRatio()

    if (layoutType === "cut") {
      // Sequential cut layout - single video frame
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Preview</h3>
          <div className="bg-gray-100 p-6 rounded-lg">
            <div className="relative w-full max-w-md mx-auto">
              <div
                className="relative bg-gray-300 border-2 border-gray-400 rounded-lg overflow-hidden"
                style={{ aspectRatio: aspectRatio }}
              >
                {/* Copyright line */}
                {addCopyrightLine && (
                  <div
                    className="absolute left-0 right-0 bg-black"
                    style={{
                      top: "25%",
                      height: "2px",
                      zIndex: 10,
                    }}
                  />
                )}

                {/* Video content placeholder */}
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm font-medium">
                  Montage Clips
                  <br />({montageType === "fixed" ? `${interval}s` : `${60 / Number.parseInt(bpm)}s`} intervals)
                </div>

                {/* Text overlay */}
                {textOverlay && (
                  <div
                    className="absolute inset-0 flex items-center justify-center z-20"
                    style={{
                      fontFamily: textFont,
                      fontSize: `${Math.max(textSize[0] * 0.2, 10)}px`, // Scale down for preview
                      color: "white",
                      textShadow: textOutline
                        ? "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8), -1px 1px 2px rgba(0,0,0,0.8)"
                        : "none",
                      textAlign: "center",
                      padding: "10px",
                      wordBreak: "break-word",
                    }}
                  >
                    {textOverlay}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">Sequential Layout ({label})</p>
            </div>
          </div>
        </div>
      )
    } else {
      // Grid layout - multiple video frames
      const videoCount = Math.min(videoLinks.filter((link) => link.trim()).length, 4) // Max 4 for grid
      const gridCols = videoCount <= 1 ? 1 : videoCount <= 2 ? 2 : 2
      const gridRows = Math.ceil(videoCount / gridCols)

      return (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Preview</h3>
          <div className="bg-gray-100 p-6 rounded-lg">
            <div className="relative w-full max-w-md mx-auto">
              <div
                className="relative bg-gray-800 border-2 border-gray-400 rounded-lg overflow-hidden"
                style={{ aspectRatio: aspectRatio }}
              >
                {/* Copyright line */}
                {addCopyrightLine && (
                  <div
                    className="absolute left-0 right-0 bg-black"
                    style={{
                      top: "25%",
                      height: "2px",
                      zIndex: 10,
                    }}
                  />
                )}

                {/* Grid layout */}
                <div
                  className="absolute inset-0 grid gap-1 p-1"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${gridRows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: videoCount }, (_, i) => (
                    <div
                      key={i}
                      className="bg-gray-400 rounded flex items-center justify-center text-xs text-gray-700 font-medium"
                    >
                      Video {i + 1}
                    </div>
                  ))}
                </div>

                {/* Text overlay */}
                {textOverlay && (
                  <div
                    className="absolute inset-0 flex items-center justify-center z-20"
                    style={{
                      fontFamily: textFont,
                      fontSize: `${Math.max(textSize[0] * 0.2, 10)}px`, // Scale down for preview
                      color: "white",
                      textShadow: textOutline
                        ? "1px 1px 2px rgba(0,0,0,0.8), -1px -1px 2px rgba(0,0,0,0.8), 1px -1px 2px rgba(0,0,0,0.8), -1px 1px 2px rgba(0,0,0,0.8)"
                        : "none",
                      textAlign: "center",
                      padding: "10px",
                      wordBreak: "break-word",
                    }}
                  >
                    {textOverlay}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Grid Layout - {videoCount} Video{videoCount !== 1 ? "s" : ""} ({label})
              </p>
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Panel */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {/* Video Sources */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Video Sources</h3>

                {videoLinks.map((link, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={link}
                      onChange={(e) => updateVideoLink(index, e.target.value)}
                      placeholder="Enter YouTube, Dropbox, Google Drive, or direct video URL"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeVideoLink(index)}
                      disabled={videoLinks.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button variant="outline" onClick={addVideoLink} className="w-full bg-transparent">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Another Video
                </Button>
              </div>

              {/* Montage Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Montage Settings</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="montageType">Montage Type</Label>
                    <Select value={montageType} onValueChange={setMontageType}>
                      <SelectTrigger id="montageType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Interval</SelectItem>
                        <SelectItem value="bpm">BPM-based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="layoutType">Layout Type</Label>
                    <Select value={layoutType} onValueChange={setLayoutType}>
                      <SelectTrigger id="layoutType">
                        <SelectValue placeholder="Select layout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cut">Cut (Sequential)</SelectItem>
                        <SelectItem value="grid">Grid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {montageType === "fixed" ? (
                    <div className="space-y-2">
                      <Label htmlFor="interval">Interval (seconds)</Label>
                      <Input
                        id="interval"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="bpm">BPM</Label>
                      <Input
                        id="bpm"
                        type="number"
                        min="60"
                        max="240"
                        value={bpm}
                        onChange={(e) => setBpm(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="montageLength">Montage Length (seconds)</Label>
                    <Input
                      id="montageLength"
                      type="number"
                      min="1"
                      max="300"
                      value={montageLength}
                      onChange={(e) => setMontageLength(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startCutAt">Start Cut At (seconds)</Label>
                    <Input
                      id="startCutAt"
                      type="number"
                      min="0"
                      value={startCutAt}
                      onChange={(e) => setStartCutAt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endCutAt">End Cut At (seconds)</Label>
                    <Input
                      id="endCutAt"
                      type="number"
                      min="0"
                      value={endCutAt}
                      onChange={(e) => setEndCutAt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolution">Resolution</Label>
                    <Select value={resolution} onValueChange={setResolution}>
                      <SelectTrigger id="resolution">
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">Original</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="480p">480p</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="variations">Number of Variations</Label>
                    <Input
                      id="variations"
                      type="number"
                      min="1"
                      max="5"
                      value={variations}
                      onChange={(e) => setVariations(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="folderName">Folder Name (in Downloads)</Label>
                    <Input
                      id="folderName"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="e.g., my_montages"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customFilename">Custom Filename</Label>
                    <Input
                      id="customFilename"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      placeholder="e.g., daddy"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch id="keepAudio" checked={keepAudio} onCheckedChange={setKeepAudio} />
                    <Label htmlFor="keepAudio">Keep Audio</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="linearMode" checked={linearMode} onCheckedChange={setLinearMode} />
                    <Label htmlFor="linearMode">Linear Mode</Label>
                  </div>

                  {layoutType === "grid" && (
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="randomPositions"
                        checked={useRandomPositions}
                        onCheckedChange={setUseRandomPositions}
                      />
                      <Label htmlFor="randomPositions">Random Positions</Label>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="copyrightLine" checked={addCopyrightLine} onCheckedChange={setAddCopyrightLine} />
                  <Label htmlFor="copyrightLine">Add Copyright Line (Top 25%)</Label>
                </div>
              </div>

              {/* Text Overlay Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Text Overlay</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="textOverlay">Overlay Text</Label>
                    <Input
                      id="textOverlay"
                      value={textOverlay}
                      onChange={(e) => setTextOverlay(e.target.value)}
                      placeholder="Enter text to overlay on video"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="textFont">Font</Label>
                      <Select value={textFont} onValueChange={setTextFont}>
                        <SelectTrigger id="textFont">
                          <SelectValue placeholder="Select font" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Helvetica">Helvetica</SelectItem>
                          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                          <SelectItem value="Courier New">Courier New</SelectItem>
                          <SelectItem value="Verdana">Verdana</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                          <SelectItem value="Comic Sans MS">Comic Sans MS</SelectItem>
                          <SelectItem value="Impact">Impact</SelectItem>
                          <SelectItem value="Trebuchet MS">Trebuchet MS</SelectItem>
                          <SelectItem value="Tahoma">Tahoma</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="textSize">Font Size: {textSize[0]}px</Label>
                      <Slider
                        id="textSize"
                        min={12}
                        max={120}
                        step={2}
                        value={textSize}
                        onValueChange={setTextSize}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="textOutline" checked={textOutline} onCheckedChange={setTextOutline} />
                    <Label htmlFor="textOutline">Add Text Outline</Label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={generateLocalScript}
                  disabled={videoLinks[0].trim() === ""}
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Local Script
                </Button>

                {/* Copy Command Button - Only show after script generation */}
                {lastGeneratedScript && (
                  <Button
                    onClick={copyCommand}
                    variant="outline"
                    className="w-full border-green-600 text-green-600 hover:bg-green-50 bg-transparent"
                  >
                    {commandCopied ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Command Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Terminal Command
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={generateMontage}
                  disabled={isGenerating || videoLinks[0].trim() === ""}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Montage...
                    </>
                  ) : (
                    "Generate Montage (Cloud)"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardContent className="pt-6">{renderMontagePreview()}</CardContent>
        </Card>
      </div>

      {/* Job Status */}
      {(jobId || jobError) && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {jobId &&
              (() => {
                console.log("jobProgress type:", typeof jobProgress, jobProgress)
                return (
                  <div>
                    <h3 className="text-lg font-medium">Job Status: {jobStatus}</h3>
                    <Progress value={jobProgress} className="mt-2" />
                    <p className="text-sm text-gray-500 mt-1">Progress: {jobProgress}%</p>
                  </div>
                )
              })()}

            {jobError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{jobError}</AlertDescription>
              </Alert>
            )}

            {downloadUrl && (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-green-600 font-medium">Your montage is ready!</p>
                <Button asChild>
                  <a href={downloadUrl} download={customFilename || "montage.mp4"}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Montage
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
