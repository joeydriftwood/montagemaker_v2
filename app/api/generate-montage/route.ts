import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { randomUUID } from "crypto"
import fs from "fs/promises"
import { exec } from "child_process"
import path from "path"
import os from "os"
import { promisify } from "util"

const execAsync = promisify(exec)

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

async function downloadVideo(url: string, outputPath: string): Promise<void> {
  const yt = url.includes("youtube.com") || url.includes("youtu.be")
  const dropbox = url.includes("dropbox.com")

  let finalUrl = url
  if (dropbox) {
    finalUrl = url.includes("dl=0") ? url.replace("dl=0", "raw=1") : url.includes("?") ? url + "&raw=1" : url + "?raw=1"
  }

  const cmd = yt ? `yt-dlp -f "best" "${url}" -o "${outputPath}"` : `curl -L "${finalUrl}" --output "${outputPath}"`

  await execAsync(cmd)
}

async function extractClips(
  input: string,
  outputDir: string,
  count: number,
  start: number,
  end: number,
  duration: number,
  linear: boolean,
): Promise<string[]> {
  const clips: string[] = []
  const interval = Math.floor((end - start - duration) / (count > 0 ? count : 1))

  for (let i = 0; i < count; i++) {
    const clipStart = linear ? start + i * interval : start + Math.floor(Math.random() * (end - start - duration))

    const output = path.join(outputDir, `clip${i.toString().padStart(3, "0")}.mp4`)
    clips.push(output)

    const cmd = `ffmpeg -ss ${clipStart} -i "${input}" -t ${duration} -c:v libx264 -c:a aac -y "${output}"`
    await execAsync(cmd)
  }

  return clips
}

async function combineClips(clips: string[], output: string, keepAudio: boolean): Promise<void> {
  const listFile = path.join(path.dirname(output), "inputs.txt")
  await fs.writeFile(listFile, clips.map((c) => `file '${path.basename(c)}'`).join("\n"))

  const audioFlag = keepAudio ? "" : "-an"
  const cmd = `cd "${path.dirname(output)}" && ffmpeg -f concat -safe 0 -i inputs.txt ${audioFlag} -c:v libx264 -pix_fmt yuv420p -y "${output}"`
  await execAsync(cmd)
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const {
      videoUrls,
      montageType = "fixed",
      layoutType = "cut",
      useRandomPositions = false,
      interval = 1,
      bpm = 120,
      montageLength = 30,
      keepAudio = true,
      resolution = "720p",
      linearMode = true,
      customFilename = "montage.mp4",
      startCutAt = 0,
      endCutAt = 60,
      variations = 1,
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
    processJob(jobId, videoUrls[0], {
      montageType,
      layoutType,
      useRandomPositions,
      interval,
      bpm,
      montageLength,
      keepAudio,
      resolution,
      linearMode,
      customFilename,
      startCutAt,
      endCutAt,
      variations,
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
  videoUrl: string,
  options: {
    montageType: string
    layoutType: string
    useRandomPositions: boolean
    interval: number
    bpm: number
    montageLength: number
    keepAudio: boolean
    resolution: string
    linearMode: boolean
    customFilename: string
    startCutAt: number
    endCutAt: number
    variations: number
  },
) {
  try {
    // Update job status
    jobs.set(jobId, {
      status: "processing",
      progress: 10,
    })

    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `montage-${jobId}-`))

    // Define file paths
    const videoPath = path.join(tempDir, "source.mp4")
    const outputPath = path.join(tempDir, "output.mp4")

    // Download video
    jobs.set(jobId, { status: "processing", progress: 20 })
    await downloadVideo(videoUrl, videoPath)

    // Calculate clip parameters
    const clipDuration = options.montageType === "fixed" ? options.interval : 60 / options.bpm

    const numClips = Math.ceil(options.montageLength / clipDuration)

    // Extract clips
    jobs.set(jobId, { status: "processing", progress: 40 })
    const clips = await extractClips(
      videoPath,
      tempDir,
      numClips,
      options.startCutAt,
      options.endCutAt,
      clipDuration,
      options.linearMode,
    )

    // Combine clips
    jobs.set(jobId, { status: "processing", progress: 70 })
    await combineClips(clips, outputPath, options.keepAudio)

    // Upload to Vercel Blob
    jobs.set(jobId, { status: "processing", progress: 90 })
    const fileContent = await fs.readFile(outputPath)
    const filename = options.customFilename || "montage.mp4"
    const blob = await put(`${jobId}-${filename}`, fileContent, { access: "public" })

    // Update job status to completed
    jobs.set(jobId, {
      status: "completed",
      progress: 100,
      downloadUrl: blob.url,
    })

    // Clean up temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
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
