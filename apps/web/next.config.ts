import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sincvete/shared', '@sincvete/db'],
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
