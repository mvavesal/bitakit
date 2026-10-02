import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { themeBootstrapScript } from '@/lib/theme/config';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppPreferencesProvider } from '@/components/providers/settings-provider';
import { OrganizationCreateDialog } from '@/components/organizations/organization-create-dialog';
import { OrganizationProvider } from '@/components/providers/organization-provider';
import { BitaKit } from '@/components/providers/bitakit';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'SaaS Foundation',
  description: 'A reusable Next.js foundation with shared application actions.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <ThemeProvider>
            <TooltipProvider>
              <OrganizationProvider>
                <AppPreferencesProvider>
                  <BitaKit>
                    {children}
                    <OrganizationCreateDialog />
                    <Toaster />
                  </BitaKit>
                </AppPreferencesProvider>
              </OrganizationProvider>
            </TooltipProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
