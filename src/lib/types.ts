// src/lib/types.ts
export interface Trait {
  category: string;
  options: string[];
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  traits: Trait[];
  reference_image?: string;
  created_at: string;
}

export interface NFT {
  id: string;
  project_id: string;
  image_url: string;
  metadata: {
    name: string;
    description: string;
    attributes: { trait_type: string; value: string }[];
  };
  created_at: string;
}

// src/lib/types.ts
export interface GenerationJobData {
  projectId: string;
  combo: { id: string; [key: string]: string };
  description: string; // Ajout de la propriété description
  replicateConfig: {
    model: string;
    input: {
      prompt: string;
      [key: string]: any;
    };
  };
}