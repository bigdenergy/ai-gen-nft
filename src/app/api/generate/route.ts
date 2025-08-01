import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generationQueue } from '@/lib/queue';
import { v4 as uuidv4 } from 'uuid';
import type { GenerationJobData } from '@/lib/types';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Génère les combinaisons de traits (limitées à numNfts)
function generateCombinations(traits: { category: string; options: string[] }[], numNfts: number): { id: string; [key: string]: string }[] {
  const combinations: { id: string; [key: string]: string }[] = [];

  while (combinations.length < numNfts) {
    const combo: { id: string; [key: string]: string } = { id: uuidv4() };
    for (const { category, options } of traits) {
      const randomOption = options[Math.floor(Math.random() * options.length)];
      combo[category] = randomOption;
    }

    // Optionnel : éviter les doublons
    if (!combinations.some(c => JSON.stringify(c) === JSON.stringify(combo))) {
      combinations.push(combo);
    }
  }

  return combinations;
}


export async function POST(request: Request) {
  const formData = await request.formData();
  const json = formData.get('data')?.toString();
  const file = formData.get('referenceImage') as File | null;

  if (!json) {
    return NextResponse.json({ error: 'Missing data field' }, { status: 400 });
  }

  const { name, description, numNfts, traits } = JSON.parse(json);

  if (
    !name || !description ||
    !Number.isInteger(numNfts) || numNfts < 1 || numNfts > 1000 ||
    !Array.isArray(traits) || traits.some(t => !t.category || !Array.isArray(t.options))
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Upload image to Supabase Storage if exists
  let referenceImageUrl: string | undefined;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('reference-images') // Assure-toi que ce bucket existe
      .upload(fileName, buffer, {
        contentType: file.type || 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Image upload failed:', uploadError.message);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data } = supabaseAdmin
      .storage
      .from('reference-images')
      .getPublicUrl(fileName);

    referenceImageUrl = data.publicUrl;
  }

  // Création du projet
  const userId = uuidv4();
  const { data: project, error: supabaseError } = await supabase
    .from('projects')
    .insert({ user_id: userId, name, traits })
    .select('id')
    .single();

  if (supabaseError || !project) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }

  const combinations = generateCombinations(traits, numNfts);

  for (const combo of combinations) {
    await generationQueue.add('generate-nft', {
      projectId: project.id,
      combo,
      description,
      replicateConfig: {
        model: process.env.REPLICATE_MODEL,
        input: {
          prompt: `A charming cartoon-style character illustration featuring ${Object.entries(combo)
            .filter(([key]) => key !== 'id')
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}, house-shaped head, important: upper body only, no space at the bottom, goodupward zoom, character smiling in a relaxed pose, hands partially visible or in pockets, centered composition, important: no legs visible, 1:1 square format`,          
          width: 512,height: 512,
          ...(referenceImageUrl && {
            init_image: referenceImageUrl,
            strength: 0.1,
          }),
          go_fast: false,
          lora_scale: 1,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          guidance_scale: 3,
          output_quality: 80,
          prompt_strength: 0.8,
          extra_lora_scale: 1,
        },
      },
    } as GenerationJobData);
  }

  return NextResponse.json({ projectId: project.id });
}
