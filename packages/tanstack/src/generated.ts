import type { FoundationConfig } from '@bitakit/core';

/** Replaced by foundation in Vite builds; an explicit config also works outside the bundler. */
export const foundationConfig: FoundationConfig = {};
export function createFoundationConfig(): FoundationConfig {
  return foundationConfig;
}
