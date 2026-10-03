import type { ReactNode } from 'react';
import { ShellThemeScript } from '@bitakit/shell';
import { Providers } from '@/components/providers';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ShellThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
