import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  // Lets a second copy run beside `npm run dev` without sharing its build files.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
