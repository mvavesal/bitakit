// A jsdom document with the browser APIs HeroUI, React Aria and Radix read when they load, and
// act-wrapped mounting. Import this module before React, the UI libraries or the package, so the
// globals exist when those modules initialize. Mirrors packages/shell/tests/support.mjs, plus
// `location`, which nuqs reads.
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
  location: window.location,
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
window.matchMedia = globalThis.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act } = await import('react');
const { createRoot } = await import('react-dom/client');

/** Renders into a fresh container; `unmount` removes it, both inside act. */
export async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

/** Lets pending service loads, queries and effects settle. */
export async function settle(rounds = 5) {
  for (let round = 0; round < rounds; round++)
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
}
