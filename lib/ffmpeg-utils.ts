import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import os from "os"
import { put } from "@vercel/blob"
import ytdlp from "yt-dlp-exec"

const execAsync = promisify(exec)

// Function to download and set up FFmpeg
async function setupFFmpeg(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), "ffmpeg-bin")
  const ffmpegPath = path.join(tempDir, "ffmpeg")

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  // Check if FFmpeg is already downloaded
  if (!fs.existsSync(ffmpegPath)) {
    console.log("Downloading FFmpeg...")

    // Download FFmpeg binary for Linux (assuming Vercel's environment)
    await execAsync(
      `curl -L https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4.0/linux-x64 -o ${ffmpegPath}`,
    )
    await execAsync(`chmod +x ${ffmpegPath}`)
  }

  return ffmpegPath
}

// Function to download and set up yt-dlp
async function setupYtDlp(): Promise<string> {
  const tempDir = path.join(os.tmpdir(), "yt-dlp-bin")
  const ytDlpPath = path.join(tempDir, "yt-dlp")

  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  // Check if yt-dlp is already downloaded
  if (!fs.existsSync(ytDlpPath)) {
    console.log("Downloading yt-dlp...")

    // Download yt-dlp binary
    await execAsync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ${ytDlpPath}`)
    await execAsync(`chmod +x ${ytDlpPath}`)
  }

  return ytDlpPath
}

// Function to get video duration
export async function getVideoDuration(url: string): Promise<number> {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    // YouTube URL - use yt-dlp-exec
    const duration = await ytdlp(url, {
      getDuration: true,
    })
    return parseInt(duration) || 60
  } else {
    // For other URLs, we'll need to download a small sample
    const tempFile = path.join(os.tmpdir(), `temp_duration_${Date.now()}.mp4`)
    try {
      await execAsync(`curl -L "${url}" -o "${tempFile}" -r 0-1048576`)
      const duration = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempFile}"`)
      fs.unlinkSync(tempFile)
      return parseInt(duration.stdout) || 60
    } catch (error) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
      return 60 // Default duration
    }
  }
}

// Function to download a video (YouTube or direct URL)
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    // YouTube URL - use yt-dlp-exec
    await ytdlp(url, {
      output: outputPath,
      format: "best[height<=720]",
    })
  } else {
    // Direct video URL
    await execAsync(`curl -L "${url}" -o "${outputPath}"`)
  }
}

// Function to process videos with FFmpeg
export async function processVideos(
  topVideoPath: string,
  bottomVideoPath: string,
  outputPath: string,
  options: {
    topStartTime?: number
    topDuration?: number
    bottomStartTime?: number
    bottomDuration?: number
    topVolume?: number
    bottomVolume?: number
  },
): Promise<void> {
  const ffmpegPath = await setupFFmpeg()

  const {
    topStartTime = 0,
    topDuration = 30,
    bottomStartTime = 0,
    bottomDuration = 30,
    topVolume = 1.0,
    bottomVolume = 1.0,
  } = options

  // Build FFmpeg command
  const command = `${ffmpegPath} -y \
    -ss ${topStartTime} -t ${topDuration} -i "${topVideoPath}" \
    -ss ${bottomStartTime} -t ${bottomDuration} -i "${bottomVideoPath}" \
    -filter_complex "[0:v]scale=640:360[top]; \
    [1:v]scale=640:360[bottom]; \
    [top][bottom]vstack=inputs=2[v]; \
    [0:a]volume=${topVolume}[a1]; \
    [1:a]volume=${bottomVolume}[a2]; \
    [a1][a2]amix=inputs=2:duration=longest[a]" \
    -map "[v]" -map "[a]" \
    -c:v libx264 -preset fast -crf 22 \
    -c:a aac -b:a 128k \
    "${outputPath}"`

  // Execute FFmpeg command
  await execAsync(command)
}

// Function to upload processed video to Vercel Blob
export async function uploadToBlob(filePath: string, fileName: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath)
  const blob = await put(fileName, fileBuffer, { access: "public" })
  return blob.url
}
