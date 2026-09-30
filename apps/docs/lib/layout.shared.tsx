import Image from 'next/image';
import lightLogo from '../public/brand/bitakit-logo.png';
import darkLogo from '../public/brand/bitakit-logo-dark.png';
import { appName } from './shared';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Image
            src={lightLogo}
            alt={appName}
            width={300}
            height={130}
            unoptimized
            className="h-11 w-auto dark:hidden"
          />
          <Image
            src={darkLogo}
            alt={appName}
            width={300}
            height={130}
            unoptimized
            className="hidden h-11 w-auto dark:block"
          />
        </>
      ),
    },
  };
}
