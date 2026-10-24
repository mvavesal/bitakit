import type { ReactNode } from 'react';
import { ShellThemeScript } from '@bitakit/shell';
import { BitaKitProvider } from '@/bitakit.gen';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ShellThemeScript />
      </head>
      <body>
        <BitaKitProvider>{children}</BitaKitProvider>
      </body>
    </html>
  );
}
