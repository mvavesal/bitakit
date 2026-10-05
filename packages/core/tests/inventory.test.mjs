import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  defineAction,
  definePlugin,
  defineService,
  defineSettings,
  setting,
  defineConfig,
  inspectRuntime,
  observeRuntimeInventory,
  defineSlot,
} from '../dist/core.js';

test('inventory separates declarations from live state and never exposes runtime data or callbacks', async () => {
  const secret = 'credential-that-must-not-be-serialized';
  const plugin = definePlugin({
    id: 'sample',
    metadata: { name: 'Sample' },
    config: defineConfig({ defaults: { token: secret } }),
    settings: defineSettings({ token: setting({ default: secret }) }),
    services: { state: defineService(({ store }) => ({ state: store({ secret }) })) },
    actions: {
      run: defineAction({ title: secret, execute: () => secret }),
      hidden: defineAction({ internal: true, execute: () => secret }),
    },
    slots: { tools: defineSlot({ accepts: 'actions' }) },
  });
  const runtime = createRuntime({ plugins: [plugin] });
  const before = inspectRuntime(runtime);
  assert.equal(before.version, 1);
  assert.equal(before.live.phase, 'idle');
  assert.equal(before.live.cleanup, 'none');
  assert.equal(before.live.operation, null);
  assert.equal(before.static.plugins[1].enabled, true);
  assert.ok(before.live.plugins.every((entry) => Number.isFinite(entry.since)));
  assert.ok(before.live.services.every((entry) => Number.isFinite(entry.since)));
  const stop = runtime.mount();
  await runtime.ready;
  const inventory = inspectRuntime(runtime),
    serialized = JSON.stringify(inventory);
  assert.equal(inventory.live.phase, 'ready');
  assert.equal(inventory.live.cleanup, 'none');
  assert.equal(inventory.live.operation, null);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('sample.hidden'), false);
  assert.ok(
    inventory.static.plugins[1].declarations.some(
      (item) => item.kind === 'setting' && item.id === 'sample.token',
    ),
  );
  assert.equal(inventory.live.actions.find((item) => item.id === 'sample.run').plugin, 'sample');
  const slot = inventory.live.slots.find((item) => item.id === 'sample.tools');
  assert.equal(slot.plugin, 'sample');
  assert.equal(slot.mountedOutlets, null);
  assert.equal(slot.visibleCount, null);
  assert.equal(slot.renderFailures, null);
  await stop();
  const stopped = inspectRuntime(runtime).live;
  assert.equal(stopped.phase, 'stopped');
  assert.equal(stopped.cleanup, 'complete');
  assert.equal(stopped.operation, null);
});

test('inventory external-store snapshots are stable and update on scoped runtime changes', async () => {
  let scope;
  const plugin = definePlugin({
    id: 'sample',
    setup: ({ app }) => {
      scope = app;
    },
    slots: { tools: defineSlot({ accepts: 'component' }) },
  });
  const runtime = createRuntime({ plugins: [plugin] });
  const stop = runtime.mount();
  await runtime.ready;
  const reader = observeRuntimeInventory(runtime);
  assert.equal(reader.get(), reader.get());
  let calls = 0;
  const off = reader.subscribe(() => calls++);
  const before = reader.get();
  const handle = scope.slots.attach('sample.tools', { component: () => null });
  assert.ok(calls);
  assert.notEqual(reader.get(), before);
  assert.equal(reader.get().live.slots[0].count, 1);
  assert.equal(reader.get().live.slots[0].plugin, 'sample');
  assert.equal(reader.get().live.slots[0].mountedOutlets, null);
  assert.equal(reader.get().live.slots[0].visibleCount, null);
  assert.equal(reader.get().live.slots[0].renderFailures, null);
  handle.dispose();
  assert.equal(reader.get().live.slots[0].count, 0);
  off();
  await stop();
});
