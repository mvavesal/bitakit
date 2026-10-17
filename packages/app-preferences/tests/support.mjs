// Shared helpers for the settings UI tests: act-wrapped mounting, a nuqs testing adapter, a
// controllable storage and user-like input helpers. Import it before any component module.
import { setMobile } from './dom.mjs';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { BitaKitRuntimeProvider } from '@bitakit/ui';

export { setMobile };
export const tick = () => new Promise((resolve) => setTimeout(resolve));
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};

/** Renders into a fresh container; `render` re-renders and `unmount` removes it, both inside act. */
export async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  await act(tick);
  return {
    container,
    render: async (next) => {
      await act(async () => root.render(next));
      await act(tick);
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

const box = ({ children }) => h('div', null, children);
/** Host dialog primitives as plain elements; settings pages never open dialogs. */
export const testUI = {
  Dialog: ({ children }) => h('section', { role: 'dialog' }, children),
  DialogContent: ({ children }) => h('div', null, children),
  DialogHeader: box,
  DialogTitle: ({ children }) => h('h2', null, children),
  DialogDescription: ({ children }) => h('p', null, children),
  DialogFooter: box,
  Button: ({ children, variant, autoFocus, ...props }) => h('button', props, children),
};

/**
 * Renders `element` inside BitaKitRuntimeProvider and a nuqs testing adapter. `search` seeds the
 * query string; `urls` records every URL update the components make.
 */
export async function renderApp(
  element,
  { config, storage, pathname, search = '', translate, services = {} } = {},
) {
  const urls = [];
  const view = await mount(
    h(
      NuqsTestingAdapter,
      {
        searchParams: search,
        hasMemory: true,
        onUrlUpdate: (event) => urls.push(event.queryString),
      },
      h(
        BitaKitRuntimeProvider,
        {
          config,
          ui: testUI,
          translate,
          services: storage ? { 'settings.storage': storage, ...services } : services,
          actionOptions: { pathname },
        },
        element,
      ),
    ),
  );
  return { ...view, urls };
}

/**
 * Memory storage whose writes can be held or failed: `hold()` keeps the next writes pending
 * until `release()`, `fail(message)` rejects them.
 */
export function controlledStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  let gate;
  let failure;
  const writes = [];
  const settle = async () => {
    if (gate) await gate.promise;
    if (failure) throw new Error(failure);
  };
  return {
    data,
    writes,
    hold() {
      gate = deferred();
    },
    release() {
      const current = gate;
      gate = undefined;
      current?.resolve();
    },
    fail(message) {
      failure = message;
    },
    succeed() {
      failure = undefined;
    },
    load: (key) => ({ value: data.get(key), writable: true }),
    async save(key, value) {
      writes.push(['save', key, value]);
      await settle();
      data.set(key, value);
    },
    async reset(key) {
      writes.push(['reset', key]);
      await settle();
      data.delete(key);
      return { value: undefined, writable: true };
    },
  };
}

/** Sets an input's value the way a user edit does, so React sees the change. */
export async function type(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set;
  await act(async () => {
    element.focus();
    setter.call(element, value);
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}
export const click = (element) => act(async () => element.click());
export const press = (element, key, init = {}) =>
  act(async () => {
    element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
export const blur = (element) => act(async () => element.blur());
export const text = (element) => element.textContent.replace(/\s+/g, ' ').trim();
export { BitaKitRuntimeProvider };
