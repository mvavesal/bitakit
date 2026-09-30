import type { ContributionKindSpec } from '@bitakit/core/discovery';
export type SettingsDiscoveryOptions = {
  /** Folder names inside each module root. Override them to avoid existing folders. */
  directories?: { settings?: string; sections?: string; renderers?: string };
};
export function settingsDiscovery(options?: SettingsDiscoveryOptions): ContributionKindSpec[];
export default settingsDiscovery;
