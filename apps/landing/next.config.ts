import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withBitaKit } from '@bitakit/next/config';

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_BUILD_DIR ?? '.next',
};

// next-intl reads src/i18n/request.ts; withBitaKit runs discovery for src/plugins.
export default withBitaKit(createNextIntlPlugin()(nextConfig));
