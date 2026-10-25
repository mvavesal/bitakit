import type { ReactNode } from 'react';
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google';
import { SiteProviders } from '@/components/landing/site-providers';
import { brandIcons } from '../../../../brand-icons';
import './site.css';

const body = Geist({ subsets: ['latin'], variable: '--site-font-body' });
const display = Space_Grotesk({ subsets: ['latin'], variable: '--site-font-display' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--site-font-mono' });

export const metadata = {
  applicationName: 'BitaKit',
  icons: brandIcons,
  title: 'BitaKit — build ambitious apps. Limitless by design.',
  description:
    'A composition layer for Next.js: every feature is a plugin in its own folder, with Actions, settings, themes, layouts and search built in.',
};

/** The landing page. It runs no BitaKit runtime; the live app is the framed playground. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`site-theme ${body.variable} ${display.variable} ${mono.variable}`}
    >
      <body className="bg-background text-foreground antialiased">
        <SiteProviders>{children}</SiteProviders>
      </body>
    </html>
  );
}
