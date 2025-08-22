import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs"
import path from "path"
import os from "os"
import { put } from "@vercel/blob"

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
  console.log(`Getting video duration for: ${url}`);
  
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    // YouTube URL - use yt-dlp binary
    const ytDlpPath = await setupYtDlp()
    try {
      console.log(`Using yt-dlp to get duration: ${ytDlpPath} --get-duration "${url}"`);
      const duration = await execAsync(`${ytDlpPath} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --get-duration "${url}"`)
      // Parse duration string (e.g., "3:45" or "1:23:45")
      const durationStr = duration.stdout.trim()
      console.log(`Raw duration string: "${durationStr}"`);
      
      if (durationStr.includes(':')) {
        const parts = durationStr.split(':').map(part => parseInt(part.replace(/^0+/, '') || '0'))
        if (parts.length === 2) {
          // MM:SS format
          const result = parts[0] * 60 + parts[1]
          console.log(`Parsed duration (MM:SS): ${result}s`);
          return result
        } else if (parts.length === 3) {
          // HH:MM:SS format
          const result = parts[0] * 3600 + parts[1] * 60 + parts[2]
          console.log(`Parsed duration (HH:MM:SS): ${result}s`);
          return result
        }
      }
      const result = parseInt(durationStr) || 60
      console.log(`Parsed duration (seconds): ${result}s`);
      return result
    } catch (error) {
      console.error('Error getting duration with yt-dlp:', error)
      console.log('Falling back to default duration of 240 seconds for YouTube videos');
      return 240 // Default duration for YouTube videos
    }
  } else if (url.includes("dropbox.com")) {
    // For Dropbox, download a small sample and use ffprobe
    const tempFile = path.join(os.tmpdir(), `temp_duration_${Date.now()}.mp4`)
    try {
      let downloadUrl = url
      
      // Handle different Dropbox URL formats
      if (url.includes("&dl=0")) {
        downloadUrl = url.replace("&dl=0", "&dl=1")
      } else if (url.includes("?dl=0")) {
        downloadUrl = url.replace("?dl=0", "?dl=1")
      } else if (!url.includes("dl=")) {
        // If no dl parameter, add it for direct download
        downloadUrl = url.includes("?") ? `${url}&dl=1` : `${url}?dl=1`
      }
      
      console.log(`Downloading Dropbox sample for duration detection: ${downloadUrl}`)
      
      // Try downloading a larger sample (5MB) to ensure we get enough data for duration detection
      await execAsync(`curl -L --max-time 120 "${downloadUrl}" -o "${tempFile}" -r 0-5242880`)
      
      // Check if file was downloaded successfully
      const stats = fs.statSync(tempFile)
      if (stats.size < 1000) {
        throw new Error(`Downloaded file is too small: ${stats.size} bytes`)
      }
      
      const duration = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempFile}"`)
      fs.unlinkSync(tempFile)
      
      const durationStr = duration.stdout.trim()
      const result = Math.round(parseFloat(durationStr)) || 120
      console.log(`Parsed duration (ffprobe): ${result}s`);
      return result
    } catch (error) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
      console.error('Error getting duration with ffprobe for Dropbox:', error)
      console.log('Falling back to default duration of 120 seconds for Dropbox videos');
      return 120 // Default duration for Dropbox videos
    }
  } else {
    // For other URLs, we'll need to download a small sample with timeout
    const tempFile = path.join(os.tmpdir(), `temp_duration_${Date.now()}.mp4`)
    try {
      await execAsync(`curl -L --max-time 30 "${url}" -o "${tempFile}" -r 0-1048576`)
      const duration = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempFile}"`)
      fs.unlinkSync(tempFile)
      const result = parseInt(duration.stdout) || 60
      console.log(`Parsed duration (ffprobe): ${result}s`);
      return result
    } catch (error) {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
      console.error('Error getting duration with ffprobe:', error)
      console.log('Falling back to default duration of 60 seconds');
      return 60 // Default duration
    }
  }
}

