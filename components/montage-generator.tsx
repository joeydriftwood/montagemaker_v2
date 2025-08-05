"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertCircle, Download, Loader2, Plus, Trash2, Cloud, FolderOpen } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Slider } from "@/components/ui/slider"

export function MontageGenerator() {
  const { toast } = useToast()

  // Form state
  const [videoLinks, setVideoLinks] = useState<string[]>([""])
  const [montageType, setMontageType] = useState<string>("fixed")
  const [layoutType, setLayoutType] = useState<string>("cut")
  const [interval, setInterval] = useState<string>("1")
  const [bpm, setBpm] = useState<string>("120")
  const [montageLength, setMontageLength] = useState<string>("30")
  const [startCutAt, setStartCutAt] = useState<string>("0")
  const [endCutAt, setEndCutAt] = useState<string>("60")
  const [resolution, setResolution] = useState<string>("720p")
  const [variations, setVariations] = useState<string>("1")
  const [folderName, setFolderName] = useState<string>("montages")
  const [customFilename, setCustomFilename] = useState<string>("montage")
  const [keepAudio, setKeepAudio] = useState<boolean>(true)
  const [linearMode, setLinearMode] = useState<boolean>(true)
  const [addCopyright, setAddCopyright] = useState<boolean>(false)
  const [overlayText, setOverlayText] = useState<string>("")
  const [font, setFont] = useState<string>("Arial")
  const [fontSize, setFontSize] = useState<number[]>([48])
  const [addTextOutline, setAddTextOutline] = useState<boolean>(false)

  // Job state
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<number>(0)
  const [jobError, setJobError] = useState<string>("")
  const [downloadUrl, setDownloadUrl] = useState<string>("")
  const [scriptGenerated, setScriptGenerated] = useState<boolean>(false)
  const [scriptFilename, setScriptFilename] = useState<string>("")

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

  // Generate local script
  const generateLocalScript = async () => {
    if (videoLinks[0].trim() === "") {
      toast({
        title: "Error",
        description: "Please enter at least one video URL",
        variant: "destructive",
      })
      return
    }

    try {
      // Create the script content based on the form parameters
      const scriptContent = generateMontageScript({
        videoUrls: videoLinks.filter(link => link.trim() !== ""),
        montageType,
        layoutType,
        interval: Number.parseFloat(interval),
        bpm: Number.parseFloat(bpm),
        montageLength: Number.parseInt(montageLength),
        startCutAt: Number.parseFloat(startCutAt),
        endCutAt: Number.parseFloat(endCutAt),
        resolution,
        variations: Number.parseInt(variations),
        folderName,
        customFilename,
        keepAudio,
        linearMode,
        addCopyright,
        overlayText,
        font,
        fontSize: fontSize[0],
        addTextOutline,
      })

      // Create and download the script file
      const scriptFilename = `${customFilename || 'montage'}_script.sh`
      const blob = new Blob([scriptContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = scriptFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Set script generated state
      setScriptGenerated(true)
      setScriptFilename(scriptFilename)

      toast({
        title: "Script Generated!",
        description: `Montage script downloaded as ${scriptFilename}`,
      })
    } catch (error) {
      console.error("Error generating script:", error)
      toast({
        title: "Error",
        description: "Failed to generate script",
        variant: "destructive",
      })
    }
  }

  // Copy run commands to clipboard
  const copyRunCommand = async (platform: 'mac' | 'pc') => {
    const filename = scriptFilename.replace('.sh', '')
    let command = ''
    
    if (platform === 'mac') {
      command = `chmod +x ~/Downloads/${scriptFilename} && ~/Downloads/${scriptFilename}`
    } else {
      command = `bash ~/Downloads/${scriptFilename}`
    }
    
    try {
      await navigator.clipboard.writeText(command)
      toast({
        title: `${platform === 'mac' ? 'Mac' : 'PC'} Command Copied!`,
        description: `Paste the command in your terminal and press Enter`,
      })
    } catch (error) {
      console.error('Failed to copy command:', error)
      toast({
        title: "Copy Failed",
        description: "Please copy the command manually",
        variant: "destructive",
      })
    }
  }

  // Generate the actual montage script
  const generateMontageScript = (params: any) => {
    const {
      videoUrls,
      montageType,
      layoutType,
      interval,
      bpm,
      montageLength,
      startCutAt,
      endCutAt,
      resolution,
      variations,
      folderName,
      customFilename,
      keepAudio,
      linearMode,
      addCopyright,
      overlayText,
      font,
      fontSize,
      addTextOutline,
    } = params

    const scriptName = customFilename || 'montage'
    const outputFolder = folderName || 'montages'
    
    // Calculate resolution dimensions
    const resolutionMap: { [key: string]: string } = {
      '480p': '854x480',
      '720p': '1280x720', 
      '1080p': '1920x1080'
    }
    const targetResolution = resolutionMap[resolution] || '1280x720'

    // Calculate interval based on montage type
    let clipInterval = interval
    if (montageType === 'bpm' && bpm) {
      // Convert BPM to seconds (60 seconds / BPM)
      clipInterval = (60 / parseFloat(bpm)).toFixed(2)
    }

    let script = `#!/bin/bash

# =========================================
#         Montage Generator Script        
# =========================================

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "\${BLUE}[INFO]\${NC} \$1"
}

log_success() {
    echo -e "\${GREEN}[SUCCESS]\${NC} \$1"
}

log_error() {
    echo -e "\${RED}[ERROR]\${NC} \$1"
}

log_warning() {
    echo -e "\${YELLOW}[WARNING]\${NC} \$1"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v ffmpeg &> /dev/null; then
        log_error "FFmpeg is not installed. Please install FFmpeg first."
        exit 1
    fi
    
    if ! command -v yt-dlp &> /dev/null; then
        log_error "yt-dlp is not installed. Please install yt-dlp first."
        exit 1
    fi
    
    log_success "All dependencies are available"
}

# Create workspace
create_workspace() {
    local workspace=\$(mktemp -d)
    log_info "Created workspace: \$workspace" >&2
    echo "\$workspace"
}

# Download YouTube video and get duration
get_video_duration() {
    local url="\$1"
    local duration=\$(yt-dlp --get-duration "\$url" 2>/dev/null)
    if [ -z "\$duration" ]; then
        log_error "Failed to get duration for \$url"
        return 1
    fi
    echo \$duration
}

# Convert duration to seconds
duration_to_seconds() {
    local duration="\$1"
    local seconds=0
    
    # Parse HH:MM:SS format
    if [[ \$duration =~ ^([0-9]+):([0-9]+):([0-9]+)$ ]]; then
        local hours=\${BASH_REMATCH[1]}
        local minutes=\${BASH_REMATCH[2]}
        local secs=\${BASH_REMATCH[3]}
        seconds=\$((hours * 3600 + minutes * 60 + secs))
    # Parse MM:SS format
    elif [[ \$duration =~ ^([0-9]+):([0-9]+)$ ]]; then
        local minutes=\${BASH_REMATCH[1]}
        local secs=\${BASH_REMATCH[2]}
        seconds=\$((minutes * 60 + secs))
    else
        seconds=\$duration
    fi
    
    echo \$seconds
}

# Download specific clip from YouTube
download_clip() {
    local url="\$1"
    local start_time="\$2"
    local duration="\$3"
    local output_file="\$4"
    
    log_info "Downloading clip at position \${start_time}s"
    
    yt-dlp -f "best[height<=720]" --external-downloader ffmpeg --external-downloader-args "ffmpeg_i:-ss \${start_time} -t \${duration}" -o "\${output_file}" "\${url}" >/dev/null 2>&1
    
    if [ \$? -eq 0 ]; then
        log_success "Downloaded YouTube clip"
        return 0
    else
        log_error "Failed to download clip"
        return 1
    fi
}

# Generate clip positions based on mode
generate_clip_positions() {
    local duration="\$1"
    local clip_duration="\$2"
    local clips_needed="\$3"
    local start_cut="\$4"
    local end_cut="\$5"
    local linear_mode="\$6"
    
    local available_duration=\$((duration - start_cut - end_cut))
    local max_start=\$((available_duration - clip_duration))
    
    if [ \$max_start -le 0 ]; then
        max_start=0
    fi
    
    local positions=()
    
    if [ "\$linear_mode" = "true" ]; then
        # Sequential selection
        local step=\$((max_start / clips_needed))
        for i in \$(seq 0 \$((clips_needed - 1))); do
            local pos=\$((start_cut + (i * step)))
            positions+=(\$pos)
        done
    else
        # Random selection
        for i in \$(seq 1 \$clips_needed); do
            local pos=\$((start_cut + (RANDOM % (max_start + 1))))
            positions+=(\$pos)
        done
    fi
    
    echo "\${positions[@]}"
}

# Create montage based on layout type
create_montage() {
    local workspace="\$1"
    local script_name="\$2"
    local target_resolution="\$3"
    local overlay_text="\$4"
    local font="\$5"
    local font_size="\$6"
    local add_outline="\$7"
    local layout_type="\$8"
    local add_copyright="\$9"
    local keep_audio="\${10}"
    
    log_info "Creating montage..."
    
    if [ "\$layout_type" = "stacked" ]; then
        create_stacked_montage "\$workspace" "\$script_name" "\$target_resolution" "\$overlay_text" "\$font" "\$font_size" "\$add_outline" "\$add_copyright" "\$keep_audio"
    else
        create_sequential_montage "\$workspace" "\$script_name" "\$target_resolution" "\$overlay_text" "\$font" "\$font_size" "\$add_outline" "\$add_copyright" "\$keep_audio"
    fi
}

# Create sequential montage (easy cuts)
create_sequential_montage() {
    local workspace="\$1"
    local script_name="\$2"
    local target_resolution="\$3"
    local overlay_text="\$4"
    local font="\$5"
    local font_size="\$6"
    local add_outline="\$7"
    local add_copyright="\$8"
    local keep_audio="\$9"
    
    # Create clip list for FFmpeg
    local clip_list="\${workspace}/clip_list.txt"
    rm -f "\$clip_list"
    
    log_info "Creating sequential montage..."
    log_info "Creating clip list..."
    
    # Find all clip files and add them to the list
    local clip_count=0
    for clip_file in clip_*.mp4; do
        if [ -f "\$clip_file" ]; then
            echo "file '\$clip_file'" >> "\$clip_list"
            log_info "✓ Including clip: \$clip_file"
            ((clip_count++))
        fi
    done
    
    log_info "Added \$clip_count clips to the list"
    
    # Prepare FFmpeg command
    local ffmpeg_cmd="ffmpeg -f concat -safe 0 -i \"\$clip_list\""
    
    # Build video filter
    local vf_parts=("scale=\$target_resolution")
    
    # Add copyright line if enabled
    if [ "\$add_copyright" = "true" ]; then
        vf_parts+=("drawbox=y=0:color=black@0.8:width=iw:height=ih*0.25:t=fill")
    fi
    
    # Add text overlay if specified
    if [ -n "\$overlay_text" ]; then
        log_info "Adding text overlay: \$overlay_text"
        local text_filter="drawtext=text='\$overlay_text':fontfile=/System/Library/Fonts/\${font}.ttf:fontsize=\$font_size:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2"
        
        if [ "\$add_outline" = "true" ]; then
            text_filter="\${text_filter}:shadowcolor=black:shadowx=2:shadowy=2"
        fi
        
        vf_parts+=("\$text_filter")
    fi
    
    # Combine video filters
    local vf_string="\$(IFS=,; echo "\${vf_parts[*]}")"
    ffmpeg_cmd="\${ffmpeg_cmd} -vf \"\$vf_string\""
    
    # Add audio options
    if [ "\$keep_audio" = "false" ]; then
        ffmpeg_cmd="\${ffmpeg_cmd} -an"
    fi
    
    # Add output options
    ffmpeg_cmd="\${ffmpeg_cmd} -c:v libx264 -c:a aac -preset fast -crf 23 -y \"\${workspace}/\${script_name}_v01.mp4\""
    
    log_info "Creating montage variation 1..."
    log_info "Target resolution: \$target_resolution"
    
    # Execute FFmpeg command (redirect stderr to avoid mixing with command)
    eval \$ffmpeg_cmd 2>/dev/null
    
    if [ \$? -eq 0 ]; then
        log_success "Montage created: \${workspace}/\${script_name}_v01.mp4"
        return 0
    else
        log_error "Failed to create montage"
        return 1
    fi
}

# Create stacked montage (clips stack on top of each other)
create_stacked_montage() {
    local workspace="\$1"
    local script_name="\$2"
    local target_resolution="\$3"
    local overlay_text="\$4"
    local font="\$5"
    local font_size="\$6"
    local add_outline="\$7"
    local add_copyright="\$8"
    local keep_audio="\$9"
    
    log_info "Creating stacked montage..."
    
    # Get all clip files
    local clips=()
    for clip_file in clip_*.mp4; do
        if [ -f "\$clip_file" ]; then
            clips+=("\$clip_file")
        fi
    done
    
    local clip_count=\${#clips[@]}
    log_info "Found \$clip_count clips for stacking"
    
    if [ \$clip_count -eq 0 ]; then
        log_error "No clips available for stacking"
        return 1
    fi
    
    # Build complex filter for stacking
    local filter_complex=""
    local inputs=""
    
    for i in "\${!clips[@]}"; do
        local clip="\${clips[\$i]}"
        inputs="\${inputs} -i \"\$clip\""
        
        if [ \$i -eq 0 ]; then
            filter_complex="[0:v]scale=\$target_resolution[base]"
        else
            filter_complex="\${filter_complex};[\$i:v]scale=\$target_resolution[clip\$i]"
            filter_complex="\${filter_complex};[base][clip\$i]overlay=0:0:shortest=1[base]"
        fi
    done
    
    # Add text overlay if specified
    if [ -n "\$overlay_text" ]; then
        log_info "Adding text overlay: \$overlay_text"
        filter_complex="\${filter_complex};[base]drawtext=text='\$overlay_text':fontfile=/System/Library/Fonts/\${font}.ttf:fontsize=\$font_size:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2[final]"
    else
        filter_complex="\${filter_complex};[base]null[final]"
    fi
    
    # Build FFmpeg command
    local ffmpeg_cmd="ffmpeg\${inputs} -filter_complex \"\$filter_complex\" -map \"[final]\""
    
    # Add audio from first clip if keeping audio
    if [ "\$keep_audio" = "true" ]; then
        ffmpeg_cmd="\${ffmpeg_cmd} -map 0:a"
    fi
    
    ffmpeg_cmd="\${ffmpeg_cmd} -c:v libx264 -c:a aac -preset fast -crf 23 -y \"\${workspace}/\${script_name}_v01.mp4\""
    
    log_info "Creating stacked montage..."
    log_info "Target resolution: \$target_resolution"
    
    # Execute FFmpeg command (redirect stderr to avoid mixing with command)
    eval \$ffmpeg_cmd 2>/dev/null
    
    if [ \$? -eq 0 ]; then
        log_success "Stacked montage created: \${workspace}/\${script_name}_v01.mp4"
        return 0
    else
        log_error "Failed to create stacked montage"
        return 1
    fi
}

# Main execution
main() {
    # Check dependencies
    check_dependencies
    
    # Create workspace
    local workspace=\$(create_workspace)
    if [ -z "\$workspace" ] || [ ! -d "\$workspace" ]; then
        log_error "Failed to create workspace"
        exit 1
    fi
    cd "\$workspace" || {
        log_error "Failed to change to workspace directory"
        exit 1
    }
    
    # Configuration
    local script_name="${scriptName}"
    local interval=${clipInterval}
    local montage_length=${montageLength}
    local start_cut=${startCutAt}
    local end_cut=${endCutAt}
    local variations=${variations}
    local target_resolution="${targetResolution}"
    local overlay_text="${overlayText}"
    local font="${font}"
    local font_size=${fontSize}
    local add_outline="${addTextOutline}"
    local keep_audio="${keepAudio}"
    local linear_mode="${linearMode}"
    local layout_type="${layoutType}"
    local add_copyright="${addCopyright}"
    
    # Video URLs
    local video_urls=(${videoUrls.map(url => `"${url}"`).join(' ')})
    
    log_info "Downloading specific clips directly..."
    
    # Process each video source
    for i in "\${!video_urls[@]}"; do
        local url="\${video_urls[\$i]}"
        local source_num=\$((i + 1))
        
        log_info "Processing source \$source_num: \$url"
        
        # Get video duration
        local duration_str=\$(get_video_duration "\$url")
        if [ \$? -ne 0 ]; then
            continue
        fi
        
        local duration=\$(duration_to_seconds "\$duration_str")
        log_info "Video duration: \${duration}s"
        
        # Calculate how many clips we need
        local clips_needed=\$((montage_length / interval))
        
        # Generate clips for each variation
        for v in \$(seq 1 \$variations); do
            log_info "Downloading clips for variation \$v..."
            
            # Generate clip positions
            local positions=(\$(generate_clip_positions "\$duration" "\$interval" "\$clips_needed" "\$start_cut" "\$end_cut" "\$linear_mode"))
            
            for clip_num in \$(seq 1 \$clips_needed); do
                local output_file="clip_v\${v}_\$(printf "%02d" \$clip_num).mp4"
                local start_pos=\${positions[\$((clip_num - 1))]}
                
                log_info "Downloading clip \$clip_num for variation \$v at position \${start_pos}s"
                
                # Download the clip
                if download_clip "\$url" "\$start_pos" "\$interval" "\$output_file"; then
                    local file_size=\$(stat -f%z "\$output_file" 2>/dev/null || stat -c%s "\$output_file" 2>/dev/null)
                    log_success "Clip \$clip_num for variation \$v ready (\${file_size} bytes)"
                else
                    log_error "Failed to download clip \$clip_num for variation \$v"
                fi
            done
        done
    done
    
    # Create montage
    log_info "🎬 Creating variation 1 of \$variations..."
    
    # Check available clips
    local available_clips=\$(ls clip_*.mp4 2>/dev/null | wc -l)
    log_info "Found \$available_clips clips for variation 1"
    
    if [ \$available_clips -eq 0 ]; then
        log_error "No clips available for montage creation"
        exit 1
    fi
    
    # Create the montage
    if create_montage "\$workspace" "\$script_name" "\$target_resolution" "\$overlay_text" "\$font" "\$font_size" "\$add_outline" "\$layout_type" "\$add_copyright" "\$keep_audio"; then
        log_success "Duration: \${montage_length}s, Interval: \${interval}s, Clips: \$available_clips"
        log_success "Variation 1 completed successfully"
    else
        log_error "Failed to create montage"
        exit 1
    fi
    
    # Copy final file to downloads
    local downloads_dir="\${HOME}/Downloads/\${outputFolder}"
    mkdir -p "\$downloads_dir"
    cp "\${script_name}_v01.mp4" "\$downloads_dir/"
    
    log_success "Montage generation complete!"
    log_success "Files saved to: \$downloads_dir"
    
    # Cleanup
    cd /
    rm -rf "\$workspace"
}

# Run main function
main "\$@"
`

    return script
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
          videoUrls: videoLinks.filter(link => link.trim() !== ""),
          montageType,
          layoutType,
          interval: Number.parseFloat(interval),
          montageLength: Number.parseInt(montageLength),
          startCutAt: Number.parseFloat(startCutAt),
          endCutAt: Number.parseFloat(endCutAt),
          resolution,
          variations: Number.parseInt(variations),
          folderName,
          customFilename,
          keepAudio,
          linearMode,
          addCopyright,
          overlayText,
          font,
          fontSize: fontSize[0],
          addTextOutline,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log("Response:", data)

      if (data.jobId) {
        setJobId(data.jobId)
        setJobStatus("processing")
        // Start polling for job status
        pollJobStatus(data.jobId)
      } else {
        throw new Error("No job ID received")
      }
    } catch (error) {
      console.error("Error generating montage:", error)
      setJobError(error instanceof Error ? error.message : "Unknown error occurred")
      setIsGenerating(false)
      setJobStatus("error")
    }
  }

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/job-status?jobId=${jobId}`)
        const data = await response.json()

        if (data.status === "completed") {
          setJobStatus("completed")
          setJobProgress(100)
          setDownloadUrl(data.downloadUrl)
          setIsGenerating(false)
          clearInterval(pollInterval)
          
          toast({
            title: "Montage Generated!",
            description: "Your montage is ready for download.",
          })
        } else if (data.status === "failed") {
          setJobStatus("failed")
          setJobError(data.error || "Generation failed")
          setIsGenerating(false)
          clearInterval(pollInterval)
        } else if (data.status === "processing") {
          setJobProgress(data.progress || 0)
        }
      } catch (error) {
        console.error("Error polling job status:", error)
        setJobError("Failed to check job status")
        setIsGenerating(false)
        clearInterval(pollInterval)
      }
    }, 2000)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left Panel - Settings */}
      <div className="space-y-6">
        {/* Video Sources */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Video Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {videoLinks.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Enter YouTube, Dropbox, Google Drive, or direct video URL"
                  value={link}
                  onChange={(e) => updateVideoLink(index, e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
                {videoLinks.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeVideoLink(index)}
                    className="border-gray-600 text-gray-400 hover:text-white"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              onClick={addVideoLink}
              className="w-full border-gray-600 text-gray-400 hover:text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Video
            </Button>
          </CardContent>
        </Card>

        {/* Montage Settings */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Montage Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Montage Type</Label>
                <Select value={montageType} onValueChange={setMontageType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="fixed">Fixed Interval (seconds)</SelectItem>
                    <SelectItem value="bpm">BPM Interval (beats)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Layout Type</Label>
                <Select value={layoutType} onValueChange={setLayoutType}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="cut">Sequential (Easy Cuts)</SelectItem>
                    <SelectItem value="stacked">Stacked Cuts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {montageType === "fixed" ? (
                <div>
                  <Label className="text-gray-300">Interval (seconds)</Label>
                  <Input
                    type="number"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-gray-300">BPM (beats per minute)</Label>
                  <Input
                    type="number"
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              )}
              <div>
                <Label className="text-gray-300">Montage Length (seconds)</Label>
                <Input
                  type="number"
                  value={montageLength}
                  onChange={(e) => setMontageLength(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Start Cut At (seconds)</Label>
                <Input
                  type="number"
                  value={startCutAt}
                  onChange={(e) => setStartCutAt(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">End Cut At (seconds)</Label>
                <Input
                  type="number"
                  value={endCutAt}
                  onChange={(e) => setEndCutAt(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Start Cut At (seconds)</Label>
                <Input
                  type="number"
                  value={startCutAt}
                  onChange={(e) => setStartCutAt(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">End Cut At (seconds)</Label>
                <Input
                  type="number"
                  value={endCutAt}
                  onChange={(e) => setEndCutAt(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Resolution</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="480p">480p</SelectItem>
                    <SelectItem value="720p">720p</SelectItem>
                    <SelectItem value="1080p">1080p</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Number of Variations</Label>
                <Input
                  type="number"
                  value={variations}
                  onChange={(e) => setVariations(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Folder Name (in Downloads)</Label>
                <Input
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Custom Filename</Label>
                <Input
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Keep Audio</Label>
                <Switch checked={keepAudio} onCheckedChange={setKeepAudio} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Linear Mode</Label>
                <Switch checked={linearMode} onCheckedChange={setLinearMode} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Add Copyright Line (Top 25%)</Label>
                <Switch checked={addCopyright} onCheckedChange={setAddCopyright} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Text Overlay */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Text Overlay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-300">Overlay Text</Label>
              <Input
                placeholder="Enter text to overlay on video"
                value={overlayText}
                onChange={(e) => setOverlayText(e.target.value)}
                className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Font</Label>
                <Select value={font} onValueChange={setFont}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Font Size: {fontSize[0]}px</Label>
                <Slider
                  value={fontSize}
                  onValueChange={setFontSize}
                  max={100}
                  min={12}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Add Text Outline</Label>
              <Switch checked={addTextOutline} onCheckedChange={setAddTextOutline} />
            </div>
          </CardContent>
        </Card>

        {/* Generate Buttons */}
        <div className="space-y-3">
          <Button
            onClick={generateLocalScript}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            disabled={isGenerating}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Generate Local Script
          </Button>
          <Button
            onClick={generateMontage}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Cloud className="h-4 w-4 mr-2" />
            )}
            Generate Montage (Cloud)
          </Button>
        </div>

        {/* Copy Run Commands - Shows after script generation */}
        {scriptGenerated && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Run Script Commands</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-300">
                Script downloaded as <code className="bg-gray-700 px-2 py-1 rounded">{scriptFilename}</code>
              </p>
              <p className="text-sm text-gray-400">
                Copy the command below for your platform, paste in terminal, and press Enter:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => copyRunCommand('mac')}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:text-white"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Copy Mac Command
                </Button>
                <Button
                  onClick={() => copyRunCommand('pc')}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:text-white"
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
                  </svg>
                  Copy PC Command
                </Button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                <p>• Mac: Makes script executable and runs it</p>
                <p>• PC: Runs script with bash (requires WSL/Git Bash)</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress and Status */}
        {isGenerating && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Progress</span>
                  <span className="text-gray-300">{jobProgress}%</span>
                </div>
                <Progress value={jobProgress} className="w-full" />
                <p className="text-sm text-gray-400">{jobStatus}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {jobError && (
          <Alert variant="destructive" className="bg-red-900 border-red-700">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{jobError}</AlertDescription>
          </Alert>
        )}

        {/* Download Link */}
        {downloadUrl && (
          <Alert className="bg-green-900 border-green-700">
            <Download className="h-4 w-4" />
            <AlertTitle>Ready for Download</AlertTitle>
            <AlertDescription>
              <a
                href={downloadUrl}
                className="text-green-300 hover:text-green-200 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Click here to download your montage
              </a>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Right Panel - Preview */}
      <div>
        <Card className="bg-gray-800 border-gray-700 h-full">
          <CardHeader>
            <CardTitle className="text-white">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Video Preview */}
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-4">
                <div className="aspect-video bg-gray-700 rounded relative overflow-hidden">
                  {/* Copyright line if enabled */}
                  {addCopyright && (
                    <div className="absolute top-0 left-0 right-0 h-1/4 bg-black bg-opacity-80"></div>
                  )}
                  
                  {/* Text overlay if specified */}
                  {overlayText && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div 
                        className="text-white text-center"
                        style={{
                          fontSize: `${fontSize[0]}px`,
                          fontFamily: font,
                          textShadow: addTextOutline ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none'
                        }}
                      >
                        {overlayText}
                      </div>
                    </div>
                  )}
                  
                  {/* Video placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-gray-400 text-center">
                      <div className="text-sm mb-2">Video Preview</div>
                      <div className="text-xs">
                        {videoLinks[0] ? 'Video loaded' : 'Add video URL'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings Summary */}
              <div className="space-y-2">
                <div className="text-sm text-gray-300 font-medium">Settings Summary:</div>
                <div className="text-xs text-gray-400 space-y-1">
                  <div>• Type: {montageType === 'fixed' ? `Fixed (${interval}s)` : `BPM (${bpm})`}</div>
                  <div>• Layout: {layoutType === 'cut' ? 'Sequential Cuts' : 'Stacked Cuts'}</div>
                  <div>• Length: {montageLength}s</div>
                  <div>• Resolution: {resolution}</div>
                  <div>• Variations: {variations}</div>
                  <div>• Audio: {keepAudio ? 'Keep' : 'Mute'}</div>
                  <div>• Linear: {linearMode ? 'Sequential' : 'Random'}</div>
                  {addCopyright && <div>• Copyright line: Enabled</div>}
                  {overlayText && <div>• Text: "{overlayText}" ({fontSize[0]}px {font})</div>}
                </div>
              </div>

              {/* Layout Preview */}
              <div className="space-y-2">
                <div className="text-sm text-gray-300 font-medium">Layout Preview:</div>
                <div className="text-xs text-gray-400">
                  {layoutType === 'cut' ? (
                    <div className="space-y-1">
                      <div>┌─────────┐ ┌─────────┐ ┌─────────┐</div>
                      <div>│ Clip 1  │ │ Clip 2  │ │ Clip 3  │ → Sequential</div>
                      <div>└─────────┘ └─────────┘ └─────────┘</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div>┌─────────┐</div>
                      <div>│ Clip 1  │</div>
                      <div>│ Clip 2  │ → Stacked</div>
                      <div>│ Clip 3  │</div>
                      <div>└─────────┘</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
