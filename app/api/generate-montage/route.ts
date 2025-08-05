import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

// Helper to save a real video using yt-dlp (simple, robust)
async function downloadVideoWithYtDlp(url: string, filename: string): Promise<string> {
  const downloadsDir = path.join(process.cwd(), "public", "downloads");
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  const filePath = path.join(downloadsDir, filename);

  return new Promise((resolve, reject) => {
    const ytDlp = spawn("yt-dlp", [
      url,
      "-o", filePath,
      "--no-playlist"
    ]);

    let stderr = "";
    ytDlp.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`yt-dlp stderr: ${data}`);
    });

    ytDlp.on("error", (err) => {
      reject(new Error("yt-dlp process failed: " + err.message));
    });

    ytDlp.on("close", (code) => {
      if (code === 0) {
        resolve(`/downloads/${filename}`);
      } else {
        reject(new Error(`yt-dlp exited with code ${code}. Details: ${stderr}`));
      }
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoUrls, customFilename } = body;
    if (!videoUrls || !videoUrls[0]) {
      return NextResponse.json({ error: "No video URL provided" }, { status: 400 });
    }
    const url = videoUrls[0];
    const filename = customFilename || `video-${Date.now()}.mp4`;
    const downloadUrl = await downloadVideoWithYtDlp(url, filename);
    return NextResponse.json({ downloadUrl });
  } catch (err) {
    console.error("Error in generate-montage:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 