import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

// In-memory job storage (would use a database in production)
export const jobs = new Map<
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
      videoUrls,
      startCutAt = 0,
      endCutAt = 60,
      interval = 1,
      montageLength = 30,
      linearMode = true,
      layoutType = "cut",
      resolution = "720p",
      keepAudio = true,
      variations = 1,
      customFilename = "montage.mp4",
      montageType = "fixed",
      bpm = 120,
    } = data

    // Validate inputs
    if (!videoUrls || videoUrls.length === 0 || !videoUrls[0]) {
      return NextResponse.json({ error: "Missing video URL" }, { status: 400 })
    }

    // Create a unique job ID
    const jobId = randomUUID()

    // Initialize job status
    jobs.set(jobId, {
      status: "pending",
      progress: 0,
    })

    // Process the video in the background
    processJob(jobId, videoUrls, {
      startCutAt,
      endCutAt,
      interval,
      montageLength,
      linearMode,
      layoutType,
      resolution,
      keepAudio,
      variations,
      customFilename,
      montageType,
      bpm,
    })

    // Return the job ID immediately
    return NextResponse.json({ jobId })
  } catch (error) {
    console.error("Error generating montage:", error)
    return NextResponse.json(
      { error: "Failed to generate montage: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}

// Simulate processing a job
async function processJob(
  jobId: string,
  videoUrls: string[],
  options: {
    startCutAt: number
    endCutAt: number
    interval: number
    montageLength: number
    linearMode: boolean
    layoutType: string
    resolution: string
    keepAudio: boolean
    variations: number
    customFilename: string
    montageType: string
    bpm: number
  },
) {
  try {
    // Update job status to processing
    jobs.set(jobId, {
      status: "processing",
      progress: 10,
    })

    // Simulate processing steps
    await new Promise((resolve) => setTimeout(resolve, 500))
    jobs.set(jobId, { status: "processing", progress: 30 })

    await new Promise((resolve) => setTimeout(resolve, 500))
    jobs.set(jobId, { status: "processing", progress: 50 })

    await new Promise((resolve) => setTimeout(resolve, 500))
    jobs.set(jobId, { status: "processing", progress: 70 })

    await new Promise((resolve) => setTimeout(resolve, 500))
    jobs.set(jobId, { status: "processing", progress: 90 })

    // Simulate completion
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Update job status to completed with a fake download URL
    jobs.set(jobId, {
      status: "completed",
      progress: 100,
      downloadUrl: `https://example.com/montages/${jobId}/${options.customFilename}`,
    })

    // In a real implementation, you would:
    // 1. Download the videos
    // 2. Process them with FFmpeg
    // 3. Upload the result to storage
    // 4. Return the download URL
  } catch (error) {
    console.error("Error processing job:", error)
    jobs.set(jobId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
