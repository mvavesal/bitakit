import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import Color from 'colorjs.io';
import { createAppPreferences } from '@bitakit/app-preferences/core';
import { themePreferences } from '../dist/definitions.js';
import { bindThemePreferences, primaryForeground } from '../dist/theme/projection.js';

const fields = themePreferences.fields;

test('custom primary colors choose readable foregrounds and reject malformed storage values', () => {
  for (const color of [
    '#000000',
    '#ffffff',
    '#2563eb',
    '#7c3aed',
    '#059669',
    '#e11d48',
    '#ea580c',
    '#808080',
  ]) {
    assert.ok(new Color(color).contrastWCAG21(primaryForeground(color)) >= 4.5);
    assert.equal(fields.primary.parse(color), color);
  }
  assert.throws(() => fields.primary.parse('url(unsafe)'));
});

test('theme projection follows confirmed writes and restores host tokens on disposal', async () => {
  const dom = new JSDOM('<html style="--primary: blue"><body></body></html>');
  const root = dom.window.document.documentElement;
  let finish;
  const settings = createAppPreferences({
    definitions: themePreferences.settings,
    storage: {
      async load() {
        return { writable: true };
      },
      async save() {
        await new Promise((resolve) => {
          finish = resolve;
        });
      },
    },
  });
  await settings.activate({ userId: 'test' });
  const stop = bindThemePreferences(settings, root);
  const write = settings.set(fields.primary, '#ffffff');
  assert.equal(
    root.style.getPropertyValue('--primary'),
    'blue',
    'pending values do not change the theme',
  );
  finish();
  await write;
  assert.equal(root.style.getPropertyValue('--primary'), '#ffffff');
  assert.equal(root.style.getPropertyValue('--primary-foreground'), '#000000');
  const cornerWrite = settings.set(fields.corners, 'square');
  finish();
  await cornerWrite;
  assert.equal(root.getAttribute('data-shell-corners'), 'square');
  stop();
  assert.equal(root.style.getPropertyValue('--primary'), 'blue');
  assert.equal(root.style.getPropertyValue('--primary-foreground'), '');
  assert.equal(root.hasAttribute('data-shell-corners'), false);
  const later = settings.set(fields.primary, '#2563eb');
  finish();
  await later;
  assert.equal(root.style.getPropertyValue('--primary'), 'blue', 'subscriptions are released');
  dom.window.close();
});
