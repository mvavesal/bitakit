// A jsdom document with the browser APIs Radix menus use. Imported before any component module,
// because Radix decides some behavior when it is first imported; `support.mjs` covers the
// binding tests that render no Radix primitives.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Events dispatched on DOM nodes must be jsdom's, not Node's own Event classes.
globalThis.Event = dom.window.Event;
globalThis.CustomEvent = dom.window.CustomEvent;
// Components read DOM classes and window functions (getComputedStyle) as globals.
for (const name of Object.getOwnPropertyNames(dom.window)) {
  if (name in globalThis) continue;
  const value = dom.window[name];
  globalThis[name] =
    typeof value === 'function' && /^[a-z]/.test(name) ? value.bind(dom.window) : value;
}
dom.window.Element.prototype.scrollIntoView ??= () => {};
dom.window.Element.prototype.hasPointerCapture ??= () => false;
dom.window.Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
dom.window.ResizeObserver ??= globalThis.ResizeObserver;
