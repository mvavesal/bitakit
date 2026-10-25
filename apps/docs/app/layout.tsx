import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';

export const metadata: Metadata = {
  title: { default: 'BitaKit', template: '%s | BitaKit' },
  description: 'Build small host applications with independent BitaKit packages.',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="site-theme" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          theme={{ defaultTheme: 'dark', storageKey: 'bitakit-site-theme' }}
          search={{
            options: {
              type: 'static',
              api: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/search.json`,
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
