'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';

/** Marketing-only preferences; the framed app owns its separate Shell settings. */
export function SiteProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="bitakit-site-theme"
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </ThemeProvider>
  );
}
