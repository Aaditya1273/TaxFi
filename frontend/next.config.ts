import type { NextConfig } from 'next';

const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const isVercel = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Standalone output for Docker — Vercel handles this natively
  ...(isVercel ? {} : { output: 'standalone' }),

  // API proxy — sends /api/* requests to the FastAPI backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/:path*`,
      },
    ];
  },

  // Webpack: resolve missing React Native module that @metamask/sdk incorrectly imports
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};

export default nextConfig;
