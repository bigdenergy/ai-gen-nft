// src/lib/test-queue.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { generationQueue } from './queue.js';
import { v4 as uuidv4 } from 'uuid';

async function test() {
  if (!process.env.REPLICATE_MODEL) {
    console.error('REPLICATE_MODEL is not set in .env.local');
    throw new Error('REPLICATE_MODEL is not configured');
  }

  const projectId = uuidv4();
  const combo = { id: uuidv4(), Accessoire: 'Lunettes' };
  const description = 'Test NFT collection';
  console.log('Adding test job to queue...');
  const job = await generationQueue.add('generate-nft', {
    projectId,
    combo,
    description,
    replicateConfig: {
      model: process.env.REPLICATE_MODEL, // Utiliser la variable d'environnement
      input: {
        prompt: 'A unique NFT with Accessoire: Lunettes, high quality, digital art',
        width: 512,
        height: 512,
      },
    },
  });
  console.log('Test job added with ID:', job.id);
}

test().catch((err) => console.error('Test job error:', err));