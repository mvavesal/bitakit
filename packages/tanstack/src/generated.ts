import type { FoundationConfig } from '@bitakit/core';

/** @deprecated The configuration is generated into `src/bitakit.gen.tsx`; import it from there. */
export const foundationConfig: FoundationConfig = {};
/** @deprecated Import `createBitaKitConfig` from `src/bitakit.gen`. */
export function createFoundationConfig(): FoundationConfig {
  throw new Error(
    '@bitakit/tanstack/generated is no longer written by discovery. Import { BitaKitProvider, createBitaKitConfig } from \'./bitakit.gen\' (run "bitakit migrate").',
  );
}
