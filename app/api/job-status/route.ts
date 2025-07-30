import { type NextRequest, NextResponse } from "next/server"

// Proxy to Render backend
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL || "https://montagemaker-downloader.onrender.com"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')
    const type = searchParams.get('type')

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    // Proxy the request to Render backend
    const response = await fetch(`${RENDER_BACKEND_URL}/api/job-status?jobId=${jobId}${type ? `&type=${type}` : ''}`)

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: error.error || "Failed to get job status" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in job-status:", error)
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 })
  }
}
