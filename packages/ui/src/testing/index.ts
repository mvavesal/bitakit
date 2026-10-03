import { act, createElement, Fragment, useLayoutEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { FoundationConfig, FoundationEvent, FoundationRuntime, Plugin } from '@bitakit/core';
import { FoundationProvider } from '../providers/foundation-provider.js';
import { useFoundation } from '../providers/foundation-context.js';
import type { FoundationUI } from '../types/ui.js';

/** An event emitted while the view was mounted; the same shape `mountPlugin` records. */
export type RecordedEvent = Pick<FoundationEvent, 'type' | 'data'>;

export type RenderWithFoundationOptions = {
  /** Plugins to mount; with `config`, they are added to it and an entry with an existing ID replaces that plugin. */
  plugins?: readonly Plugin[];
  /** The generated configuration (`createBitaKitConfig()`) or an explicit one. */
  config?: FoundationConfig;
  /** Host services under their contract names, such as `{ auth }`. */
  services?: Readonly<Record<string, unknown>>;
  /** The visual mapping; the standard primitives by default. */
  ui?: FoundationUI;
};

export type RenderedFoundation = {
  /** The mounted runtime; the latest one when a re-render rebuilt it. */
  readonly runtime: FoundationRuntime;
  container: HTMLElement;
  /** Every event emitted while mounted, startup included. */
  events: { recorded: RecordedEvent[] };
  /** Renders another element inside the same provider and runtime, wrapped in `act`. */
  rerender(element: ReactNode): Promise<void>;
  /** Unmounts the view and stops the runtime; safe to call twice. */
  unmount(): Promise<void>;
};

/** Reads the runtime from context, so the helper can hand it to the test. */
function Capture({ onRuntime }: { onRuntime(runtime: FoundationRuntime): () => void }) {
  const { runtime } = useFoundation();
  useLayoutEffect(() => onRuntime(runtime), [runtime]);
  return null;
}

/**
 * Mounts `element` inside `FoundationProvider` in the current DOM and resolves once every plugin
 * has started. The caller provides the DOM globals (for example jsdom's `window` and
 * `document`); nothing here imports a DOM implementation. A failing start rejects with the
 * attributed startup error and leaves nothing mounted.
 */
export async function renderWithFoundation(
  element: ReactNode,
  options: RenderWithFoundationOptions = {},
): Promise<RenderedFoundation> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { plugins, config, services, ui } = options;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const recorded: RecordedEvent[] = [];
  let current: FoundationRuntime | undefined;
  // The layout effect runs before the provider starts the runtime, so startup events are recorded too.
  const observe = (runtime: FoundationRuntime) => {
    current = runtime;
    return runtime.events.observe((event) => recorded.push({ type: event.type, data: event.data }));
  };
  const tree = (content: ReactNode) =>
    createElement(FoundationProvider, {
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
  let mounted = true;
  const unmount = async () => {
    if (!mounted) return;
    mounted = false;
    await act(async () => root.unmount());
    container.remove();
  };
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
      return current as FoundationRuntime;
    },
    container,
    events: { recorded },
    rerender: async (next) => {
      await act(async () => root.render(tree(next)));
    },
    unmount,
  };
}
