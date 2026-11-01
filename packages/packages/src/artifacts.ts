import type { Plugin } from '@bitakit/core';
import type { PackageSelection } from './index.js';

/** Immutable, independently served package. Paths are relative to its artifact directory. */
export type PackageArtifact = Readonly<{
  id: string;
  name: string;
  version: string;
  source: string;
  pluginIds: readonly string[];
  entry: string;
  styles: readonly string[];
  files: Readonly<Record<string, string>>;
  imports: readonly string[];
  peers: Readonly<Record<string, string>>;
}>;
export type PreparedPackage = Readonly<{
  artifact: PackageArtifact;
  /** Import only; owned work starts through Core. The returned resource handle owns CSS. */
  load(signal: AbortSignal): Promise<{
    plugins: readonly Plugin[];
    /** Synchronous, idempotent presentation toggles, applied after Core readiness. */
    activate?(): void;
    deactivate?(): void;
    /** Idempotent release after Core cleanup; failures require external resource recovery. */
    dispose?(): void;
  }>;
}>;
/** Resolution may fetch metadata, but must not evaluate candidate code. */
export type PackageProvider = {
  resolve(selection: PackageSelection, signal: AbortSignal): Promise<PreparedPackage>;
};
export type PackageSnapshot = Readonly<{
  scope: string | null;
  packages: readonly PackageSelection[];
}>;
/** Installation intent only. Core remains the authority for live readiness. */
export type PackageRecord = Readonly<{
  active: PackageSnapshot;
  previous?: PackageSnapshot;
  pending?: Readonly<{ before: PackageSnapshot; after: PackageSnapshot }>;
  failure?: string;
}>;
export type PackageJournal = {
  read(): Promise<{ revision: number; record: PackageRecord | null }>;
  /** Durable compare-and-swap. Reject concurrent writers; never silently overwrite them. */
  write(expectedRevision: number, record: PackageRecord): Promise<number>;
};
