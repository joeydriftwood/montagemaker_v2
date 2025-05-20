import { type NextRequest, NextResponse } from "next/server"
import { jobs } from "../generate-montage/route"

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("jobId")

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId parameter" }, { status: 400 })
  }

  const job = jobs.get(jobId)

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json(job)
}
