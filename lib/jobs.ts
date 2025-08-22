import { randomUUID } from 'crypto';

// In-memory job store (replace with a proper database in production)
const jobs = new Map();

// Keep track of active jobs to prevent garbage collection
const activeJobs = new Set();

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  downloadUrl?: string;
  allDownloadUrls?: string[];
  createdAt: string;
  params: any;
}

export function createJob(params: any): Job {
  const job: Job = {
    id: randomUUID(),
    status: 'pending',
    progress: 0,
    createdAt: new Date().toISOString(),
    params,
  };
  jobs.set(job.id, job);
  activeJobs.add(job.id);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<Job>) {
  const job = jobs.get(id);
  if (job) {
    const updatedJob = { ...job, ...updates };
    jobs.set(id, updatedJob);
    activeJobs.add(id);
    return updatedJob;
  }
  return undefined;
}

// Clean up completed or failed jobs after 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.status === 'completed' || job.status === 'failed') {
      const createdAt = new Date(job.createdAt).getTime();
      if (now - createdAt > 3600000) { // 1 hour
        jobs.delete(id);
        activeJobs.delete(id);
      }
    }
  }
}, 300000); // Check every 5 minutes 