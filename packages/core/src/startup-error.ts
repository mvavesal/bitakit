/**
 * A failure while starting the runtime, attributed to the module that caused it. UI integrations
 * use the attribution to keep the rest of the application running during development.
 */
export class BitaKitStartupError extends Error {
  /** Module ID of the failing plugin or the application module. */
  readonly plugin: string;
  /** True when the application module itself failed; there is nothing to isolate. */
  readonly app: boolean;
  /** Project-relative source file of the failing contribution, when discovery recorded it. */
  readonly source?: string;
  constructor(
    message: string,
    plugin: string,
    options: { cause?: unknown; source?: string; app?: boolean } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'BitaKitStartupError';
    this.plugin = plugin;
    this.app = options.app ?? false;
    this.source = options.source;
  }
}

/** Recognizes startup errors by shape, so errors from another package copy also qualify. */
export function isBitaKitStartupError(error: unknown): error is BitaKitStartupError {
  return (
    error instanceof Error &&
    error.name === 'BitaKitStartupError' &&
    typeof (error as { plugin?: unknown }).plugin === 'string'
  );
}

/** Human-readable owner of a module ID. */
export function moduleLabel(module: string, appId: string) {
  return module === appId ? 'the app' : `plugin "${module}"`;
}
