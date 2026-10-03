// Shared helpers for the Shell tests: a jsdom document with the browser APIs HeroUI and Radix
// read when they load, a controllable matchMedia, and act-wrapped mounting. Import this module
// before React, HeroUI or the package so the globals exist when those modules initialize.
import { JSDOM } from 'jsdom';
import cssEscape from 'css.escape';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLAnchorElement',
  'HTMLButtonElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'Element',
  'Node',
  'Document',
  'DocumentFragment',
  'MutationObserver',
  'Event',
  'CustomEvent',
  'FocusEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'SVGElement',
  'NodeFilter',
])
  globalThis[key] = key === 'window' ? window : window[key];
for (const [key, value] of Object.entries({
  navigator: window.navigator,
  localStorage: window.localStorage,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
}))
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
globalThis.CSS = window.CSS = { escape: cssEscape, supports: () => false };
globalThis.ResizeObserver = window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `prefers-color-scheme: dark` and the sidebar's mobile breakpoint, switchable per test. Reduced
 * motion is on, so HeroUI removes closed toasts at once instead of animating them out.
 */
const media = { dark: false, mobile: false, reducedMotion: true };
const mediaListeners = new Set();
const matches = (query) =>
  query.includes('prefers-color-scheme: dark')
    ? media.dark
    : query.includes('max-width: 767px')
      ? media.mobile
      : query.includes('prefers-reduced-motion: reduce')
        ? media.reducedMotion
        : false;
window.matchMedia = globalThis.matchMedia = (query) => ({
  get matches() {
    return matches(query);
  },
  media: query,
  onchange: null,
  addEventListener: (_type, listener) => mediaListeners.add(listener),
  removeEventListener: (_type, listener) => mediaListeners.delete(listener),
  addListener: (listener) => mediaListeners.add(listener),
  removeListener: (listener) => mediaListeners.delete(listener),
  dispatchEvent: () => false,
});

const { act } = await import('react');
const { createRoot } = await import('react-dom/client');

export async function setMedia(next) {
  Object.assign(media, next);
  await act(async () => [...mediaListeners].forEach((listener) => listener()));
}

/** Renders into a fresh container; `render` re-renders and `unmount` removes it, both inside act. */
export async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    render: (next) => act(async () => root.render(next)),
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

export const tick = () => new Promise((resolve) => setTimeout(resolve));
/** Lets pending settings loads and effects settle. */
export const settle = () => act(tick);
export const click = (element) => act(async () => element.click());
export const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

/** A nested-key translator over the package catalogs, as next-intl resolves them. */
export function catalogTranslator(messages) {
  const lookup = (key) =>
    key
      .split('.')
      .reduce(
        (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
        messages,
      );
  const translate = (key, values) => {
    const message = lookup(key);
    if (typeof message !== 'string') return key;
    return message.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name] ?? `{${name}}`));
  };
  translate.has = (key) => typeof lookup(key) === 'string';
  return translate;
}
