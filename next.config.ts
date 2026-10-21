import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 60,
    },
  },
};
export default nextConfig;
