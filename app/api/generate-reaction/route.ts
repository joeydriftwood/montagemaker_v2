import { type NextRequest, NextResponse } from "next/server"
import { exec, execSync } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"
import { put } from "@vercel/blob"
import { promisify } from "util"

const execPromise = promisify(exec)

// In-memory job storage (in a real app, you'd use a database)
interface Job {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  progress: number
  error?: string
  downloadUrl?: string
  createdAt: number
  tempDir?: string
}

// Use global jobs map to share between API routes
declare global {
  var _jobs: Map<string, Job>
}

// Initialize global jobs map if it doesn't exist
if (!global._jobs) {
  global._jobs = new Map<string, Job>()
}

const jobs = global._jobs

// Clean up old jobs (older than 1 hour)
function cleanupOldJobs() {
  const now = Date.now()
  const oneHour = 60 * 60 * 1000

  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > oneHour) {
      // Clean up temp directory if it exists
      if (job.tempDir && fs.existsSync(job.tempDir)) {
        try {
          fs.rmSync(job.tempDir, { recursive: true, force: true })
        } catch (error) {
          console.error(`Failed to remove temp directory for job ${id}:`, error)
        }
      }
      jobs.delete(id)
    }
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldJobs, 15 * 60 * 1000)

// Check if required tools are installed
function checkRequiredTools() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" })
  } catch (error) {
    throw new Error("FFmpeg is not installed or not in PATH")
  }

  try {
    execSync("yt-dlp --version", { stdio: "ignore" })
  } catch (error) {
    throw new Error("yt-dlp is not installed or not in PATH")
  }
}

// Convert Dropbox link to direct download link if needed
function convertDropboxLink(url: string): string {
  if (url.includes("dropbox.com") && !url.includes("raw=1")) {
    if (url.endsWith("dl=0")) {
      return url.slice(0, -4) + "raw=1"
    } else if (!url.includes("?")) {
      return url + "?raw=1"
    }
  }
  return url
}

// Download video from URL (supports YouTube and direct links)
async function downloadVideo(url: string, outputPath: string, jobId: string): Promise<void> {
  // Update job status
  const job = jobs.get(jobId)!
  job.status = "processing"
  job.progress = 10

  // Convert Dropbox link if needed
  url = convertDropboxLink(url)

  // Check if it's a YouTube URL
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    try {
      await execPromise(`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4" "${url}" -o "${outputPath}"`)
    } catch (error) {
      throw new Error(`Failed to download YouTube video: ${error.message}`)
    }
  } else {
    // Direct download
    try {
      await execPromise(`curl -L "${url}" -o "${outputPath}"`)
    } catch (error) {
      throw new Error(`Failed to download video: ${error.message}`)
    }
  }

  // Verify the file exists and has content
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("Downloaded file is empty or does not exist")
  }
}

// Process videos with FFmpeg
async function processVideos(
  topVideoPath: string,
  bottomVideoPath: string,
  outputPath: string,
  options: {
    topStartTime?: number
    bottomStartTime?: number
    duration?: number
    topVolume?: number
    bottomVolume?: number
  },
  jobId: string,
): Promise<void> {
  const job = jobs.get(jobId)!
  job.progress = 50

  // Build FFmpeg command
  const topStart = options.topStartTime ? `-ss ${options.topStartTime}` : ""
  const bottomStart = options.bottomStartTime ? `-ss ${options.bottomStartTime}` : ""
  const duration = options.duration ? `-t ${options.duration}` : ""
  const topVol = options.topVolume !== undefined ? options.topVolume : 1.0
  const bottomVol = options.bottomVolume !== undefined ? options.bottomVolume : 1.0

  // FFmpeg command to stack videos vertically
  const command = `ffmpeg ${topStart} -i "${topVideoPath}" ${bottomStart} -i "${bottomVideoPath}" ${duration} -filter_complex "[0:v]scale=iw:ih[top];[1:v]scale=iw:ih[bottom];[top][bottom]vstack=inputs=2[v];[0:a]volume=${topVol}[a1];[1:a]volume=${bottomVol}[a2];[a1][a2]amix=inputs=2:duration=longest[a]" -map "[v]" -map "[a]" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 128k "${outputPath}"`

  try {
    await execPromise(command)
  } catch (error) {
    throw new Error(`FFmpeg processing failed: ${error.message}`)
  }

  // Verify the output file exists and has content
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("Output video is empty or does not exist")
  }

  job.progress = 80
}

export async function POST(request: NextRequest) {
  try {
    // Check if required tools are installed
    try {
      checkRequiredTools()
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Parse request body
    const data = await request.json()
    const { topVideo, bottomVideo, topStartTime, bottomStartTime, duration, topVolume, bottomVolume } = data

    // Validate inputs
    if (!topVideo || !bottomVideo) {
      return NextResponse.json({ error: "Both top and bottom video URLs are required" }, { status: 400 })
    }

    // Create a unique job ID
    const jobId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)

    // Create a temporary directory for this job
    const tempDir = path.join(os.tmpdir(), `reaction-video-${jobId}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Initialize job
    jobs.set(jobId, {
      id: jobId,
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
      tempDir,
    })

    // Process videos asynchronously
    ;(async () => {
      try {
        const job = jobs.get(jobId)!

        // Download videos
        const topVideoPath = path.join(tempDir, "top-video.mp4")
        const bottomVideoPath = path.join(tempDir, "bottom-video.mp4")
        const outputPath = path.join(tempDir, "output.mp4")

        await downloadVideo(topVideo, topVideoPath, jobId)
        await downloadVideo(bottomVideo, bottomVideoPath, jobId)

        // Process videos
        await processVideos(
          topVideoPath,
          bottomVideoPath,
          outputPath,
          {
            topStartTime: topStartTime !== undefined ? Number.parseFloat(topStartTime) : undefined,
            bottomStartTime: bottomStartTime !== undefined ? Number.parseFloat(bottomStartTime) : undefined,
            duration: duration !== undefined ? Number.parseFloat(duration) : undefined,
            topVolume: topVolume !== undefined ? Number.parseFloat(topVolume) : undefined,
            bottomVolume: bottomVolume !== undefined ? Number.parseFloat(bottomVolume) : undefined,
          },
          jobId,
        )

        // Upload to Vercel Blob
        const blob = await put(`reaction-video-${jobId}.mp4`, fs.createReadStream(outputPath), {
          access: "public",
        })

        // Update job status
        job.status = "completed"
        job.progress = 100
        job.downloadUrl = blob.url

        // Clean up temp files
        try {
          fs.rmSync(tempDir, { recursive: true, force: true })
        } catch (error) {
          console.error(`Failed to remove temp directory for job ${jobId}:`, error)
        }
      } catch (error) {
        const job = jobs.get(jobId)
        if (job) {
          job.status = "failed"
          job.error = error.message || "Unknown error occurred"

          // Clean up temp files on error
          if (job.tempDir && fs.existsSync(job.tempDir)) {
            try {
              fs.rmSync(job.tempDir, { recursive: true, force: true })
            } catch (cleanupError) {
              console.error(`Failed to remove temp directory for job ${jobId}:`, cleanupError)
            }
          }
        }
      }
    })()

    // Return job ID immediately
    return NextResponse.json({ jobId })
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unknown error occurred" }, { status: 500 })
  }
}
