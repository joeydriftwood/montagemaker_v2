import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

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

// Simulate processing a reaction video job
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
  try {
    // Update job status to processing
    reactionJobs.set(jobId, {
      status: "processing",
      progress: 10,
    })

    // Simulate processing steps
    await new Promise((resolve) => setTimeout(resolve, 500))
    reactionJobs.set(jobId, { status: "processing", progress: 30 })

    await new Promise((resolve) => setTimeout(resolve, 500))
    reactionJobs.set(jobId, { status: "processing", progress: 50 })

    await new Promise((resolve) => setTimeout(resolve, 500))
    reactionJobs.set(jobId, { status: "processing", progress: 70 })

    await new Promise((resolve) => setTimeout(resolve, 500))
    reactionJobs.set(jobId, { status: "processing", progress: 90 })

    // Simulate completion
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Update job status to completed with a fake download URL
    reactionJobs.set(jobId, {
      status: "completed",
      progress: 100,
      downloadUrl: `https://example.com/reactions/${jobId}/reaction-video.mp4`,
    })

    // In a real implementation, you would:
    // 1. Download the videos
    // 2. Process them with FFmpeg
    // 3. Upload the result to storage
    // 4. Return the download URL
  } catch (error) {
    console.error("Error processing reaction job:", error)
    reactionJobs.set(jobId, {
      status: "failed",
      progress: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
