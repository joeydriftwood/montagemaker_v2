"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ClipboardCopy, Download, Youtube } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"

export function ReactionSplitGenerator() {
  // State for form inputs
  const [topVideoLink, setTopVideoLink] = useState<string>("")
  const [bottomVideoLink, setBottomVideoLink] = useState<string>("")
  const [topStartTime, setTopStartTime] = useState<string>("0")
  const [bottomStartTime, setBottomStartTime] = useState<string>("0")
  const [duration, setDuration] = useState<string>("60")
  const [topVolume, setTopVolume] = useState<number>(30)
  const [bottomVolume, setBottomVolume] = useState<number>(100)
  const [generatedScript, setGeneratedScript] = useState<string>("")
  const [scriptFilename, setScriptFilename] = useState<string>("reaction_split.sh")
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState<boolean>(false)
  const [copyNotification, setCopyNotification] = useState<string>("")

  // Auto-convert YouTube links to direct download links
  const processYouTubeLink = (link: string): string => {
    // This is just a placeholder - the actual download happens in the script
    return link
  }

  // Generate the script
  const generateScript = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outputFilename = `reaction_split_${timestamp}.mp4`

    const script = `#!/bin/bash
# Reaction Split Generator Script
# Generated: ${new Date().toLocaleString()}

# Stop on first error
set -e

# Enable command echo for debugging
set -x

# Function for safe math calculations
safe_calc() {
  result=\$(awk "\$1" 2>/dev/null)
  if [ -z "\$result" ] || [ "\$result" = "inf" ] || [ "\$result" = "-inf" ] || [ "\$result" = "nan" ]; then
    echo "\$2" # fallback value
  else
    echo "\$result"
  fi
}

echo "🎬 Reaction Split Generator"
echo "=========================="
echo ""

# --- CONFIG ---
TOP_VIDEO="${topVideoLink}"
BOTTOM_VIDEO="${bottomVideoLink}"
TOP_START="${topStartTime}"
BOTTOM_START="${bottomStartTime}"
DURATION="${duration}"
TOP_VOLUME="${topVolume / 100}"
BOTTOM_VOLUME="${bottomVolume / 100}"
OUTPUT_DIR="\$HOME/Downloads"
OUTPUT_FILE="${outputFilename}"
FULL_OUTPUT="\$OUTPUT_DIR/\$OUTPUT_FILE"

echo "Creating vertical split reaction video..."
echo "Top video: \$TOP_VIDEO"
echo "Bottom video: \$BOTTOM_VIDEO"
echo "Duration: \$DURATION seconds"
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
  echo "❌ Error: FFmpeg is not installed. Please install it before continuing."
  echo "Mac: brew install ffmpeg"
  echo "Windows: Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH"
  exit 1
fi

# Create temp directory
TMP_DIR=\$(mktemp -d)
echo "Created temp directory: \$TMP_DIR"

# --- DOWNLOAD VIDEOS ---
# Function to download YouTube videos with fallback options
download_youtube_video() {
  local url="\$1"
  local output="\$2"
  local description="\$3"
  
  echo "Downloading \$description video from YouTube..."
  
  # First try with best quality
  if yt-dlp -f "best" "\$url" -o "\$output"; then
    echo "✅ \$description video downloaded successfully"
    return 0
  fi
  
  echo "⚠️ First download attempt failed, trying with format 'bestvideo+bestaudio'..."
  
  # Second try with separate video and audio streams
  if yt-dlp -f "bestvideo+bestaudio" "\$url" -o "\$output"; then
    echo "✅ \$description video downloaded successfully"
    return 0
  fi
  
  echo "⚠️ Second download attempt failed, trying with format '22/18/best'..."
  
  # Third try with common format codes (22=720p, 18=360p)
  if yt-dlp -f "22/18/best" "\$url" -o "\$output"; then
    echo "✅ \$description video downloaded successfully"
    return 0
  fi
  
  # If all attempts fail
  echo "❌ Failed to download \$description video after multiple attempts."
  return 1
}

# Check if top video is a YouTube URL
if [[ "\$TOP_VIDEO" == *"youtube.com"* || "\$TOP_VIDEO" == *"youtu.be"* ]]; then
  echo "YouTube URL detected for top video."
  
  # Check if yt-dlp is installed
  if ! command -v yt-dlp &> /dev/null; then
    echo "❌ Error: yt-dlp is not installed. Please install it with: brew install yt-dlp"
    exit 1
  fi
  
  # Download YouTube video with fallback options
  TOP_OUTPUT="\$TMP_DIR/top_video.mp4"
  if ! download_youtube_video "\$TOP_VIDEO" "\$TOP_OUTPUT" "top"; then
    rm -rf "\$TMP_DIR"
    exit 1
  fi
  TOP_VIDEO="\$TOP_OUTPUT"
  
elif [[ "\$TOP_VIDEO" == *"dropbox.com"* ]]; then
  # Handle Dropbox links
  if [[ "\$TOP_VIDEO" != *"raw=1"* ]]; then
    if [[ "\$TOP_VIDEO" == *"dl=0"* ]]; then
      TOP_VIDEO="\${TOP_VIDEO/dl=0/raw=1}"
    elif [[ "\$TOP_VIDEO" != *"?"* ]]; then
      TOP_VIDEO="\${TOP_VIDEO}?raw=1"
    fi
  fi
  
  # Download the Dropbox file
  TOP_OUTPUT="\$TMP_DIR/top_video.mp4"
  echo "Downloading top video from Dropbox..."
  if curl -L "\$TOP_VIDEO" -o "\$TOP_OUTPUT"; then
    echo "✅ Top video downloaded successfully"
    TOP_VIDEO="\$TOP_OUTPUT"
  else
    echo "❌ Failed to download top video. Check the URL and your internet connection."
    rm -rf "\$TMP_DIR"
    exit 1
  fi
fi

# Check if bottom video is a YouTube URL
if [[ "\$BOTTOM_VIDEO" == *"youtube.com"* || "\$BOTTOM_VIDEO" == *"youtu.be"* ]]; then
  echo "YouTube URL detected for bottom video."
  
  # Download YouTube video with fallback options
  BOTTOM_OUTPUT="\$TMP_DIR/bottom_video.mp4"
  if ! download_youtube_video "\$BOTTOM_VIDEO" "\$BOTTOM_OUTPUT" "bottom"; then
    rm -rf "\$TMP_DIR"
    exit 1
  fi
  BOTTOM_VIDEO="\$BOTTOM_OUTPUT"
  
elif [[ "\$BOTTOM_VIDEO" == *"dropbox.com"* ]]; then
  # Handle Dropbox links
  if [[ "\$BOTTOM_VIDEO" != *"raw=1"* ]]; then
    if [[ "\$BOTTOM_VIDEO" == *"dl=0"* ]]; then
      BOTTOM_VIDEO="\${BOTTOM_VIDEO/dl=0/raw=1}"
    elif [[ "\$BOTTOM_VIDEO" != *"?"* ]]; then
      BOTTOM_VIDEO="\${BOTTOM_VIDEO}?raw=1"
    fi
  fi
  
  # Download the Dropbox file
  BOTTOM_OUTPUT="\$TMP_DIR/bottom_video.mp4"
  echo "Downloading bottom video from Dropbox..."
  if curl -L "\$BOTTOM_VIDEO" -o "\$BOTTOM_OUTPUT"; then
    echo "✅ Bottom video downloaded successfully"
    BOTTOM_VIDEO="\$BOTTOM_OUTPUT"
  else
    echo "❌ Failed to download bottom video. Check the URL and your internet connection."
    rm -rf "\$TMP_DIR"
    exit 1
  fi
fi

# --- PROCESS VIDEOS ---
echo "Processing videos..."

# Check for audio streams in the input files
echo "Checking for audio streams in the input files..."
TOP_HAS_AUDIO=0
BOTTOM_HAS_AUDIO=0

# Check if top video has audio
if ffprobe -v error -select_streams a -show_streams "\$TOP_VIDEO" 2>/dev/null | grep -q codec_type=audio; then
  echo "✅ Top video has audio"
  TOP_HAS_AUDIO=1
else
  echo "⚠️ Top video has no audio"
  TOP_HAS_AUDIO=0
fi

# Check if bottom video has audio
if ffprobe -v error -select_streams a -show_streams "\$BOTTOM_VIDEO" 2>/dev/null | grep -q codec_type=audio; then
  echo "✅ Bottom video has audio"
  BOTTOM_HAS_AUDIO=1
else
  echo "⚠️ Bottom video has no audio"
  BOTTOM_HAS_AUDIO=0
fi

# Create appropriate filter complex based on available audio streams
VIDEO_FILTER="[0:v]scale=1080:960:force_original_aspect_ratio=decrease,pad=1080:960:(ow-iw)/2:(oh-ih)/2[top]; [1:v]scale=1080:960:force_original_aspect_ratio=decrease,pad=1080:960:(ow-iw)/2:(oh-ih)/2[bottom]; [top][bottom]vstack=inputs=2[vout]"

# Determine audio filter based on available streams
if [ "\$TOP_HAS_AUDIO" -eq 1 ] && [ "\$BOTTOM_HAS_AUDIO" -eq 1 ]; then
  echo "Using audio from both videos"
  AUDIO_FILTER="; [0:a]volume=\$TOP_VOLUME[a1]; [1:a]volume=\$BOTTOM_VOLUME[a2]; [a1][a2]amix=inputs=2:duration=longest[aout]"
  AUDIO_MAP="-map [aout]"
elif [ "\$TOP_HAS_AUDIO" -eq 1 ]; then
  echo "Using audio from top video only"
  AUDIO_FILTER="; [0:a]volume=\$TOP_VOLUME[aout]"
  AUDIO_MAP="-map [aout]"
elif [ "\$BOTTOM_HAS_AUDIO" -eq 1 ]; then
  echo "Using audio from bottom video only"
  AUDIO_FILTER="; [1:a]volume=\$BOTTOM_VOLUME[aout]"
  AUDIO_MAP="-map [aout]"
else
  echo "No audio streams found in either video"
  AUDIO_FILTER=""
  AUDIO_MAP=""
fi

# Combine video and audio filters
FILTER_COMPLEX="\$VIDEO_FILTER\$AUDIO_FILTER"

# Execute FFmpeg with the appropriate filter complex
echo "Running FFmpeg command to create split screen video..."

# IMPORTANT: Execute FFmpeg directly with properly quoted filter_complex
if [ -n "\$AUDIO_MAP" ]; then
  # With audio
  ffmpeg -i "\$TOP_VIDEO" -ss \$TOP_START -t \$DURATION \\
       -i "\$BOTTOM_VIDEO" -ss \$BOTTOM_START -t \$DURATION \\
       -filter_complex "\$FILTER_COMPLEX" \\
       -map "[vout]" \$AUDIO_MAP \\
       -c:v libx264 -preset fast -crf 22 -c:a aac -shortest -y "\$FULL_OUTPUT"
else
  # Without audio
  ffmpeg -i "\$TOP_VIDEO" -ss \$TOP_START -t \$DURATION \\
       -i "\$BOTTOM_VIDEO" -ss \$BOTTOM_START -t \$DURATION \\
       -filter_complex "\$FILTER_COMPLEX" \\
       -map "[vout]" \\
       -c:v libx264 -preset fast -crf 22 -shortest -y "\$FULL_OUTPUT"
fi

# Check if the output file was created successfully
if [ -f "\$FULL_OUTPUT" ] && [ -s "\$FULL_OUTPUT" ]; then
  echo "✅ Reaction split video created successfully!"
  echo "Output saved to: \$FULL_OUTPUT"
  echo "✅ Output file verified: \$(du -h \"\$FULL_OUTPUT\" | cut -f1) bytes"
  
  # Clean up
  echo "Cleaning up temporary files..."
  rm -rf "\$TMP_DIR"
  
  echo ""
  echo "✨ Finished generating reaction split video"
  echo "File saved to: \$FULL_OUTPUT"
  echo "🎬 Your video is ready! Open it in your video player to view."
else
  echo "❌ Output file not found or empty. Something went wrong."
  echo "Temporary files are kept at: \$TMP_DIR"
  exit 1
fi
`

    setGeneratedScript(script)
    setScriptFilename(`reaction_split_${timestamp}.sh`)
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
      <div className="border border-gray-300 p-6 rounded">
        {/* Video Sources */}
        <div className="mb-6">
          <h2 className="text-base font-normal mb-4">Video Sources</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter YouTube or Dropbox links for the top and bottom videos of your reaction split.
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="top-video" className="text-sm font-normal">
                Top Video (Reaction)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="top-video"
                  value={topVideoLink}
                  onChange={(e) => setTopVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open("https://www.youtube.com", "_blank")}
                  className="border-gray-400 text-red-500 hover:bg-red-50"
                >
                  <Youtube className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="bottom-video" className="text-sm font-normal">
                Bottom Video (Content)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="bottom-video"
                  value={bottomVideoLink}
                  onChange={(e) => setBottomVideoLink(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open("https://www.youtube.com", "_blank")}
                  className="border-gray-400 text-red-500 hover:bg-red-50"
                >
                  <Youtube className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Timing Controls */}
        <div className="mb-6">
          <h2 className="text-base font-normal mb-4">Timing Controls</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="top-start" className="text-sm font-normal">
                Top Video Start (seconds)
              </Label>
              <Input
                id="top-start"
                type="number"
                value={topStartTime}
                onChange={(e) => setTopStartTime(e.target.value)}
                min="0"
                className="mt-1 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <Label htmlFor="bottom-start" className="text-sm font-normal">
                Bottom Video Start (seconds)
              </Label>
              <Input
                id="bottom-start"
                type="number"
                value={bottomStartTime}
                onChange={(e) => setBottomStartTime(e.target.value)}
                min="0"
                className="mt-1 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <Label htmlFor="duration" className="text-sm font-normal">
                Duration (seconds)
              </Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="1"
                max="600"
                className="mt-1 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Volume Controls */}
        <div className="mb-6">
          <h2 className="text-base font-normal mb-4">Volume Controls</h2>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <Label htmlFor="top-volume" className="text-sm font-normal">
                  Top Video Volume: {topVolume}%
                </Label>
                <span className="text-xs text-gray-500">{topVolume === 0 ? "(Muted)" : ""}</span>
              </div>
              <Slider
                id="top-volume"
                value={[topVolume]}
                onValueChange={(value) => setTopVolume(value[0])}
                min={0}
                max={100}
                step={5}
                className="py-2"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label htmlFor="bottom-volume" className="text-sm font-normal">
                  Bottom Video Volume: {bottomVolume}%
                </Label>
                <span className="text-xs text-gray-500">{bottomVolume === 0 ? "(Muted)" : ""}</span>
              </div>
              <Slider
                id="bottom-volume"
                value={[bottomVolume]}
                onValueChange={(value) => setBottomVolume(value[0])}
                min={0}
                max={100}
                step={5}
                className="py-2"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mb-6">
          <h2 className="text-base font-normal mb-4">Preview</h2>
          <div className="bg-gray-100 rounded-md p-4 flex flex-col items-center justify-center">
            <div className="w-full max-w-[180px] aspect-[9/16] bg-gray-200 rounded-md overflow-hidden">
              <div className="w-full h-1/2 bg-gray-300 flex items-center justify-center text-gray-500 text-xs">
                Top Video
              </div>
              <div className="w-full h-1/2 bg-gray-400 flex items-center justify-center text-gray-600 text-xs">
                Bottom Video
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">9:16 Vertical Format (1080x1920)</p>
          </div>
        </div>

        <Button
          onClick={generateScript}
          className="w-full bg-blue-600 text-white hover:bg-blue-700 rounded-sm"
          disabled={!topVideoLink || !bottomVideoLink}
        >
          Generate Script
        </Button>
      </div>

      {/* Generated Script Output */}
      {generatedScript && (
        <div className="border border-gray-300 p-6 rounded">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-normal">Generated Script</h2>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyCommand("mac")}
                className="text-sm border-gray-400 text-blue-600 hover:bg-blue-50"
              >
                <ClipboardCopy className="h-4 w-4 mr-2" />
                Copy Mac Command
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyCommand("pc")}
                className="text-sm border-gray-400 text-blue-600 hover:bg-blue-50"
              >
                <ClipboardCopy className="h-4 w-4 mr-2" />
                Copy PC Command
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={prepareDownload}
                className="text-sm border-gray-400 text-blue-600 hover:bg-blue-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>

          {copyNotification && (
            <div className="bg-green-100 text-green-800 p-2 rounded mb-4 text-center">{copyNotification}</div>
          )}

          <div className="bg-gray-50 p-4 rounded border border-gray-300 overflow-x-auto">
            <pre className="text-xs font-mono whitespace-pre-wrap text-black">{generatedScript}</pre>
          </div>

          <div className="mt-4">
            <Card className="border-gray-300">
              <CardContent className="p-4">
                <h3 className="text-sm font-medium mb-2">How to Run This Script</h3>
                <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Download the script using the button above</li>
                  <li>Open Terminal (Mac) or Git Bash (Windows)</li>
                  <li>
                    Navigate to your Downloads folder:{" "}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">cd ~/Downloads</code>
                  </li>
                  <li>
                    Make the script executable (Mac only):{" "}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">chmod +x {scriptFilename}</code>
                  </li>
                  <li>
                    Run the script: <code className="bg-gray-100 px-1 py-0.5 rounded">./{scriptFilename}</code> (Mac) or{" "}
                    <code className="bg-gray-100 px-1 py-0.5 rounded">bash {scriptFilename}</code> (Windows)
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Download Dialog */}
      <Dialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
        <DialogContent className="bg-white border-gray-300">
          <DialogHeader>
            <DialogTitle className="text-base font-normal">Download Script</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="filename" className="text-sm font-normal">
              Script Filename
            </Label>
            <Input
              id="filename"
              value={scriptFilename}
              onChange={(e) => setScriptFilename(e.target.value)}
              className="mt-2 border-gray-400 bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDownloadDialogOpen(false)}
              className="text-sm border-gray-400 text-black hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button onClick={downloadScript} className="bg-blue-600 text-white hover:bg-blue-700 text-sm">
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
