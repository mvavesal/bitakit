import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ShellThemeScript } from '@bitakit/shell';
import { BitaKitProvider } from '@/bitakit.gen';
import './globals.css';

// NextIntlClientProvider takes the locale and messages from src/i18n/request.ts. It sits
// outside BitaKitProvider, so @bitakit/next-intl can hand the same messages to Actions,
// settings and notifications.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ShellThemeScript />
      </head>
      <body>
        <NextIntlClientProvider>
          <BitaKitProvider>{children}</BitaKitProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
