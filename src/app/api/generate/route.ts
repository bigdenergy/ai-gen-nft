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

// Génère des combinaisons aléatoires de traits (sans doublons)
function generateCombinations(
  traits: { category: string; options: string[] }[],
  numNfts: number
): { id: string; [key: string]: string }[] {
  const combinations: { id: string; [key: string]: string }[] = [];
  while (combinations.length < numNfts) {
    const combo: { id: string; [key: string]: string } = { id: uuidv4() };
    for (const { category, options } of traits) {
      combo[category] = options[Math.floor(Math.random() * options.length)];
    }
    if (!combinations.some(c => JSON.stringify(c) === JSON.stringify(combo))) {
      combinations.push(combo);
    }
  }
  return combinations;
}

// Transforme le JSON `character` en description textuelle
function describeCharacterFromJson(character: any): string {
  const { head, clothing, pose } = character;
  const features = head?.features || {};
  return [
    `square ${head.color} head`,
    features.eyes?.glasses
      ? `wearing ${features.eyes.glasses.color} ${features.eyes.glasses.shape} glasses`
      : '',
    features.nose ? `${features.nose.color} round nose` : '',
    features.mouth?.type === 'small_smile' ? `with a small smile` : '',
    clothing.hat ? `${clothing.hat.color} ${clothing.hat.type} hat` : '',
    clothing.scarf ? `${clothing.scarf.color} ${clothing.scarf.type} scarf` : '',
    clothing.shirt
      ? `a ${clothing.shirt.type} shirt with ${clothing.shirt.pattern} in ${clothing.shirt.colors.join(' and ')}`
      : '',
    clothing.cape
      ? `a ${clothing.cape.pattern} cape in ${clothing.cape.colors.join(', ')}`
      : '',
    clothing.pants ? `${clothing.pants.color} pants` : '',
    clothing.boots ? `${clothing.boots.color} boots` : '',
    pose.stance === 'confident' ? 'standing in a confident pose' : '',
    pose.hands === 'in_pockets' ? 'with hands in pockets' : ''
  ]
    .filter(Boolean)
    .join(', ');
}

export async function POST(request: Request) {
  // 1. Lire formData
  const formData = await request.formData();
  const jsonStr = formData.get('data')?.toString();
  const file = formData.get('referenceImage') as File | null;
  if (!jsonStr) {
    return NextResponse.json({ error: 'Missing data field' }, { status: 400 });
  }

  // 2. Parser JSON
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, description, numNfts, traits, character } = parsed;

  // 3. Validation des champs (character est facultatif)
  if (
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    !Number.isInteger(numNfts) ||
    numNfts < 1 ||
    numNfts > 1000 ||
    !Array.isArray(traits) ||
    traits.some((t: any) => !t.category || !Array.isArray(t.options))
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // 4. Upload de l'image de référence
  let referenceImageUrl: string | undefined;
  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('reference-images')
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

  // 5. Création du projet dans Supabase
  const userId = uuidv4();
  const { data: project, error: supabaseError } = await supabase
    .from('projects')
    .insert({ user_id: userId, name, traits })
    .select('id')
    .single();
  if (supabaseError || !project) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }

  // 6. Description JSON (facultative)
  const characterDesc = character
    ? describeCharacterFromJson(character)
    : '';

  // 7. Générer les combinaisons et planifier les jobs
  const combinations = generateCombinations(traits, numNfts);
  for (const combo of combinations) {
    const traitDesc = Object.entries(combo)
      .filter(([k]) => k !== 'id')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const promptParts = [
      `A charming cartoon-style character illustration featuring ${traitDesc}`,
      characterDesc,
      'character positioned on the left side of the frame',
      'house-shaped head',
      "Zorro blindfold",
      'important: upper body only, no space at the bottom',
      'good upward zoom',
      'character smiling in a relaxed pose on the left side',
-      'hands in pockets',
      'centered composition',
      'dark beige background',
      'important: no legs visible',
      '1:1 square format'
    ];

    const prompt = promptParts.filter(Boolean).join(', ');

    await generationQueue.add('generate-nft', {
      projectId: project.id,
      combo,
      description,
      replicateConfig: {
        model: process.env.REPLICATE_MODEL,
        input: {
          prompt,
          width: 512,
          height: 512,
          ...(referenceImageUrl && {
            init_image: referenceImageUrl,
            strength: 0.9,
          }),
          go_fast: false,
          lora_scale: 1,
          megapixels: "1",
          num_outputs: 1,
          aspect_ratio: "1:1",
          output_format: "webp",
          guidance_scale: 3,
          output_quality: 80,
          prompt_strength: 0.9,
          extra_lora_scale: 1,
        },
      },
    } as GenerationJobData);
  }

  // 8. Réponse
  return NextResponse.json({ projectId: project.id });
}
