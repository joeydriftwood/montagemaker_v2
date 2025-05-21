import { type NextRequest, NextResponse } from "next/server"
import { jobs } from "../generate-montage/route"
import { reactionJobs } from "../generate-reaction/route"

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId")
    const jobType = request.nextUrl.searchParams.get("type") || "montage"

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId parameter" }, { status: 400 })
    }

    // Check the appropriate job store based on type
    const job = jobType === "reaction" ? reactionJobs.get(jobId) : jobs.get(jobId)

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error("Error getting job status:", error)
    return NextResponse.json(
      { error: "Failed to get job status: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 },
    )
  }
}
