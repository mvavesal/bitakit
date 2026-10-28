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
      // `?raw` imports return a file's text: the playground's code drawer shows its own files.
      '*.ts': { condition: { query: '?raw' }, type: 'text' },
      '*.tsx': { condition: { query: '?raw' }, type: 'text' },
    },
  },
};

export default withBitaKit(nextConfig);
