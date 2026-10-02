import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionList } from '@bitakit/core/actions';
import {
  createRuntime,
  createTranslationPlugin,
  defineAction,
  definePlugin,
  defineService,
  resolveFoundationConfig,
  resolveText,
} from '../dist/core.js';

const translator = (messages) =>
  Object.assign((key) => messages[key] ?? key, {
    has: (key) => typeof messages[key] === 'string',
  });

test('the translation plugin updates existing registrations without recreating services or pending actions', async () => {
  const i18n = createTranslationPlugin(translator({ title: 'Invite', description: 'Details' }));
  let created = 0,
    finish;
  const list = createActionList();
  const runtime = createRuntime(
    {
      plugins: [
        i18n,
        definePlugin({
          id: 'demo',
          services: {
            counter: defineService(() => {
              created++;
              return {};
            }),
          },
        }),
      ],
      actions: {
        invite: defineAction({
          title: 'title',
          description: 'description',
          execute: () =>
            new Promise((resolve) => {
              finish = resolve;
            }),
          success: false,
        }),
      },
    },
    { actions: list },
  );
  const cleanup = runtime.mount();
  assert.equal(list.get('invite').title, 'Invite');
  assert.equal(runtime.services.i18n, i18n.translation);
  assert.equal(runtime.services.translation.i18n, i18n.translation);
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
  // An alias may not reuse a plugin namespace: 'base' already names base.value.
  const base = definePlugin({
    id: 'base',
    services: { value: defineService(() => 7, { exposeAs: 'seven' }) },
  });
  const derived = definePlugin({
    id: 'derived',
    services: {
      value: defineService(({ services }) => services.seven + 1, {
        requires: ['seven'],
        exposeAs: 'eight',
      }),
    },
  });
  const runtime = createRuntime({ plugins: [derived, base] });
  const stop = runtime.mount();
  assert.equal(runtime.services.eight, 8);
  assert.equal(runtime.services.derived.value, 8);
  stop();
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          definePlugin({
            id: 'base',
            services: { value: defineService(() => 7, { exposeAs: 'base' }) },
          }),
        ],
      }),
    /Service name "base" in plugin "base" is already used as a namespace by base\.value/,
  );
  assert.deepEqual(resolveFoundationConfig({ plugins: [base] }, { plugins: [] }).plugins, []);
  assert.throws(() => resolveFoundationConfig({ plugins: [base, base] }), /duplicate plugin/);
  assert.throws(
    () => createRuntime({ plugins: [base] }, { services: { 'base.value': 1 } }).mount(),
    /Duplicate service "base\.value"/,
  );
  assert.throws(() => createRuntime({ plugins: [derived] }).mount(), /requires service "seven"/);
});

test('catalog access follows provider updates without copying catalog state', () => {
  const de = { betterAuth: { languageTag: 'de-DE' } };
  const en = { betterAuth: { languageTag: 'en-US' } };
  const plugin = createTranslationPlugin(translator({}), (namespace) =>
    namespace ? de[namespace] : de,
  );
  assert.equal(plugin.translation.getCatalog(), de);
  assert.equal(plugin.translation.getCatalog('missing'), undefined);
  let changes = 0;
  const stop = plugin.translation.subscribe(() => changes++);
  plugin.update(translator({}), (namespace) => (namespace ? en[namespace] : en));
  assert.equal(plugin.translation.getCatalog('betterAuth'), en.betterAuth);
  assert.equal(changes, 1);
  stop();
});
