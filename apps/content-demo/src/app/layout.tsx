import { getLocale, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { ShellThemeScript } from '@bitakit/shell';
import './styles.css';
export const metadata = { title: 'Content Studio · Foundation-Beispiel' };
export default async function Layout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations();
  const preview =
    process.env.NODE_ENV === 'development' && process.env.CONTENT_DEMO_AUTH === 'memory';
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <ShellThemeScript />
      </head>
      <body>
        <Suspense>
          <NextIntlClientProvider>
            {preview && <p role="status">{t('localPreview')}</p>}
            <Providers preview={preview}>{children}</Providers>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
