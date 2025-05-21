import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import { exec } from "child_process";
import path from "path";
import os from "os";

function downloadVideo(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dropbox = url.includes("dropbox.com");
    const finalUrl = dropbox ? url.replace("?dl=0", "?dl=1") : url;

    const cmd = `curl -L "${finalUrl}" --output "${outputPath}"`;
    exec(cmd, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function extractClips(
  input: string,
  outputDir: string,
  count: number,
  start: number,
  end: number,
  duration: number,
  linear: boolean
): Promise<string[]> {
  const interval = Math.floor((end - start - duration) / count);
  const clips: string[] = [];

  const promises = Array.from({ length: count }).map((_, i) => {
    const clipStart = linear
      ? start + i * interval
      : start + Math.floor(Math.random() * (end - start - duration));
    const output = path.join(outputDir, `clip${i}.mp4`);
    clips.push(output);

    const cmd = `ffmpeg -ss ${clipStart} -i "${input}" -t ${duration} -c:v libx264 -c:a aac "${output}" -y`;
    return new Promise((resolve, reject) => {
      exec(cmd, (err) => (err ? reject(err) : resolve(null)));
    });
  });

  return Promise.all(promises).then(() => clips);
}

function combineClips(clips: string[], output: string): Promise<void> {
  return fs
    .writeFile(
      path.join(path.dirname(output), "inputs.txt"),
      clips.map((c) => `file '${c}'`).join("\n")
    )
    .then(
      () =>
        new Promise((resolve, reject) => {
          const cmd = `ffmpeg -f concat -safe 0 -i "${path.join(
            path.dirname(output),
            "inputs.txt"
          )}" -c copy "${output}" -y`;
          exec(cmd, (err) => (err ? reject(err) : resolve()));
        })
    );
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    videoUrls,
    startCutAt = 0,
    endCutAt = 60,
    interval = 1,
    montageLength = 15,
    linearMode = false,
    resolution = "original",
    keepAudio = false,
    layoutType = "cut",
    variations = 1,
    customFilename = "montage.mp4",
  } = body;

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "montage-"));
  const inputPath = path.join(tempDir, "source.mp4");

  try {
    await downloadVideo(videoUrls[0], inputPath);
    const clips = await extractClips(
      inputPath,
      tempDir,
      Math.floor(montageLength / interval),
      startCutAt,
      endCutAt,
      interval,
      linearMode
    );

    const outputPath = path.join(tempDir, "montage.mp4");
    await combineClips(clips, outputPath);

    const file = await fs.readFile(outputPath);
    const blob = await put(`${randomUUID()}-${customFilename}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url, jobId: randomUUID() });
  } catch (err) {
    console.error("Montage error:", err);
    return NextResponse.json(
      { error: "Failed to generate montage" },
      { status: 500 }
    );
  }
}