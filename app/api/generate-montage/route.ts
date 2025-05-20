import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import os from "os"
import { v4 as uuidv4 } from "uuid"
import { downloadVideo, processVideos, uploadToBlob } from "@/lib/ffmpeg-utils"

// In-memory job storage (would use a database in production)
const jobs = new Map<
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
    const data = await request.json()
    const {
      topVideoUrl,
      bottomVideoUrl,
      topStartTime = 0,
      topDuration = 30,
      bottomStartTime = 0,
      bottomDuration = 30,
      topVolume = 1.0,
      bottomVolume = 1.0,
    } = data

    // Validate inputs
    if (!topVideoUrl || !bottomVideoUrl) {
      return NextResponse.json({ error: "Missing video URLs" }, { status: 400 })
    }

    // Create a unique job ID
    const jobId = uuidv4()

    // Initialize job status
    jobs.set(jobId, {
      status: "pending",
      progress: 0,
    })

    // Process the videos in the background
    processJob(jobId, topVideoUrl, bottomVideoUrl, {
      topStartTime,
      topDuration,
      bottomStartTime,
      bottomDuration,
      topVolume,
      bottomVolume,
    })

    // Return the job ID immediately
    return NextResponse.json({ jobId })
  } catch (error) {
    console.error("Error generating montage:", error)
    return NextResponse.json({ error: "Failed to generate montage" }, { status: 500 })
  }
}

async function processJob(
  jobId: string,
  topVideoUrl: string,
  bottomVideoUrl: string,
  options: {
    topStartTime: number
    topDuration: number
    bottomStartTime: number
    bottomDuration: number
    topVolume: number
    bottomVolume: number
  },
) {
  try {
    // Update job status
    jobs.set(jobId, {
      status: "processing",
      progress: 10,
    })

    // Create temporary directory
    const tempDir = path.join(os.tmpdir(), `montage-${jobId}`)
    fs.mkdirSync(tempDir, { recursive: true })

    // Define file paths
    const topVideoPath = path.join(tempDir, "top-video.mp4")
    const bottomVideoPath = path.join(tempDir, "bottom-video.mp4")
    const outputPath = path.join(tempDir, "output.mp4")

    // Download videos
    jobs.set(jobId, { status: "processing", progress: 20 })
    await downloadVideo(topVideoUrl, topVideoPath)

    jobs.set(jobId, { status: "processing", progress: 40 })
    await downloadVideo(bottomVideoUrl, bottomVideoPath)

    // Process videos
    jobs.set(jobId, { status: "processing", progress: 60 })
    await processVideos(topVideoPath, bottomVideoPath, outputPath, options)

    // Upload to Vercel Blob
    jobs.set(jobId, { status: "processing", progress: 80 })
    const downloadUrl = await uploadToBlob(outputPath, `montage-${jobId}.mp4`)

    // Update job status to completed
    jobs.set(jobId, {
      status: "completed",
      progress: 100,
      downloadUrl,
    })

    // Clean up temporary files
    try {
      fs.unlinkSync(topVideoPath)
      fs.unlinkSync(bottomVideoPath)
      fs.unlinkSync(outputPath)
      fs.rmdirSync(tempDir)
    } catch (cleanupError) {
      console.error("Error cleaning up temp files:", cleanupError)
    }
  } catch (error) {
    console.error("Error processing job:", error)
    jobs.set(jobId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

// Export job status map for the status endpoint
export { jobs }
