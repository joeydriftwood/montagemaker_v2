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
      const blob = new Blob([scriptContent], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${customFilename || 'montage'}_script.sh`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Script Generated!",
        description: `Montage script downloaded as ${customFilename || 'montage'}_script.sh`,
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

  // Generate the actual montage script
  const generateMontageScript = (params: any) => {
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
    log_info "Created workspace: \$workspace"
    echo \$workspace
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

# Generate random position within video bounds
get_random_position() {
    local max_duration="\$1"
    local clip_duration="\$2"
    local max_start=\$((max_duration - clip_duration))
    
    if [ \$max_start -le 0 ]; then
        max_start=0
    fi
    
    echo \$((RANDOM % (max_start + 1)))
}

# Create montage
create_montage() {
    local workspace="\$1"
    local script_name="\$2"
    local target_resolution="\$3"
    local overlay_text="\$4"
    local font="\$5"
    local font_size="\$6"
    local add_outline="\$7"
    
    log_info "Creating montage..."
    
    # Create clip list for FFmpeg
    local clip_list="\${workspace}/clip_list.txt"
    rm -f "\$clip_list"
    
    log_info "Creating clip list..."
    
    # Find all clip files and add them to the list
    local clip_count=0
    for clip_file in \${workspace}/clip_*.mp4; do
        if [ -f "\$clip_file" ]; then
            echo "file '\$clip_file'" >> "\$clip_list"
            log_info "✓ Including clip: \$(basename \$clip_file)"
            ((clip_count++))
        fi
    done
    
    log_info "Added \$clip_count clips to the list"
    
    # Prepare FFmpeg command
    local ffmpeg_cmd="ffmpeg -f concat -safe 0 -i \"\$clip_list\""
    
    # Add text overlay if specified
    if [ -n "\$overlay_text" ]; then
        log_info "Adding text overlay: \$overlay_text"
        
        local text_filter="drawtext=text='\$overlay_text':fontfile=/System/Library/Fonts/\${font}.ttf:fontsize=\$font_size:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2"
        
        if [ "\$add_outline" = "true" ]; then
            text_filter="\${text_filter}:shadowcolor=black:shadowx=2:shadowy=2"
        fi
        
        ffmpeg_cmd="\${ffmpeg_cmd} -vf \"scale=\$target_resolution,\$text_filter\""
    else
        ffmpeg_cmd="\${ffmpeg_cmd} -vf \"scale=\$target_resolution\""
    fi
    
    # Add output options
    ffmpeg_cmd="\${ffmpeg_cmd} -c:v libx264 -c:a aac -preset fast -crf 23 -y \"\${workspace}/\${script_name}_v01.mp4\""
    
    log_info "Creating montage variation 1..."
    log_info "Target resolution: \$target_resolution"
    
    # Execute FFmpeg command
    eval \$ffmpeg_cmd
    
    if [ \$? -eq 0 ]; then
        log_success "Montage created: \${workspace}/\${script_name}_v01.mp4"
        return 0
    else
        log_error "Failed to create montage"
        return 1
    fi
}

# Main execution
main() {
    # Check dependencies
    check_dependencies
    
    # Create workspace
    local workspace=\$(create_workspace)
    cd "\$workspace"
    
    # Configuration
    local script_name="${scriptName}"
    local interval=${interval}
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
        
        # Calculate clip duration based on interval
        local clip_duration=\$interval
        
        # Generate clips for each variation
        for v in \$(seq 1 \$variations); do
            log_info "Downloading clips for variation \$v..."
            
            # Calculate how many clips we need
            local clips_needed=\$((montage_length / interval))
            
            for clip_num in \$(seq 1 \$clips_needed); do
                local output_file="clip_v\${v}_\$(printf "%02d" \$clip_num).mp4"
                
                # Generate random position within bounds
                local max_start=\$((duration - clip_duration))
                if [ \$max_start -lt 0 ]; then
                    max_start=0
                fi
                
                local start_pos=\$((RANDOM % (max_start + 1)))
                
                log_info "Downloading clip \$clip_num for variation \$v at position \${start_pos}s"
                
                # Download the clip
                if download_clip "\$url" "\$start_pos" "\$clip_duration" "\$output_file"; then
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
    if create_montage "\$workspace" "\$script_name" "\$target_resolution" "\$overlay_text" "\$font" "\$font_size" "\$add_outline"; then
        log_success "Duration: \${montage_length}s, Interval: \${interval}s, Clips: \$available_clips"
        log_success "Variation 1 completed successfully"
    else
        log_error "Failed to create montage"
        exit 1
    fi
    
    # Copy final file to downloads
    local downloads_dir="\${HOME}/Downloads/\${script_name}"
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
                    <SelectItem value="fixed">Fixed Interval</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
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
                    <SelectItem value="cut">Cut (Sequential)</SelectItem>
                    <SelectItem value="split">Split Screen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Interval (seconds)</Label>
                <Input
                  type="number"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
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
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <div className="text-lg font-semibold">Montage Clips (1s intervals)</div>
                <div className="text-sm">Sequential Layout (1280x720)</div>
              </div>
              <div className="text-gray-500 text-sm">
                Preview will show here when video URLs are added
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
