import test from 'node:test';
import assert from 'node:assert/strict';
import cssEscape from 'css.escape';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Document',
  'DocumentFragment',
  'MutationObserver',
  'CustomEvent',
  'Event',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
  'HTMLButtonElement',
  'SVGElement',
  'NodeFilter',
])
  globalThis[key] =
    key === 'window' ? dom.window : key === 'document' ? dom.window.document : dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.CSS = { escape: cssEscape };
globalThis.getComputedStyle = dom.window.getComputedStyle;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createElement: h, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { toast, Toast } = await import('@heroui/react');
const { FoundationRuntime, createActionList, defineAction } = await import('@bitakit/core');
const { createAppPreferences, createMemoryStorage, SettingsProvider } = await import(
  '@bitakit/app-preferences'
);
const { appPreferencesPlugin } = await import('@bitakit/app-preferences/foundation');
const { FoundationContext } = await import('../../ui/dist/providers/foundation-context.js');
const { shellPlugin, notificationPreferences } = await import('../dist/index.js');
const { createShellProvider } = await import('../dist/providers/shell-context.js');

test('one native surface presents Action and native-source toasts at the confirmed shared position', async () => {
  toast.clear();
  const settings = createAppPreferences({ storage: createMemoryStorage() });
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    plugins: [appPreferencesPlugin({ settings }), shellPlugin({ notifications: true })],
    actions: [defineAction({ id: 'saved', success: 'Action saved', execute() {} })],
  });
  const stop = runtime.mount();
  await settings.activate({ userId: 'provider-test' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let layout;
  const render = () =>
    h(
      FoundationContext.Provider,
      { value: { runtime, ui: {}, labels: {}, notify() {} } },
      h(
        SettingsProvider,
        { settings },
        h(createShellProvider(undefined, undefined, { placement: notificationPreferences.fields.placement, layout })),
      ),
    );
  try {
    await act(async () => root.render(render()));
    await act(async () => {
      await list.execute('saved');
      toast.info('Native notification', { timeout: 0 });
    });
    assert.equal(document.querySelectorAll('[data-slot="toast-region"]').length, 1);
    assert.match(document.body.textContent, /Action saved/);
    assert.match(document.body.textContent, /Native notification/);
    await act(async () => settings.set(notificationPreferences.fields.placement, 'top end'));
    const region = document.querySelector('[data-slot="toast-region"]');
    assert.ok(region.classList.contains('toast-region--top-end'));
    assert.ok(
      [...document.querySelectorAll('[data-slot=toast]')].every(
        (item) => item.getAttribute('data-placement') === 'top end',
      ),
    );
    layout = ({ toast: item }) => h(Toast, { toast: item, 'data-custom-layout': true },
      h(Toast.Content, null,
        h(Toast.Title, null, item.content.title),
        h(Toast.Description, null, 'Shared custom layout')),
      h(Toast.CloseButton));
    await act(async () => root.render(render()));
    assert.equal(document.querySelectorAll('[data-custom-layout]').length, 2);
    assert.match(document.body.textContent, /Action saved/);
    assert.match(document.body.textContent, /Native notification/);
    assert.match(document.body.textContent, /Shared custom layout/);
    await act(async () => root.unmount());
    toast.clear();
    const remaining = toast.getQueue().visibleToasts.map((item) => item.key);
    await list.execute('saved');
    assert.deepEqual(
      toast.getQueue().visibleToasts.map((item) => item.key),
      remaining,
      'unmount removes the notifier',
    );
  } finally {
    await act(async () => {
      toast.clear();
      root.unmount();
    });
    stop();
    container.remove();
  }
});
