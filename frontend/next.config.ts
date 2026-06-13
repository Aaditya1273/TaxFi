import type { NextConfig } from 'next';

const apiTarget = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Production-optimised standalone output for Docker
  output: 'standalone',

  // API proxy — replaces Vite's vite.config.ts proxy
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
