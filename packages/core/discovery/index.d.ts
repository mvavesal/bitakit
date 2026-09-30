/** An integration-defined contribution kind: folder inside each module root plus its normalizer. */
export type ContributionKindSpec = {
  /** Kind name used in `contributions`, e.g. "settings.renderers". */
  name: string;
  /** Folder that identifies the kind inside every module root, e.g. "renderers". */
  directory: string;
  /** Module exporting the runtime normalizer; imported by the generated client file. */
  from: string;
  /** Normalizer export: (files, moduleId) => values. It validates and names source files in errors. */
  normalize: string;
  /** Optional package-owned type map populated from discovered files and module IDs. */
  types?: { entry: string; map: string };
};
export type DiscoveryConfig = {
  /** Installed opt-in packages are included by default; false disables all, or select by package name. */
  packages?: false | Readonly<Record<string, boolean>>;
  directory?: string;
  /** Contribution kinds provided by optional integrations. Discovery emits imports only. */
  kinds?: readonly ContributionKindSpec[];
  services?: false | { directory?: string };
  configs?: false | { directory?: string };
  configOverrides?: Record<string, Record<string, unknown>>;
  actions?:
    | false
    | { directory?: string; overrides?: Record<string, { enabled?: boolean; visible?: boolean }> };
  providers?: { directory?: string; enabled?: readonly string[] };
  interceptors?: { directory?: string; enabled?: readonly string[] };
  groups?: readonly string[];
  conventions?: boolean;
  plugins?: {
    directory: string;
    autoEnable?: boolean;
    overrides?: Record<string, { enabled: boolean }>;
  };
};
export function defineFoundation(config: DiscoveryConfig): DiscoveryConfig;
export function generateFoundation(root: string): Promise<void>;
export function watchFoundation(root: string, onError?: (error: unknown) => void): () => void;

/** Generates contributions and the host compiler reference without framework imports. */
export function generateFoundationHost(root: string): Promise<void>;
