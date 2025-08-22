import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { downloadVideo, uploadToBlob } from "@/lib/ffmpeg-utils"

const execAsync = promisify(exec)

// In-memory job storage (would use a database in production)
export const reactionJobs = new Map<
  string,
  {
    status: "pending" | "processing" | "completed" | "failed"
    progress: number
    error?: string
    downloadUrl?: string
  }
>()

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const data = await request.json()

    const {
      topVideo,
      bottomVideo,
      topStartTime = 0,
      bottomStartTime = 0,
      duration = 60,
      topVolume = 1.0,
      bottomVolume = 1.0,
    } = data

    // Validate inputs
    if (!topVideo || !bottomVideo) {
      return NextResponse.json({ error: "Both top and bottom video URLs are required" }, { status: 400 })
    }

    // Create a unique job ID
    const jobId = randomUUID()

    // Initialize job status
    reactionJobs.set(jobId, {
      status: "pending",
      progress: 0,
    })

    // Process the video in the background
    processReactionJob(jobId, {
      topVideo,
      bottomVideo,
      topStartTime,
      bottomStartTime,
      duration,
      topVolume,
      bottomVolume,
    })

    // Return the job ID immediately
    return NextResponse.json({ jobId })
  } catch (error) {
    console.error("Error generating reaction video:", error)
    return NextResponse.json(
      { error: "Failed to generate reaction video: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

// Process a reaction video job
async function processReactionJob(
  jobId: string,
  options: {
    topVideo: string
    bottomVideo: string
    topStartTime: number
    bottomStartTime: number
    duration: number
    topVolume: number
    bottomVolume: number
  },
) {
  const workDir = path.join(os.tmpdir(), `reaction-${jobId}`)
  
  try {
    // Create working directory
    fs.mkdirSync(workDir, { recursive: true })
    
    // Update job status to processing
    reactionJobs.set(jobId, {
      status: "processing",
      progress: 10,
    })

    // Download top video
    console.log(`Downloading top video: ${options.topVideo}`)
    const topVideoPath = path.join(workDir, "top_video.mp4")
    await downloadVideo(options.topVideo, topVideoPath)
    
    reactionJobs.set(jobId, { status: "processing", progress: 30 })

    // Download bottom video
    console.log(`Downloading bottom video: ${options.bottomVideo}`)
    const bottomVideoPath = path.join(workDir, "bottom_video.mp4")
    await downloadVideo(options.bottomVideo, bottomVideoPath)
    
    reactionJobs.set(jobId, { status: "processing", progress: 50 })

    // Create reaction video using FFmpeg
    console.log("Creating reaction video...")
    const outputPath = path.join(workDir, "reaction_video.mp4")
    
    // Build FFmpeg command for side-by-side reaction video
    const ffmpegCmd = `ffmpeg -y \
      -ss ${options.topStartTime} -i "${topVideoPath}" \
      -ss ${options.bottomStartTime} -i "${bottomVideoPath}" \
      -filter_complex "[0:v]scale=640:360,setpts=PTS-STARTPTS[top];[1:v]scale=640:360,setpts=PTS-STARTPTS[bottom];[top][bottom]vstack=inputs=2" \
      -map "[top]" -map "[bottom]" \
      -filter:a "[0:a]volume=${options.topVolume}[top_audio];[1:a]volume=${options.bottomVolume}[bottom_audio];[top_audio][bottom_audio]amix=inputs=2:duration=longest" \
      -t ${options.duration} \
      -c:v libx264 -c:a aac -pix_fmt yuv420p "${outputPath}"`
    
    console.log(`Executing FFmpeg command: ${ffmpegCmd}`)
    await execAsync(ffmpegCmd)
    
    reactionJobs.set(jobId, { status: "processing", progress: 80 })

    // Upload the result
    console.log("Uploading reaction video...")
    const fileName = `reaction_${jobId}_${Date.now()}.mp4`
    const downloadUrl = await uploadToBlob(outputPath, fileName)
    
    reactionJobs.set(jobId, { status: "processing", progress: 90 })

    // Update job status to completed
    reactionJobs.set(jobId, {
      status: "completed",
      progress: 100,
      downloadUrl: downloadUrl,
    })

    console.log(`Reaction video completed: ${downloadUrl}`)

    // Clean up temp files
    fs.rmSync(workDir, { recursive: true, force: true })
    
  } catch (error) {
    console.error("Error processing reaction job:", error)
    reactionJobs.set(jobId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    
    // Clean up temp files on error
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true })
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temp files:", cleanupError)
    }
  }
}
