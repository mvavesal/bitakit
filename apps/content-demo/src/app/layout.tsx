import { getLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { Suspense } from 'react';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './styles.css';
export const metadata = { title: 'Content Studio · Foundation-Beispiel' };
export default async function Layout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <Suspense>
          <NextIntlClientProvider>
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
        </Suspense>
      </body>
    </html>
  );
}
