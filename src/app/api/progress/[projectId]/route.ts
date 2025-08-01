// app/api/progress/[projectId]/route.ts
import { NextResponse } from 'next/server';
import { generationQueue } from '@/lib/queue';
import { Job } from 'bullmq';

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  console.log(`Fetching progress for project ${projectId} at ${new Date().toISOString()}`);

  try {
    const jobs = await generationQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, -1, true);
    console.log(`Total jobs retrieved: ${jobs.length}`);

    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const relevantJobs: Job[] = [];

    for (const job of jobs) {
      const isRelevant = job.data?.projectId === projectId;
      const isRecent = !job.timestamp || job.timestamp > twentyFourHoursAgo;

      if (isRelevant && isRecent) {
        relevantJobs.push(job);
      }
    }

    const statusChecks = await Promise.all(
      relevantJobs.map(async (job) => ({
        isCompleted: await job.isCompleted(),
        isFailed: await job.isFailed(),
      }))
    );

    const total = relevantJobs.length;
    const completed = statusChecks.filter((s) => s.isCompleted).length;
    const failed = statusChecks.filter((s) => s.isFailed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log(`Project ${projectId}: ${completed}/${total} completed, ${failed} failed (${progress}%)`);

    return NextResponse.json({ total, completed, failed, progress });
  } catch (error) {
    console.error(`Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}