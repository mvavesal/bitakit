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
  /** Build-included package names offered for lazy host activation, instead of automatic startup. */
  catalog?: readonly string[];
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
  /** Legacy name hints only; declare owned contracts in src/slots with defineSlot. */
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
  /** Installed stylesheet and emitted script directories watched for CSS contract changes. */
  styleDirectories: string[];
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
export const styleLayers: string;
export const stylePrelude: string;
export function cssImports(
  css: string,
  from: string,
): { value: string; rule: import('postcss').AtRule }[];
export function resolveStylesheet(specifier: string, from: string): string;
export function validatePackageStyles(
  packages: {
    name: string;
    manifestFile: string;
    manifest: { exports?: unknown };
    styles: string[];
    theme: string[];
  }[],
): Promise<string[]>;
export function detectFramework(manifest: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): 'next' | 'tanstack' | 'none';
/** Reads `bitakit.config.ts`; `names` lets migration tooling also read the 0.1 `foundation.config.ts`. */
export function loadDiscoveryConfig(
  root: string,
  jiti?: unknown,
  names?: readonly string[],
): Promise<{ config: DiscoveryConfig; file?: string; legacy: boolean }>;

export type DescribedEntry = { path: string; file: string };
/** Non-executing static hints. Computed/imported records remain explicitly unresolved. */
export function describeDefinitions(
  entries: DescribedEntry[],
  options: { helper: string; moduleId?: string; properties?: string[] },
): Promise<{
  definitions: { id: string; file: string; [property: string]: string }[];
  unresolved: string[];
}>;
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
  /** Owned contracts under slots/, distinct from ui/slots contributions. */
  slotDefinitions: DescribedEntry[];
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
  /** Included in the build, with activation chosen later by host management. */
  catalogPackages: string[];
  /** Names of installed packages with BitaKit metadata. */
  installedPackages: string[];
  styles: string[];
  /** Slot names installed layouts render, plus `slots` from bitakit.config.ts. */
  slots: string[];
  slotDeclarations: {
    id: string;
    plugin: string;
    file: string;
    accepts?: string;
    policy?: string;
  }[];
  unresolvedSlots: string[];
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
/**
 * Rewrites the 0.2 API spellings in one TypeScript/TSX source on its syntax tree: a BitaKit setup's
 * `{ app }` becomes `{ scope: app }`, `defineAction` placements use `slot`, and
 * `slots.attach(name, contribution)` becomes `slots.attach({ slot: name, ... })`. `unresolved`
 * lists lines of old-form calls that need a manual rewrite.
 */
export function rewriteScopeAndSlots(
  source: string,
  options?: { setupFile?: boolean; tsx?: boolean },
): { code: string; unresolved: number[] };
/** Rewrites a 0.1 project layout to the current one. `dryRun` only reports the changes. */
export function migrateProject(
  root: string,
  options?: { dryRun?: boolean; navigationSlot?: string },
): Promise<{ changes: MigrationChange[] }>;

export function navigationPlacement(
  source: string,
  target?: string,
): { code: string; changed: number; missing: { line: number; safe: boolean }[] };
