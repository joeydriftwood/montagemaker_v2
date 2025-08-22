import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/jobs";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: "No job ID provided" }, { status: 400 });
    }

    let job = getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Don't override the job status if it's already being processed by cloud processing
    // Only simulate progress for local jobs or if no real progress is being made
    if (job.status === 'pending' && job.progress === 0) {
      // This is likely a local job, simulate progress
      let newProgress = Math.min(job.progress + 10, 100);
      let newStatus: 'pending' | 'processing' | 'completed' | 'failed' = newProgress >= 100 ? 'completed' : 'processing';
      job = updateJob(jobId, {
        progress: newProgress,
        status: newStatus,
        downloadUrl: newStatus === 'completed' ? '/api/download/montage.mp4' : undefined,
      }) || job;
    }

    if (!job) {
      return NextResponse.json({ error: "Job not found after update" }, { status: 404 });
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress,
      error: job.error,
      downloadUrl: job.downloadUrl,
      allDownloadUrls: job.allDownloadUrls,
    });
  } catch (err) {
    console.error("Error in job-status:", err);
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 });
  }
} 