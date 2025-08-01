// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true, // Partial Prerendering
    reactCompiler: true, // React Compiler
  },
  poweredByHeader: false,
};

export default nextConfig;