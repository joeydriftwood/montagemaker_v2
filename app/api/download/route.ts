import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  console.log("🔁 Mock downloader received:", url);

  return NextResponse.json({
    file: "https://www.dropbox.com/s/2gnxoj3aqadwm3r/testclip.mp4?dl=1"
  });
}