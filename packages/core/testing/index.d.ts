import type { ActionList, FoundationApp, FoundationRuntime, Plugin, Services } from '@bitakit/core';

export type MountedPlugin = {
  id: string;
  runtime: FoundationRuntime;
  app: FoundationApp;
  actions: ActionList;
  /** Services as the plugin's contributions see them: `services.notes`. */
  services: Services;
  /** Executes `<plugin>.<name>` (or a full action ID) and returns the execution outcome. */
  execute(name: string, input?: unknown): ReturnType<ActionList['execute']>;
  stop(): void;
  [Symbol.dispose](): void;
};

/**
 * Mounts one plugin folder headlessly for tests, discovered with the same conventions as apps,
 * including `setup.ts`. React pages and views are skipped. A failing start rejects with the
 * attributed startup error after releasing everything it created.
 */
export function mountPlugin(
  directory?: string,
  options?: {
    id?: string;
    /** Further plugins the tested plugin depends on. */
    plugins?: readonly Plugin[];
    /** Host-provided services, such as a fake authentication service. */
    services?: Partial<Services>;
    configOverrides?: Readonly<Record<string, Record<string, unknown>>>;
  },
): Promise<MountedPlugin>;
