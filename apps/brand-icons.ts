import type { Metadata } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Shared browser and home-screen branding; public asset URLs include the host's base path. */
export const brandIcons: Metadata['icons'] = {
  icon: [
    { url: `${basePath}/brand/bitakit-app-icon.png`, sizes: '192x192', type: 'image/png' },
    {
      url: `${basePath}/brand/bitakit-app-logo-for-light.svg`,
      type: 'image/svg+xml',
      sizes: 'any',
      media: '(prefers-color-scheme: light)',
    },
    {
      url: `${basePath}/brand/bitakit-app-logo-for-dark.svg`,
      type: 'image/svg+xml',
      sizes: 'any',
      media: '(prefers-color-scheme: dark)',
    },
  ],
  apple: [{ url: `${basePath}/brand/bitakit-apple-icon.png`, sizes: '180x180', type: 'image/png' }],
};
