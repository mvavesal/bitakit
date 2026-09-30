import type { FoundationConfig } from '@bitakit/core';

/** Replaced by withFoundation in Next builds; an explicit config also works outside the bundler. */
export const foundationConfig: FoundationConfig = {};
export function createFoundationConfig(): FoundationConfig {
  return foundationConfig;
}
