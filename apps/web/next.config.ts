import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { withFoundation } from '@bitakit/next/config';
import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const mailEnv=resolve(process.cwd(),'../../.env.mail.local');
if (process.env.NODE_ENV !== 'production' && existsSync(mailEnv)) process.loadEnvFile(mailEnv);

const nextConfig: NextConfig = {
  devIndicators: false,
};

// Connect generic Action, Plugin, view and extension discovery to this development server.
export default withFoundation(createNextIntlPlugin()(nextConfig));
