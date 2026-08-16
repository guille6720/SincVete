import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sincvete/shared', '@sincvete/db'],
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || 'local',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
