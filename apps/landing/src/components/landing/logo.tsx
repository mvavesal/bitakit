import Image from 'next/image';
import lightLogo from '../../../public/brand/bitakit-logo.svg';
import darkLogo from '../../../public/brand/bitakit-logo-dark.svg';

/** The BitaKit logo in both color schemes, as the documentation shows it. */
export function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <>
      <Image
        src={lightLogo}
        alt="BitaKit"
        width={300}
        height={130}
        unoptimized
        className={`${className} dark:hidden`}
      />
      <Image
        src={darkLogo}
        alt="BitaKit"
        width={300}
        height={130}
        unoptimized
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
