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

    // Proxy the request to Render backend (using path parameter)
    const response = await fetch(`${RENDER_BACKEND_URL}/api/job-status/${jobId}`)

    if (!response.ok) {
      // Try to parse error as JSON, fallback to text if it's not JSON
      let errorMessage = "Failed to get job status"
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
      } catch (parseError) {
        // If response is not JSON (e.g., HTML error page), get text
        const errorText = await response.text()
        console.error("Backend returned non-JSON response:", errorText)
        errorMessage = `Backend error: ${response.status} ${response.statusText}`
      }
      return NextResponse.json({ error: errorMessage }, { status: response.status })
    }

    // Try to parse response as JSON
    let data
    try {
      data = await response.json()
    } catch (parseError) {
      console.error("Failed to parse backend response as JSON:", parseError)
      return NextResponse.json({ error: "Invalid response from backend" }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in job-status:", error)
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 })
  }
}
