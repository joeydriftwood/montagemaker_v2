import { type NextRequest, NextResponse } from "next/server"

// Proxy to Render backend
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL || "https://montagemaker-downloader.onrender.com"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.videoUrls || body.videoUrls.length === 0) {
      return NextResponse.json({ error: "At least one video URL is required" }, { status: 400 })
    }

    // Proxy the request to Render backend
    const response = await fetch(`${RENDER_BACKEND_URL}/api/generate-montage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // Try to parse error as JSON, fallback to text if it's not JSON
      let errorMessage = "Failed to start montage generation"
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
    console.error("Error in generate-montage:", error)
    return NextResponse.json({ error: "Failed to start montage generation" }, { status: 500 })
  }
}
