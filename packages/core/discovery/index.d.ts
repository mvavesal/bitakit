/** An integration-defined contribution kind: folder inside `contributions/` of each module plus its normalizer. */
export type ContributionKindSpec = {
  /** Kind name used in `contributions`, e.g. "settings.renderers". */
  name: string;
  /** Folder under `contributions/` that identifies the kind, e.g. "renderers". */
  directory: string;
  /** Module exporting the runtime normalizer; imported by the generated file. */
  from: string;
  /** Normalizer export: (files, moduleId) => values. */
  normalize: string;
  /** Optional package-owned type map populated from discovered files and module IDs. */
  types?: { entry: string; map: string };
};
export type DiscoveryConfig = {
  /** Installed opt-in packages are included by default; false disables all, or select by package name. */
  packages?: false | Readonly<Record<string, boolean>>;
  /** The application module root; `./src` by default. Generated files are written here. */
  directory?: string;
  /** Contribution kinds provided by optional integrations. */
  kinds?: readonly ContributionKindSpec[];
  services?: false | { directory?: string };
  configs?: false | { directory?: string };
  configOverrides?: Record<string, Record<string, unknown>>;
  actions?:
    | false
    | { directory?: string; overrides?: Record<string, { enabled?: boolean; visible?: boolean }> };
  /** App providers under `ui/providers` are included; a legacy `providers/` folder needs `enabled`. */
  providers?: { directory?: string; enabled?: readonly string[] };
  interceptors?: { directory?: string; enabled?: readonly string[] };
  groups?: readonly string[];
  /** Slot names the app's layouts render, in addition to those installed shells declare. */
  slots?: readonly string[];
  /** Reject unknown action IDs at compile time (default true). */
  strict?: boolean;
  /** Which provider the generated file wires; detected from package.json by default. */
  framework?: 'next' | 'tanstack' | 'none';
  plugins?: {
    directory?: string;
    /** Plugins outside the plugin directory, by ID: `{ notes: '../src' }`. */
    include?: Record<string, string>;
    autoEnable?: boolean;
    overrides?: Record<string, { enabled: boolean }>;
  };
};
export function defineBitaKit(config: DiscoveryConfig): DiscoveryConfig;
/** @deprecated Use defineBitaKit in bitakit.config.ts. */
export function defineFoundation(config: DiscoveryConfig): DiscoveryConfig;

export type GenerateResult = {
  /** Directories of plugins included from outside the project. */
  included: string[];
  warnings: string[];
  /** The generated TypeScript file. */
  generated: string;
  framework: 'next' | 'tanstack' | 'none';
};
export function generateFoundation(
  root: string,
  options?: { quiet?: boolean },
): Promise<GenerateResult>;
export const generateBitaKit: typeof generateFoundation;
/** @deprecated Use generateFoundation. */
export const generateFoundationHost: typeof generateFoundation;
export function watchFoundation(root: string, onError?: (error: unknown) => void): () => void;
export const watchBitaKit: typeof watchFoundation;
export function detectFramework(manifest: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): 'next' | 'tanstack' | 'none';
export function loadDiscoveryConfig(
  root: string,
): Promise<{ config: DiscoveryConfig; file?: string; legacy: boolean }>;

export type DescribedEntry = { path: string; file: string };
export type DescribedModule = {
  id: string;
  directory: string;
  actions: DescribedEntry[];
  services: DescribedEntry[];
  events: DescribedEntry[];
  /** The module's `settings.ts`, when present. */
  settings: DescribedEntry[];
  /** `ui/settings/page.tsx`, when present. */
  settingsPage?: string;
  /** App module only: `src/layouts/<name>.tsx`. */
  layouts?: { name: string; file: string }[];
  pages: DescribedEntry[];
  slots: DescribedEntry[];
  providers: DescribedEntry[];
  configs: DescribedEntry[];
  interceptors: DescribedEntry[];
};
export type FoundationDescription = {
  root: string;
  framework: 'next' | 'tanstack' | 'none';
  pluginsDirectory: string;
  appDirectory: string;
  app: DescribedModule;
  plugins: (DescribedModule & { dependencies: readonly string[]; enabled: boolean })[];
  /** Plugin entry specifiers of installed opt-in packages. */
  packages: string[];
  /** Names of installed packages with BitaKit metadata. */
  installedPackages: string[];
  styles: string[];
  /** Slot names installed layouts render, plus `slots` from bitakit.config.ts. */
  slots: string[];
  warnings: string[];
};
export function describeFoundation(root: string): Promise<FoundationDescription>;
export function describeModule(
  directory: string,
): Promise<Omit<DescribedModule, 'id'> & { setup?: string; locales: string[]; warnings: string[] }>;

export type MigrationChange = {
  kind: 'rename' | 'move' | 'rewrite' | 'delete' | 'skip';
  from: string;
  to?: string;
  detail?: string;
};
/** Rewrites a 0.1 project layout to the current one. `dryRun` only reports the changes. */
export function migrateProject(
  root: string,
  options?: { dryRun?: boolean },
): Promise<{ changes: MigrationChange[] }>;
