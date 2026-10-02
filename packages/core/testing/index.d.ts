import type {
  ActionList,
  EventService,
  FoundationApp,
  FoundationEvent,
  FoundationRuntime,
  Plugin,
  Services,
} from '@bitakit/core';

export type MountedPlugin = {
  id: string;
  runtime: FoundationRuntime;
  app: FoundationApp;
  actions: ActionList;
  /** Services as the plugin's contributions see them: `services.notes.items`. */
  services: Services;
  /** The runtime bus plus every event emitted while mounted. */
  events: EventService & { recorded: Pick<FoundationEvent, 'type' | 'data'>[] };
  /** Executes `<plugin>.<name>` (or a full action ID) and returns the execution outcome. */
  execute(name: string, input?: unknown): ReturnType<ActionList['execute']>;
  stop(): void;
  [Symbol.dispose](): void;
};

/**
 * Mounts one plugin folder headlessly for tests, discovered with the same conventions as apps,
 * including `events.ts` and `setup.ts`. Files under `ui/` are skipped. Resolves after every
 * `onStart`; a failing start rejects with the attributed startup error.
 */
export function mountPlugin(
  directory?: string,
  options?: {
    id?: string;
    /** Further plugins the tested plugin depends on. */
    plugins?: readonly Plugin[];
    /** Host-provided services, such as a fake authentication service. */
    services?: Readonly<Record<string, unknown>>;
    configOverrides?: Readonly<Record<string, Record<string, unknown>>>;
  },
): Promise<MountedPlugin>;
