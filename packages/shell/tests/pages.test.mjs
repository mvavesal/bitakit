import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, click } from './support.mjs';
import { JSDOM } from 'jsdom';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotFoundPage, ErrorPage, LoadingPage, AccessDeniedPage } from '../dist/pages.js';
import * as root from '../dist/index.js';

test('page states render without providers, sidebar or router and keep semantic headings', () => {
  for (const Component of [NotFoundPage, ErrorPage, LoadingPage, AccessDeniedPage]) {
    assert.equal(root[Component.name], Component, `${Component.name} is a root export`);
    const html = renderToStaticMarkup(
      h(Component, { title: 'Custom title', description: 'Custom description' }),
    );
    const doc = new JSDOM(html).window.document;
    assert.equal(doc.querySelector('[role="heading"][aria-level="1"]').textContent, 'Custom title');
    assert.equal(
      doc.querySelector('[data-slot="empty-description"]').textContent,
      'Custom description',
    );
    assert.equal(doc.querySelector('nav, aside'), null);
    for (const icon of doc.querySelectorAll('svg'))
      assert.equal(icon.getAttribute('aria-hidden'), 'true');
  }
  const defaults = new JSDOM(renderToStaticMarkup(h(NotFoundPage))).window.document;
  assert.equal(defaults.querySelector('[role="heading"]').textContent, 'Page not found');
  const loading = new JSDOM(renderToStaticMarkup(h(LoadingPage))).window.document;
  assert.equal(loading.querySelector('[role="status"]').getAttribute('aria-busy'), 'true');
});

test('error retry calls the host callback and actions remain host-owned', async () => {
  let resets = 0;
  const view = await mount(h(ErrorPage, { reset: () => resets++ }, h('a', { href: '/' }, 'Home')));
  try {
    await click(view.container.querySelector('button'));
    assert.equal(resets, 1);
    assert.equal(view.container.querySelector('a').getAttribute('href'), '/');
    assert.equal(view.container.querySelector('button').type, 'button');
  } finally {
    await view.unmount();
  }
});
