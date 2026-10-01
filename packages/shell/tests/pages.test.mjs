import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createElement as h, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { NotFoundPage, ErrorPage, LoadingPage, AccessDeniedPage } from '../dist/pages.js';

test('page states render without providers, sidebar, or router and preserve semantic headings', () => {
  for (const Component of [NotFoundPage, ErrorPage, LoadingPage, AccessDeniedPage]) {
    const html = renderToStaticMarkup(h(Component, { title: 'Custom title', description: 'Custom description' }));
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelector('[role="heading"][aria-level="1"]').textContent, 'Custom title');
    assert.equal(doc.querySelector('[data-slot="empty-description"]').textContent, 'Custom description');
    assert.equal(doc.querySelector('nav, aside'), null);
    for (const icon of doc.querySelectorAll('svg')) assert.equal(icon.getAttribute('aria-hidden'), 'true');
  }
  const loading = new JSDOM(renderToStaticMarkup(h(LoadingPage))).window.document;
  assert.equal(loading.querySelector('[role="status"]').getAttribute('aria-busy'), 'true');
});

test('error retry calls the host callback and actions remain host-owned', async () => {
  const dom = new JSDOM('<html><body></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  let resets = 0;
  try {
    await act(async () => root.render(h(ErrorPage, { reset: () => resets++ }, h('a', { href: '/' }, 'Home'))));
    await act(async () => host.querySelector('button').click());
    assert.equal(resets, 1);
    assert.equal(host.querySelector('a').getAttribute('href'), '/');
    assert.equal(host.querySelector('button').type, 'button');
  } finally { await act(async () => root.unmount()); }
});
