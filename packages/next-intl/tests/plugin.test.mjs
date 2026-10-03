import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator } from 'next-intl';
import { createRuntime } from '@bitakit/core';
import { nextIntlPlugin } from '../dist/index.js';
import { createMessageBridge } from '../dist/messages.js';

const messages = { todos: { add: { title: 'Add {name}' }, settings: { title: 'Todos' } } };

test('the translation service reads what the provider publishes and notifies on changes only', () => {
  const { service, publish } = createMessageBridge();
  assert.equal(service.translate.has('todos.add.title'), false, 'literal fallback before publish');
  assert.equal(service.getCatalog('todos'), undefined);
  let notified = 0;
  const stop = service.subscribe(() => notified++);
  const t = createTranslator({ locale: 'en', messages });
  publish(t, messages);
  publish(t, messages);
  assert.equal(notified, 1);
  assert.equal(service.translate('todos.add.title', { name: 'milk' }), 'Add milk');
  assert.equal(service.translate.has('todos.add.title'), true);
  assert.equal(service.translate.has('todos.add'), false, 'groups are not texts');
  assert.equal(service.translate.has('todos.missing'), false);
  assert.deepEqual(service.getCatalog('todos.settings'), { title: 'Todos' });
  assert.equal(service.getCatalog(), messages);
  const german = { todos: { add: { title: '{name} hinzufügen' } } };
  publish(createTranslator({ locale: 'de', messages: german }), german);
  assert.equal(notified, 2);
  assert.equal(service.translate('todos.add.title', { name: 'Milch' }), 'Milch hinzufügen');
  stop();
});

test('nextIntlPlugin needs no host objects and provides i18n with a messages provider', () => {
  const plugin = nextIntlPlugin();
  assert.equal(plugin.id, 'next-intl');
  assert.deepEqual(
    plugin.ui.providers.map((provider) => provider.id),
    ['next-intl.messages'],
  );
  const runtime = createRuntime({ plugins: [plugin] });
  const stop = runtime.mount();
  try {
    assert.equal(typeof runtime.services.i18n.translate, 'function');
    assert.equal(
      runtime.text('todos.add.title', 'Add'),
      'Add',
      'literal until next-intl publishes',
    );
  } finally {
    stop();
  }
});
