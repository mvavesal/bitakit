import type { NextConfig } from 'next';
import { withBitaKit } from '@bitakit/next/config';

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default withBitaKit(nextConfig);
