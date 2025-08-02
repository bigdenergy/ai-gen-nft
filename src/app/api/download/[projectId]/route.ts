import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import JSZip from 'jszip';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(_: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  try {
    // Récupérer les NFTs du projet depuis Supabase
    const { data: nfts, error: fetchError } = await supabase
      .from('nfts')
      .select('id, image_url, metadata')
      .eq('project_id', projectId);

    if (fetchError) {
      console.error('Error fetching NFTs:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch NFTs' }, { status: 500 });
    }

    if (!nfts || nfts.length === 0) {
      return NextResponse.json({ error: 'No NFTs found for this project' }, { status: 404 });
    }

    // Créer un ZIP
    const zip = new JSZip();

    // Télécharger chaque image et l'ajouter au ZIP
    for (const nft of nfts) {
      const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nft-images/${nft.image_url}`;
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch image for NFT ${nft.id}: ${response.statusText}`);
          continue;
        }
        const buffer = await response.arrayBuffer();
        const fileName = `${nft.metadata.name || nft.id}.webp`;
        zip.file(fileName, buffer);
      } catch (err) {
        console.warn(`Error downloading image for NFT ${nft.id}:`, err);
        continue;
      }
    }

    // Vérifier si le ZIP contient des fichiers
    const fileCount = Object.keys(zip.files).length;
    if (fileCount === 0) {
      return NextResponse.json({ error: 'No valid images could be included in the ZIP' }, { status: 500 });
    }

    // Générer le ZIP
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Retourner le fichier ZIP
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="project_${projectId}_nfts.zip"`,
      },
    });
  } catch (error) {
    console.error('Error generating ZIP:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}