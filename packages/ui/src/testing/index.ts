import { act, createElement, Fragment, useLayoutEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { BitaKitRuntimeConfig, BitaKitEvent, BitaKitRuntime, Plugin } from '@bitakit/core';
import { BitaKitRuntimeProvider } from '../providers/foundation-provider.js';
import { useBitaKit } from '../providers/foundation-context.js';
import type { BitaKitUI } from '../types/ui.js';

/** An event emitted while the view was mounted; the same shape `mountPlugin` records. */
export type RecordedEvent = Pick<BitaKitEvent, 'type' | 'data'>;

export type RenderWithBitaKitOptions = {
  /** Plugins to mount; with `config`, they are added to it and an entry with an existing ID replaces that plugin. */
  plugins?: readonly Plugin[];
  /** The generated configuration (`createBitaKitConfig()`) or an explicit one. */
  config?: BitaKitRuntimeConfig;
  /** Host services under their contract names, such as `{ auth }`. */
  services?: Readonly<Record<string, unknown>>;
  /** The visual mapping; the standard primitives by default. */
  ui?: BitaKitUI;
};

export type RenderedBitaKit = {
  /** The mounted runtime; the latest one when a re-render rebuilt it. */
  readonly runtime: BitaKitRuntime;
  container: HTMLElement;
  /** Every event emitted while mounted, startup included. */
  events: { recorded: RecordedEvent[] };
  /** Renders another element inside the same provider and runtime, wrapped in `act`. */
  rerender(element: ReactNode): Promise<void>;
  /** Unmounts the view and stops the runtime; safe to call twice. */
  unmount(): Promise<void>;
};

/** Reads the runtime from context, so the helper can hand it to the test. */
function Capture({ onRuntime }: { onRuntime(runtime: BitaKitRuntime): () => void }) {
  const { runtime } = useBitaKit();
  useLayoutEffect(() => onRuntime(runtime), [runtime]);
  return null;
}

/**
 * Mounts `element` inside `BitaKitRuntimeProvider` in the current DOM and resolves once every plugin
 * has started. The caller provides the DOM globals (for example jsdom's `window` and
 * `document`); nothing here imports a DOM implementation. A failing start rejects with the
 * attributed startup error and leaves nothing mounted.
 */
export async function renderWithBitaKit(
  element: ReactNode,
  options: RenderWithBitaKitOptions = {},
): Promise<RenderedBitaKit> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { plugins, config, services, ui } = options;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const recorded: RecordedEvent[] = [];
  let current: BitaKitRuntime | undefined;
  // The layout effect runs before the provider starts the runtime, so startup events are recorded too.
  const observe = (runtime: BitaKitRuntime) => {
    current = runtime;
    return runtime.events.observe((event) => recorded.push({ type: event.type, data: event.data }));
  };
  const tree = (content: ReactNode) =>
    createElement(BitaKitRuntimeProvider, {
      config,
      additionalPlugins: plugins,
      services,
      ui,
      // Tests want the startup error itself, not the development report dialog.
      isolateFailures: false,
      children: createElement(
        Fragment,
        null,
        createElement(Capture, { onRuntime: observe }),
        content,
      ),
    });
  let completion: Promise<void> | undefined;
  const unmount = () =>
    (completion ??= (async () => {
      try {
        await act(async () => {
          root.unmount();
          await current?.stopped;
        });
      } finally {
        container.remove();
      }
    })());
  try {
    await act(async () => root.render(tree(element)));
    if (!current)
      throw new Error('The foundation did not mount. Check the plugins and the configuration.');
    const { ready } = current;
    await act(async () => {
      await ready;
    });
  } catch (error) {
    await unmount().catch(() => {});
    throw error;
  }
  return {
    get runtime() {
      return current as BitaKitRuntime;
    },
    container,
    events: { recorded },
    rerender: async (next) => {
      await act(async () => root.render(tree(next)));
    },
    unmount,
  };
}
