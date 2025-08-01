// src/lib/queue.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Queue } from 'bullmq';
import Redis from 'ioredis';

export interface GenerationJobData {
  projectId: string;
  combo: { id: string; [key: string]: string };
  description: string;
  replicateConfig: {
    model: string;
    input: {
      prompt: string;
      [key: string]: any;
    };
  };
}

console.log('Initializing Redis client...');
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('error', (err) => console.error('Redis client error:', err));

console.log('Initializing generation queue...');
export const generationQueue = new Queue<GenerationJobData>('generate-nft', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

generationQueue.on('error', (err) => console.error('Queue error:', err));
generationQueue.on('waiting', async (jobId) => {
  const waitingJobs = await generationQueue.getWaiting();
  console.log(`Job ${jobId} is waiting in queue. Total waiting jobs: ${waitingJobs.length}`, waitingJobs.map(job => job.id));
});
console.log('Generation queue initialized');