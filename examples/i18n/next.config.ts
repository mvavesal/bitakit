import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withBitaKit } from '@bitakit/next/config';

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

// next-intl finds its request configuration in src/i18n/request.ts.
export default withBitaKit(createNextIntlPlugin()(nextConfig));
