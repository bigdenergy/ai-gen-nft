// src/lib/worker.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { Worker, Job } from 'bullmq';
import Replicate from 'replicate';
import { supabase } from './supabase.js';
import { redisClient, GenerationJobData } from './queue.js';

console.log('Loading worker.ts...');
console.log('Environment variables:', {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  replicateToken: process.env.REPLICATE_API_TOKEN,
  redisUrl: process.env.REDIS_URL,
});

// Typage pour la réponse de Replicate
interface ReplicateOutput {
  [index: number]: string;
}

// Validation du format du modèle
function isValidModel(model: string): model is `${string}/${string}:${string}` {
  return /^[^/]+\/[^/]+:[^/]+$/.test(model);
}

// Vérification des variables d'environnement
console.log('Checking environment variables...');
if (!process.env.REPLICATE_API_TOKEN) {
  throw new Error('REPLICATE_API_TOKEN is not set in .env.local');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Supabase environment variables are not set');
}

console.log('Initializing Replicate client...');
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });

console.log('Starting worker...');

const worker = new Worker<GenerationJobData>(
  'generate-nft',
  async (job: Job<GenerationJobData>) => {
    console.log(`Received job ${job.id}:`, JSON.stringify(job.data, null, 2));
    const { projectId, combo, description, replicateConfig } = job.data;

    try {
      console.log(`Validating job data for job ${job.id}...`);
      if (!projectId || !combo || !combo.id || !description || !replicateConfig || !replicateConfig.model) {
        throw new Error(`Invalid job data: missing required fields (projectId, combo, description, replicateConfig)`);
      }

      console.log(`Validating model format for job ${job.id}...`);
      if (!isValidModel(replicateConfig.model)) {
        throw new Error(`Invalid model format: ${replicateConfig.model}. Expected format: owner/model:version`);
      }

      console.log(`Running Replicate model ${replicateConfig.model} for job ${job.id}...`);
      await job.updateProgress(10);
      let output: ReplicateOutput;
      try {
        output = (await replicate.run(replicateConfig.model, {
          input: replicateConfig.input,
        })) as ReplicateOutput;
        console.log(`Replicate output for job ${job.id}:`, output);
      } catch (replicateError) {
        console.error(`Replicate API error for job ${job.id}:`, replicateError);
        throw new Error(`Replicate failed: ${replicateError instanceof Error ? replicateError.message : 'Unknown error'}`);
      }
      const imageUrl = output[0];
      if (!imageUrl) {
        throw new Error(`No image URL returned by Replicate for job ${job.id}`);
      }
      console.log(`Image generated for job ${job.id}:`, imageUrl);
      await job.updateProgress(50);

      console.log(`Fetching image for job ${job.id}...`);
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image for job ${job.id}: ${imageResponse.statusText}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();

      console.log(`Checking if bucket nft-images exists for job ${job.id}...`);
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        console.error(`Error checking buckets for job ${job.id}:`, bucketError);
        console.warn(`Proceeding with upload attempt despite listBuckets error for job ${job.id}...`);
      } else {
        console.log(`Buckets found for job ${job.id}:`, buckets.map(b => b.name));
        const bucketExists = buckets.some(bucket => bucket.name === 'nft-images');
        if (!bucketExists) {
          console.warn(`Bucket nft-images not found in listBuckets for job ${job.id}. Attempting upload anyway to test permissions...`);
        }
      }

      console.log(`Uploading image to Supabase bucket nft-images for job ${job.id}...`);
      const { data, error } = await supabase.storage
        .from('nft-images')
        .upload(`${projectId}/${combo.id}.png`, imageBuffer, { contentType: 'image/png' });

      if (error) {
        console.error(`Supabase storage error for job ${job.id}:`, error);
        throw new Error(`Erreur stockage: ${error.message}`);
      }
      console.log(`Image uploaded to Supabase for job ${job.id}:`, data.path);
      await job.updateProgress(80);

      console.log(`Generating metadata for job ${job.id}...`);
      const metadata = {
        name: `NFT #${combo.id}`,
        description,
        attributes: Object.entries(combo)
          .filter(([key]) => key !== 'id')
          .map(([trait_type, value]) => ({ trait_type, value })),
      };

      console.log(`Inserting NFT into database for job ${job.id}...`);
      const { error: dbError } = await supabase.from('nfts').insert({
        project_id: projectId,
        image_url: data.path,
        metadata,
      });
      if (dbError) {
        console.error(`Supabase database error for job ${job.id}:`, dbError);
        throw new Error(`Failed to insert NFT: ${dbError.message}`);
      }
      console.log(`NFT inserted in database for job ${job.id}`);
      await job.updateProgress(100);
      return { status: 'success', imageUrl: data.path };
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: 2,
  }
);

worker.on('ready', () => console.log('Worker is ready and listening for jobs'));
worker.on('active', (job) => console.log(`Job ${job.id} is now active`));
worker.on('error', (err) => console.error('Worker Error:', err));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed with error:`, err));
worker.on('completed', (job) => console.log(`Job ${job.id} completed successfully`));
console.log('Worker initialized');