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

    // Simulate progress on each poll
    if ((job.status === 'pending' || job.status === 'processing') && job.progress < 100) {
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
    });
  } catch (err) {
    console.error("Error in job-status:", err);
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 });
  }
} 