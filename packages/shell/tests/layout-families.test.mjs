import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, settle } from './support.mjs';
import { createElement as h } from 'react';
import { createMemorySettingsStorage, definePlugin, layoutSlots } from '@bitakit/core';
import { BitaKitRuntimeProvider } from '@bitakit/ui';
import { AppShell, ErrorPage, NotFoundPage, shellPlugin } from '../dist/index.js';
import { renderToStaticMarkup } from 'react-dom/server';

/** A page plugin whose pages name layout families; layouts render around `[data-page]`. */
const pages = definePlugin({
  id: 'pages',
  ui: {
    pages: [
      { path: '/login', component: () => null, layout: 'auth' },
      { path: '/docs', component: () => null },
    ],
  },
});
/** A page in a family only some tests declare; startup rejects it elsewhere. */
const welcome = definePlugin({
  id: 'welcome',
  ui: { pages: [{ path: '/welcome', component: () => null, layout: 'onboarding' }] },
});
const frame = (name) =>
  function Frame({ children }) {
    return h('section', { 'data-frame': name }, children);
  };

function setup({ plugins = [], app = [], families = [], choose } = {}) {
  const config = {
    slots: layoutSlots(families),
    plugins: [shellPlugin(), pages, ...plugins],
    ui: { slots: app },
    ...(choose ? { choose } : {}),
  };
  const services = { 'settings.storage': createMemorySettingsStorage() };
  return (pathname, content) =>
    h(BitaKitRuntimeProvider, { config, services, actionOptions: { pathname } }, content);
}
const page = h('p', { 'data-page': '' }, 'Page');

test('Shell defaults: auth and error families center the page without navigation', async () => {
  const tree = setup();
  const view = await mount(tree('/login', h(AppShell, null, page)));
  try {
    await settle();
    const c = view.container;
    assert.ok(c.querySelector('[data-shell-layout="auth"] [data-page]'));
    assert.equal(c.querySelector('[data-slot="sidebar"]'), null);

    await view.render(tree('/anything', h(AppShell, { layout: 'error' }, page)));
    assert.ok(c.querySelector('[data-shell-layout="error"] [data-page]'));
  } finally {
    await view.unmount();
  }
});

test('a layout file replaces the default; the app’s own file wins over a plugin', async () => {
  const brand = definePlugin({
    id: 'brand',
    ui: { slots: [{ slot: 'layout.auth', component: frame('brand'), key: 'default' }] },
  });
  let tree = setup({ plugins: [brand] });
  let view = await mount(tree('/login', h(AppShell, null, page)));
  try {
    await settle();
    assert.ok(view.container.querySelector('[data-frame="brand"] [data-page]'));
  } finally {
    await view.unmount();
  }
  tree = setup({
    plugins: [brand],
    app: [{ slot: 'layout.auth', component: frame('mine'), key: 'default' }],
  });
  view = await mount(tree('/login', h(AppShell, null, page)));
  try {
    await settle();
    assert.ok(view.container.querySelector('[data-frame="mine"] [data-page]'));
    assert.equal(view.container.querySelector('[data-frame="brand"]'), null);
  } finally {
    await view.unmount();
  }
});

test('layout.app replaces the whole frame; other pages keep their families', async () => {
  const tree = setup({ app: [{ slot: 'layout.app', component: frame('dock'), key: 'default' }] });
  const view = await mount(tree('/docs', h(AppShell, null, page)));
  try {
    await settle();
    const c = view.container;
    assert.ok(c.querySelector('[data-shell-layout="app"] [data-frame="dock"] [data-page]'));
    assert.equal(c.querySelector('[data-slot="sidebar"]'), null, 'no built-in sidebar');
    await view.render(tree('/login', h(AppShell, null, page)));
    assert.ok(c.querySelector('[data-shell-layout="auth"] [data-page]'));
  } finally {
    await view.unmount();
  }
});

test('a custom family renders its variant, chosen in configuration when there are several', async () => {
  const variants = [
    { slot: 'layout.onboarding', component: frame('steps'), key: 'steps' },
    { slot: 'layout.onboarding', component: frame('tour'), key: 'tour' },
  ];
  const original = console.error;
  const errors = [];
  console.error = (message) => errors.push(String(message));
  let view;
  try {
    // Two variants and no choice: the app frame renders the page and the conflict is reported.
    view = await mount(
      setup({ families: ['onboarding'], app: variants, plugins: [welcome] })(
        '/welcome',
        h(AppShell, null, page),
      ),
    );
    await settle();
    assert.ok(view.container.querySelector('[data-shell-layout="sidebar"] main [data-page]'));
    assert.match(
      errors.join('\n'),
      /Slot "layout\.onboarding" has several candidates \(app:steps, app:tour\)/,
    );
  } finally {
    console.error = original;
    await view?.unmount();
  }
  view = await mount(
    setup({
      families: ['onboarding'],
      app: variants,
      plugins: [welcome],
      choose: { 'layout.onboarding': 'tour' },
    })('/welcome', h(AppShell, null, page)),
  );
  try {
    await settle();
    assert.ok(view.container.querySelector('[data-frame="tour"] [data-page]'));
  } finally {
    await view.unmount();
  }
});

test('an unknown family names the files that would add it', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      mount(setup()('/docs', h(AppShell, { layout: 'kiosk' }, page))),
      /no layout family "kiosk"\. Add src\/layouts\/kiosk\.tsx/,
    );
  } finally {
    console.error = original;
  }
});

test('screens: page states render a replacement when one exists, and work without a runtime', async () => {
  const markup = renderToStaticMarkup(h(NotFoundPage));
  assert.match(markup, /Page not found/, 'standalone, without BitaKit');

  let reset = 0;
  const Oops = ({ payload }) =>
    h('button', { 'data-oops': '', onClick: () => payload.reset?.() }, 'Oops');
  const tree = setup({
    app: [
      { slot: 'screen.not-found', component: () => h('p', { 'data-lost': '' }, 'Lost?') },
      { slot: 'screen.error', component: Oops },
    ],
  });
  const view = await mount(
    tree('/docs', h('div', null, h(NotFoundPage), h(ErrorPage, { reset: () => reset++ }))),
  );
  try {
    await settle();
    const c = view.container;
    assert.ok(c.querySelector('[data-lost]'));
    assert.doesNotMatch(c.textContent, /Page not found/);
    c.querySelector('[data-oops]').click();
    assert.equal(reset, 1, 'the error screen receives reset');
  } finally {
    await view.unmount();
  }
});
