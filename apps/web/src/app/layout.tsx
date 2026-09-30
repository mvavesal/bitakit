import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { QueryProvider } from '@bitakit/next/query';
import { ThemeProvider } from '@/providers/theme-provider';
import { themeBootstrapScript } from '@/lib/theme/config';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppPreferencesProvider } from '@/providers/settings-provider';
import { OrganizationCreateDialog } from '@/components/organizations/organization-create-dialog';
import { OrganizationProvider } from '@/providers/organization-provider';
import { AppActionsProvider } from '@/providers/actions-provider';
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
          <QueryProvider>
            <ThemeProvider>
              <TooltipProvider>
                <OrganizationProvider>
                  <AppPreferencesProvider>
                    <AppActionsProvider>
                      {children}
                      <OrganizationCreateDialog />
                      <Toaster />
                    </AppActionsProvider>
                  </AppPreferencesProvider>
                </OrganizationProvider>
              </TooltipProvider>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