// Function to download a video (YouTube or direct URL)
export async function downloadVideo(url: string, outputPath: string): Promise<void> {
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    // YouTube URL - use yt-dlp binary with robust options
    const ytDlpPath = await setupYtDlp()
    
    // Try multiple strategies to bypass restrictions (server-side only)
    const strategies = [
      // Strategy 1: Use realistic user agent with format selection
      `${ytDlpPath} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --extractor-args "youtube:player_client=android" -f "best[height<=720]" -o "${outputPath}" "${url}"`,
      
      // Strategy 2: Use mobile user agent
      `${ytDlpPath} --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" -f "best" -o "${outputPath}" "${url}"`,
      
      // Strategy 3: Use different extractor args
      `${ytDlpPath} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --extractor-args "youtube:player_client=web" -f "best" -o "${outputPath}" "${url}"`,
      
      // Strategy 4: Use no format specification
      `${ytDlpPath} --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -o "${outputPath}" "${url}"`,
      
      // Strategy 5: Last resort - basic yt-dlp
      `${ytDlpPath} -o "${outputPath}" "${url}"`
    ]
    
    let lastError = null
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Trying download strategy ${i + 1}/${strategies.length}...`)
        await execAsync(strategies[i])
        console.log(`Download successful with strategy ${i + 1}`)
        return
      } catch (error) {
        console.log(`Strategy ${i + 1} failed:`, error.message)
        lastError = error
        
        // If this isn't the last strategy, continue to the next one
        if (i < strategies.length - 1) {
          continue
        }
      }
    }
    
    // If all strategies failed, throw the last error
    throw lastError || new Error("All download strategies failed")
  } else if (url.includes("dropbox.com")) {
    // Dropbox URL - handle specially with curl for better reliability
    let downloadUrl = url
    
    // Convert Dropbox preview links to direct download links
    if (url.includes("&dl=0")) {
      downloadUrl = url.replace("&dl=0", "&dl=1")
      console.log(`Converting Dropbox preview link to download link: ${downloadUrl}`)
    }
    
    console.log(`Downloading Dropbox file with curl: ${downloadUrl}`)
    await execAsync(`curl -L --max-time 600 --retry 3 --retry-delay 2 "${downloadUrl}" -o "${outputPath}"`)
    
    // Validate the downloaded file
    try {
      const stats = fs.statSync(outputPath)
      if (stats.size < 1000) {
        throw new Error(`Downloaded file is too small: ${stats.size} bytes`)
      }
      console.log(`Dropbox download successful: ${stats.size} bytes`)
    } catch (error) {
      console.error('File validation failed:', error)
      throw new Error(`Failed to download valid video file from Dropbox: ${error.message}`)
    }
  } else {
    // Direct video URL with timeout
    await execAsync(`curl -L --max-time 300 "${url}" -o "${outputPath}"`)
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
  try {
    console.log(`Uploading file to blob: ${filePath} as ${fileName}`)
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`)
    }
    
    const fileBuffer = fs.readFileSync(filePath)
    console.log(`File size: ${fileBuffer.length} bytes`)
    
    // Check if we're in development mode and don't have blob token
    if (process.env.NODE_ENV === 'development' && !process.env.BLOB_READ_WRITE_TOKEN) {
      console.log('Development mode detected, using local file download instead of blob')
      // For local development, we'll serve the file directly
      const publicDir = path.join(process.cwd(), 'public', 'downloads')
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }
      
      const localPath = path.join(publicDir, fileName)
      fs.copyFileSync(filePath, localPath)
      
      // Return a local URL
      return `/downloads/${fileName}`
    }
    
    const blob = await put(fileName, fileBuffer, { access: "public" })
    console.log(`Upload successful, blob URL: ${blob.url}`)
    
    return blob.url
  } catch (error) {
    console.error('Error uploading to blob:', error)
    
    // Fallback for local development
    if (process.env.NODE_ENV === 'development') {
      console.log('Falling back to local file storage')
      const publicDir = path.join(process.cwd(), 'public', 'downloads')
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true })
      }
      
      const localPath = path.join(publicDir, fileName)
      fs.copyFileSync(filePath, localPath)
      
      return `/downloads/${fileName}`
    }
    
    throw error
  }
}
