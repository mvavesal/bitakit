import Image from 'next/image';
import lightLogo from '../public/brand/bitakit-logo.svg';
import darkLogo from '../public/brand/bitakit-logo-dark.svg';
import { appName } from './shared';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: 'https://github.com/mvavesal/bitakit',
    links: [
      {
        text: 'Website',
        url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3104',
        external: true,
      },
      {
        text: 'Live demo',
        url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3104'}/dashboard`,
        external: true,
      },
    ],
    themeSwitch: { mode: 'light-dark' },
    nav: {
      title: (
        <>
          <Image
            src={lightLogo}
            alt={appName}
            width={300}
            height={130}
            unoptimized
            className="h-9 w-auto md:-translate-y-1 dark:hidden"
          />
          <Image
            src={darkLogo}
            alt={appName}
            width={300}
            height={130}
            unoptimized
            className="hidden h-9 w-auto md:-translate-y-1 dark:block"
          />
        </>
      ),
    },
  };
}
