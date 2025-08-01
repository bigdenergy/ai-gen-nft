# 🧠 AI NFT Generator

A SaaS application to generate visually consistent NFT collections from a fixed character (reference image) and a list of customizable traits (accessories, backgrounds, outfits…).

🖼️ Images are generated using AI via Stable Diffusion + ControlNet through the Replicate API.

---

## 🚀 Features

- Generate consistent NFT images based on a base prompt and a reference image
- Supports custom traits (e.g. "red glasses", "neon background")
- Automatically generates ERC-721 compatible metadata
- Projects and NFTs are stored in Supabase
- Responsive UI built with Next.js (App Router) + TailwindCSS
- Optional Clerk authentication support
- Scalable for large collections (10 to 10k NFTs)

---

## 🛠️ Tech Stack

- **Next.js** (App Router)
- **TailwindCSS** (UI)
- **Supabase** (DB, RLS, Auth, Storage)
- **Replicate** (AI - Stable Diffusion + ControlNet)
- **Redis** (job queue)
- **TypeScript**

---

## ⚙️ Installation

```bash
git clone https://github.com/vhrdy/ai-gen-nft
cd ai-nft-generator
npm install
```

### 🔑 Environment variables (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_REPLICATE_API_TOKEN=
REPLICATE_MODEL=
REPLICATE_API_TOKEN=
SUPABASE_SERVICE_ROLE_KEY=

```

> ⚠️ You can find ControlNet-enabled SD models on [https://replicate.com](https://replicate.com)

---

## 🧪 Run the app locally

```bash
npm run dev
```

Visit: http://localhost:3000

---

## 📦 Redis & Workers (Job Queue)

This app uses **Redis** to manage image generation jobs in the background.

### 🧱 Install Redis locally

##### → With Homebrew (macOS):
```bash
brew install redis
brew services start redis
```

##### → With Docker:
```bash
docker run -d --name redis -p 6379:6379 redis
```

### ⚒️ Start the worker

The worker listens for jobs on Redis and calls Replicate to generate images.

Use this command:
```bash
npm run worker
```

To simulate a job push:
```bash
npm run queue
```

Your `package.json` should include:
```json
"scripts": {
  "dev": "next dev",
  "worker": "node --experimental-specifier-resolution=node --loader ts-node/esm src/lib/worker.ts",
  "queue": "node --experimental-specifier-resolution=node --loader ts-node/esm src/lib/test-queue.ts"
}
```

> 🛡️ `SUPABASE_SERVICE_ROLE_KEY` is required for inserting NFTs from the worker.

---

## 🧱 Supabase Schema

### 📁 `projects`

| Column          | Type    | Description                              |
|------------------|---------|------------------------------------------|
| id               | UUID    | Primary key                              |
| user_id          | UUID    | User ID (matches `auth.uid()`)           |
| name             | TEXT    | Project name                             |
| traits           | JSONB   | List of trait values                     |
| reference_image  | TEXT    | URL of the base image                    |
| created_at       | TIMESTAMP | Creation timestamp                     |

### 📁 `nfts`

| Column      | Type    | Description                               |
|-------------|---------|-------------------------------------------|
| id          | UUID    | Primary key                               |
| project_id  | UUID    | Foreign key to projects                   |
| image_url   | TEXT    | URL of generated image                    |
| metadata    | JSONB   | ERC-721 compatible metadata               |
| created_at  | TIMESTAMP | Generation timestamp                    |

---

## 🛡️ RLS Security

- Users can only access their own projects and NFTs
- Uses `auth.uid()` (UUID) for secure filtering

---

## 🧭 Roadmap

- ZIP export for image + metadata bundles
- Support for generating up to 10k NFTs
- LoRA / DreamBooth fine-tuning upload
- Direct Zora / OpenSea / Manifold minting integration
- Stripe billing: usage-based credits or subscriptions

---

## ✨ Demo (optional)

Add a Loom video, screenshots, or a deployed Vercel/Netlify link here.

---

## 👨‍💻 Author

Created by [your name here] — feel free to fork, contribute, or build your own spin-off 😎