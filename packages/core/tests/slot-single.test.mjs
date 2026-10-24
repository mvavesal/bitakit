import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  defineSlot,
  pluginLayout,
  selectSingle,
  candidateNames,
} from '../dist/core.js';

const part = () => defineSlot({ accepts: 'component', policy: 'single' });

test('a single slot collects candidates from several plugins without a conflict', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({ id: 'owner', slots: { screen: part() } }),
      definePlugin({ id: 'brand', ui: { slots: [{ slot: 'owner.screen', component: 'brand' }] } }),
      definePlugin({
        id: 'fancy',
        ui: {
          slots: [
            { slot: 'owner.screen', component: 'split', key: 'split' },
            { slot: 'owner.screen', component: 'centered', key: 'centered' },
          ],
        },
      }),
    ],
  });
  const stop = runtime.mount();
  try {
    await runtime.ready;
    assert.deepEqual(
      runtime.slots
        .get('owner.screen')
        .items.map(({ plugin, key, component }) => [plugin, key, component]),
      [
        ['brand', undefined, 'brand'],
        ['fancy', 'split', 'split'],
        ['fancy', 'centered', 'centered'],
      ],
    );
  } finally {
    await stop();
  }
});

test('one contributor cannot offer the same candidate twice', async () => {
  const runtime = createRuntime({
    plugins: [
      definePlugin({ id: 'owner', slots: { screen: part() } }),
      definePlugin({
        id: 'brand',
        ui: {
          slots: [
            { slot: 'owner.screen', component: 'a', key: 'same' },
            { slot: 'owner.screen', component: 'b', key: 'same' },
          ],
        },
      }),
    ],
  });
  assert.throws(() => runtime.mount(), /contribution "brand:view:1" conflicts with "brand:view:0"/);
});

test('selectSingle: choice, then the app, then the only candidate; ties select nothing', () => {
  const brand = { plugin: 'brand' };
  const split = { plugin: 'fancy', key: 'split' };
  const centered = { plugin: 'fancy', key: 'centered' };
  const app = { plugin: 'app', key: 'default' };
  const select = (candidates, choice) => selectSingle(candidates, { choice, appId: 'app' });

  assert.deepEqual(candidateNames(split), ['fancy', 'fancy:split', 'split']);
  assert.deepEqual(candidateNames(brand), ['brand']);

  assert.equal(select([]).selected, undefined);
  assert.equal(select([]).reason, undefined);
  assert.equal(select([brand]).selected, brand);
  assert.equal(select([brand, split]).reason, 'ambiguous');
  assert.equal(select([brand, split]).selected, undefined);
  // The app's own contribution beats plugins without any configuration.
  assert.equal(select([brand, split, app]).selected, app);
  // Two variants of the app itself still need a decision.
  assert.equal(select([app, { plugin: 'app', key: 'split' }]).reason, 'ambiguous');

  assert.equal(select([brand, split, app], 'split').selected, split);
  assert.equal(select([brand, split, app], 'fancy:centered').reason, 'choice-unavailable');
  assert.equal(select([brand, split, centered], 'fancy:centered').selected, centered);
  assert.equal(select([brand, split, centered], 'fancy').reason, 'ambiguous');
  assert.equal(select([brand, split, app], 'brand').selected, brand);
  assert.equal(select([brand], 'missing').reason, 'choice-unavailable');
});

test('pages may name any declared layout family; layout files become slot candidates', async () => {
  const Component = () => null;
  assert.deepEqual(pluginLayout({ default: Component }, 'auth', 'split'), {
    slot: 'layout.auth',
    key: 'split',
    component: Component,
  });
  assert.equal(pluginLayout({ default: Component }, 'auth').key, 'default');

  const frames = definePlugin({
    id: 'frames',
    slots: { auth: defineSlot({ id: 'layout.auth', accepts: 'component', policy: 'single' }) },
  });
  const page = (layout) =>
    definePlugin({
      id: 'login',
      ui: { pages: [{ path: '/login', component: Component, layout }] },
    });
  const ok = createRuntime({ plugins: [frames, page('auth')] });
  await ok.mount()();

  assert.throws(
    () => createRuntime({ plugins: [frames, page('onboarding')] }),
    /no layout family "onboarding" exists\. Add src\/layouts\/onboarding\.tsx .*Known layouts: auth\./,
  );
});
