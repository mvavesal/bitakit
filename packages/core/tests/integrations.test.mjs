import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList, Action } from '@bitakit/core/actions';
import {
  FoundationRuntime,
  defineAction,
  definePlugin,
  resolveFoundationConfig,
  createTranslationPlugin,
  resolveText,
} from '../dist/core.js';

const translator = (messages) =>
  Object.assign((key) => messages[key] ?? key, {
    has: (key) => typeof messages[key] === 'string',
  });

test('translation integration updates existing registrations without recreating services or pending actions', async () => {
  const i18n = createTranslationPlugin(translator({ title: 'Invite', description: 'Details' }));
  let created = 0,
    finish;
  const list = createActionList();
  const runtime = new FoundationRuntime(list, {
    plugins: [
      i18n,
      {
        id: 'demo',
        services: [
          {
            id: 'counter',
            create() {
              created++;
              return {};
            },
          },
        ],
      },
    ],
    actions: [
      defineAction({
        id: 'invite',
        title: 'title',
        description: 'description',
        execute: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        success: false,
      }),
    ],
  });
  const cleanup = runtime.mount();
  assert.equal(list.get('invite').title, 'Invite');
  assert.equal(runtime.services.i18n, i18n.translation);
  const run = list.execute('invite');
  await Promise.resolve();
  i18n.update(translator({ title: 'Einladen', description: 'Beschreibung' }));
  assert.equal(created, 1);
  assert.equal(list.get('invite').title, 'Einladen');
  assert.equal(list.get('invite').description, 'Beschreibung');
  assert.equal(list.get('invite').pending, true);
  finish();
  await run;
  cleanup();
  list.register({ id: 'invite', title: 'Host' });
  i18n.update(translator({ title: 'Changed' }));
  assert.equal(list.get('invite').title, 'Host', 'subscription removed on unmount');
  assert.equal(resolveText(translator({ namespace: {} }), 'namespace'), 'namespace');
});

test('plugins share service dependency ordering, reject collisions and obey explicit selection', () => {
  const base = definePlugin({ id: 'base', services: [{ id: 'base', create: () => 7 }] });
  const derived = definePlugin({
    id: 'derived',
    services: [{ id: 'derived', requires: ['base'], create: ({ services }) => services.base + 1 }],
  });
  const runtime = new FoundationRuntime(createActionList(), { plugins: [derived, base] });
  const stop = runtime.mount();
  assert.equal(runtime.services.derived, 8);
  stop();
  assert.deepEqual(resolveFoundationConfig({ plugins: [base] }, { plugins: [] }).plugins, []);
  assert.throws(() => resolveFoundationConfig({ plugins: [base, base] }), /duplicate plugin/);
  assert.throws(
    () => new FoundationRuntime(createActionList(), { plugins: [base] }, { base: 1 }).mount(),
    /Duplicate service/,
  );
  assert.throws(
    () => new FoundationRuntime(createActionList(), { plugins: [derived] }).mount(),
    /requires service "base"/,
  );
});

test('watched services invalidate all bound actions with one subscription and automatic cleanup', async () => {
  let user = null,
    subscriptions = 0;
  const listeners = new Set();
  const auth = {
    getSnapshot: () => ({ user, pending: false }),
    subscribe(listener) {
      subscriptions++;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signOut() {},
  };
  const action = (id) =>
    defineAction({
      id,
      watch: ['auth'],
      resolve: (_, { services }) => ({ visible: !!services.auth.getSnapshot().user }),
    });
  const list = createActionList();
  const runtime = new FoundationRuntime(
    list,
    { actions: [action('one'), action('two')] },
    { auth },
  );
  const stop = runtime.mount();
  assert.equal(subscriptions, 1);
  assert.equal(list.resolve('one').visible, false);
  let updates = 0;
  const off = list.subscribe(() => updates++);
  user = { id: 'user' };
  listeners.forEach((listener) => listener());
  assert.equal(list.resolve('one').visible, true);
  assert.equal(list.resolve('two').visible, true);
  assert.ok(updates > 0);
  off();
  stop();
  assert.equal(listeners.size, 0);
  assert.throws(
    () => new FoundationRuntime(createActionList(), { actions: [action('missing')] }).mount(),
    /Observed service/,
  );
});

test('catalog access follows provider updates without copying catalog state', () => {
  const de = { betterAuth: { languageTag: 'de-DE' } };
  const en = { betterAuth: { languageTag: 'en-US' } };
  const plugin = createTranslationPlugin(translator({}), namespace => namespace ? de[namespace] : de);
  assert.equal(plugin.translation.getCatalog(), de);
  assert.equal(plugin.translation.getCatalog('missing'), undefined);
  let changes = 0;
  const stop = plugin.translation.subscribe(() => changes++);
  plugin.update(translator({}), namespace => namespace ? en[namespace] : en);
  assert.equal(plugin.translation.getCatalog('betterAuth'), en.betterAuth);
  assert.equal(changes, 1);
  stop();
});
