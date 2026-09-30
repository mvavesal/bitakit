import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createActionList } from '@bitakit/core';
import { bindActionShortcuts } from '../dist/bindings/action-shortcuts.js';
const dom = new JSDOM('<body><input><div contenteditable="true"></div></body>');
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Document',
  'KeyboardEvent',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLSelectElement',
])
  globalThis[key] =
    key === 'window' ? dom.window : key === 'document' ? dom.window.document : dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const key = (target = document, extra = {}) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'j',
      code: 'KeyJ',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...extra,
    }),
  );
const settle = () => new Promise((resolve) => setTimeout(resolve));

test('shortcuts execute without controls, preserve guards, input and registration cleanup', async () => {
  let runs = 0;
  let finish;
  const list = createActionList();
  const errors = [];
  const dispose = bindActionShortcuts(list, {}, (error) => errors.push(error));
  const registration = list.register({
    id: 'save',
    title: 'Save',
    shortcut: { keys: 'Control+J', input: 5 },
    execute: ({ input }) => {
      assert.equal(input, 5);
      runs++;
      return new Promise((resolve) => (finish = resolve));
    },
  });
  assert.equal(key(document.querySelector('input')), true);
  key(document, { repeat: true });
  key(document, { isComposing: true });
  assert.equal(runs, 0);
  assert.equal(key(), false);
  key();
  assert.equal(runs, 1);
  finish();
  await settle();
  registration.update({ enabled: false });
  key();
  assert.equal(runs, 1);
  registration.update({ enabled: true, visible: false });
  key();
  assert.equal(runs, 1);
  registration.update({ visible: true });
  key();
  assert.equal(runs, 2);
  finish();
  await settle();
  registration.unregister();
  key();
  assert.equal(runs, 2);
  assert.deepEqual(errors, []);
  dispose();
  list.dispose();
});

test('active scopes and library collision policy prevent duplicate execution; failed actions still reject', async () => {
  const list = createActionList();
  let first = 0,
    second = 0;
  const errors = [];
  const a = list.register({
    id: 'a',
    title: 'A',
    shortcut: { keys: 'Control+J', scope: 'editor' },
    execute: () => first++,
  });
  list.register({
    id: 'b',
    title: 'B',
    shortcut: { keys: 'Control+J', scope: 'editor' },
    execute: () => second++,
  });
  const global = bindActionShortcuts(list, {}, (error) => errors.push(error));
  key();
  assert.equal(first, 0);
  global();
  const editor = bindActionShortcuts(list, { scopes: ['editor'] }, (error) => errors.push(error));
  key();
  await settle();
  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(errors.length, 1);
  a.unregister();
  key();
  await settle();
  assert.equal(second, 1);
  list.update('b', {
    execute: () => {
      throw new Error('failed');
    },
  });
  key();
  await settle();
  assert.equal(errors.at(-1).message, 'failed');
  editor();
  key();
  await settle();
  assert.equal(second, 1);
  list.dispose();
});

test('internal actions are never bound; explicit text-input opt-in is honored', async () => {
  let runs = 0;
  const list = createActionList([
    {
      id: 'submit',
      title: 'Submit',
      internal: true,
      shortcut: { keys: 'Control+J', allowInInputs: true },
      execute: () => runs++,
    },
  ]);
  const stop = bindActionShortcuts(list, {}, assert.fail);
  key(document.querySelector('input'));
  assert.equal(runs, 0);
  list.update('submit', { internal: false });
  key(document.querySelector('input'));
  await settle();
  assert.equal(runs, 1);
  stop();
  list.dispose();
});
