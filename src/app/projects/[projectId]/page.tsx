// app/projects/[projectId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NFT {
  id: string;
  image_url: string;
  metadata: {
    name: string;
    description: string;
    attributes: { trait_type: string; value: string }[];
  };
}

interface Progress {
  total: number;
  completed: number;
  failed: number;
  progress: number;
}

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;

  const [nfts, setNfts] = useState<NFT[] | null>(null); // Initialement null pour gérer le chargement
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const fetchNfts = async () => {
      console.log(`Fetching NFTs for project ${projectId}...`);
      const { data, error } = await supabase
        .from('nfts')
        .select('*')
        .eq('project_id', projectId);

      if (error) {
        console.error('Error loading NFTs:', error);
        if (isMounted) setError('Failed to load NFTs: ' + error.message);
      } else {
        if (isMounted) setNfts(data || []);
        console.log('NFTs loaded:', data?.length || 0);
      }
    };

    const fetchProgress = async () => {
      try {
        console.log('Fetching progress for project:', projectId);
        const response = await fetch(`/api/progress/${projectId}`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) setProgress(data);
          console.log('Progress updated:', data);
          if (data.progress === 100 && data.failed === 0) {
            console.log('100% complete, reloading NFTs...');
            await fetchNfts(); // Recharger les NFTs automatiquement
          }
        } else {
          const errorText = await response.text();
          console.error('Error fetching progress:', errorText);
          if (isMounted) setError(`Failed to fetch progress: ${errorText}`);
        }
      } catch (err) {
        console.error('Fetch progress error:', err);
        if (isMounted)
          setError(
            err instanceof Error
              ? `Failed to fetch progress: ${err.message}`
              : 'An error occurred'
          );
      }
    };

    const initialize = async () => {
      await fetchNfts();
      await fetchProgress();
      if (isMounted) setLoading(false);
    };

    initialize();

    interval = setInterval(async () => {
      await fetchProgress();
    }, 5000);

    return () => {
      isMounted = false;
    if (interval) clearInterval(interval); // Nettoyer l'intervalle au démontage
    };
  }, [projectId]);

  if (loading || nfts === null) {
    return <div className="text-center">Loading... <span className="animate-spin">🔄</span></div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">
       project <code>{projectId}</code>
      </h1>
      {progress && (
        <div className="mb-4 text-center">
          <p className={progress.progress == 100 ? "text-green-600" : "text-orange-400"}          >Generation in progress... {progress.progress}% complete</p>
        </div>
      )}
      {nfts.length === 0 ? (
        <p className="text-center">No NFTs generated yet. Generation in progress...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-8 gap-4">
  {nfts.map((nft) => (
    <div key={nft.id} className="border transition-shadow">
      <div className="aspect-square w-full overflow-hidden">
        <img
          src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nft-images/${nft.image_url}`}
          alt={nft.metadata.name}
          className="w-full h-full object-cover"
          onError={(e) => console.error('Image load error:', e)}
        />
      </div>
    </div>
  ))}
</div>

      )}
    </div>
  );
}