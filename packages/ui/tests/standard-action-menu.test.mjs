import './browser-dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, act } from 'react';
import { defineAction, definePlugin } from '@bitakit/core';
import { mount, click } from './support.mjs';
import { ActionMenu, BitaKitRuntimeProvider } from '../dist/index.js';

const press = (element, key) =>
  act(async () => {
    element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  });
// Compared as booleans: a failing assertion on a jsdom node would print its whole tree.
const menu = () => document.querySelector('[role="menu"]');
const item = (title) =>
  [...document.querySelectorAll('[role="menuitem"]')].find((entry) => entry.textContent === title);

test('the standard menu closes after a link item navigates and after a plain item runs', async () => {
  const visits = [];
  let saved = 0;
  const config = {
    plugins: [
      definePlugin({
        id: 'files',
        actions: {
          notes: defineAction({ title: 'Notes', href: '/notes', groups: ['go'] }),
          save: defineAction({ title: 'Save', groups: ['go'], execute: () => void saved++ }),
        },
      }),
    ],
  };
  const view = await mount(
    h(
      BitaKitRuntimeProvider,
      { config, actionOptions: { navigate: (href) => visits.push(href) } },
      h(ActionMenu, { group: 'go', label: 'Go' }),
    ),
  );
  try {
    const trigger = view.container.querySelector('button');
    await press(trigger, 'Enter');
    const link = item('Notes');
    assert.equal(link.tagName, 'A', 'a navigation Action stays a real link');
    assert.equal(link.getAttribute('href'), '/notes');
    // The link routes on the client and cancels its click; the menu still closes.
    await click(link);
    assert.deepEqual(visits, ['/notes']);
    assert.equal(Boolean(menu()), false, 'the menu closed');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');

    await press(trigger, 'Enter');
    await click(item('Save'));
    assert.equal(saved, 1);
    assert.equal(Boolean(menu()), false, 'the menu closed');
  } finally {
    // A menu left open (a failed assertion) would keep its layer listening.
    if (menu()) await press(menu(), 'Escape');
    await view.unmount();
  }
});
