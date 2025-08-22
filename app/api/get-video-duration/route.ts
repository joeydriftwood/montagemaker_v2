import { NextRequest, NextResponse } from "next/server"
import { getVideoDuration } from "@/lib/ffmpeg-utils"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }
    
    const duration = await getVideoDuration(url)
    
    return NextResponse.json({ duration })
  } catch (error) {
    console.error("Error getting video duration:", error)
    return NextResponse.json(
      { error: "Failed to get video duration" },
      { status: 500 }
    )
  }
}
