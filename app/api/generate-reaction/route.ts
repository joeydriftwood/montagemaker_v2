import { type NextRequest, NextResponse } from "next/server"

// Proxy to Render backend
const RENDER_BACKEND_URL = process.env.RENDER_BACKEND_URL || "https://montagemaker-downloader.onrender.com"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.topVideo || !body.bottomVideo) {
      return NextResponse.json({ error: "Both top and bottom video URLs are required" }, { status: 400 })
    }

    // Proxy the request to Render backend
    const response = await fetch(`${RENDER_BACKEND_URL}/api/generate-reaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error: error.error || "Failed to start reaction video generation" }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in generate-reaction:", error)
    return NextResponse.json({ error: "Failed to start reaction video generation" }, { status: 500 })
  }
}
