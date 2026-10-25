import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ShellThemeScript } from '@bitakit/shell';
import { Providers } from '@/components/playground/providers';
import './playground.css';

export const metadata = { title: 'BitaKit playground', robots: { index: false } };

/** The live BitaKit app the landing page frames. It has its own root layout and runtime. */
export default async function PlaygroundLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ShellThemeScript />
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
