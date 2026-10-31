import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  defineService,
  defineAction,
  defineSettings,
  setting,
  defineEvents,
  event,
  defineSlot,
  scopeModules,
  inspectRuntime,
  createMemorySettingsStorage,
  settingsStorage,
  defineContract,
} from '../dist/core.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const tick = () => new Promise((done) => setTimeout(done, 0));
const servicePlugin = (id, requires = [], hooks = {}) =>
  definePlugin({
    id,
    services: {
      state: defineService(
        ({ store, onStart, onStop }) => {
          if (hooks.start) onStart(hooks.start);
          if (hooks.stop) onStop(hooks.stop);
          return store(0);
        },
        { requires },
      ),
    },
  });

async function host(t, plugins = []) {
  const runtime = createRuntime({
    plugins,
    slots: { toolbar: defineSlot({ accepts: 'actions' }) },
  });
  const stop = runtime.mount();
  await runtime.ready;
  t.after(() => stop().catch(() => {}));
  return runtime;
}

test('adds a complete plugin and removes its owned contributions without replacing unrelated state', async (t) => {
  const runtime = await host(t, [servicePlugin('keeper')]);
  const keeper = runtime.services.keeper.state;
  keeper.set(7);
  const plugin = definePlugin({
    id: 'notes',
    services: { state: defineService(({ store }) => store('draft')) },
    actions: {
      create: defineAction({
        title: 'Create',
        slots: ['toolbar'],
        execute: ({ services, settings }) => [
          services.notes.state.get(),
          settings.notes.count.get(),
        ],
      }),
    },
    settings: defineSettings({ count: setting({ default: 10 }) }),
    events: defineEvents({ changed: event() }),
    slots: { footer: defineSlot({ accepts: 'data' }) },
    ui: { pages: [{ path: '/notes', component: () => null }] },
  });
  assert.equal((await runtime.plugins.add([plugin])).status, 'applied');
  await tick();
  assert.equal(runtime.services.keeper.state, keeper);
  assert.equal(keeper.get(), 7);
  assert.deepEqual((await runtime.actions.execute('notes.create')).value, ['draft', 10]);
  assert.equal(runtime.settingsAccess.notes.count.get(), 10);
  assert.equal(runtime.slots.get('toolbar').items.length, 1);
  assert.equal(runtime.slots.has('notes.footer'), true);
  assert.equal(runtime.events.ownerOf('notes.changed'), 'notes');
  assert.equal(
    (await runtime.plugins.remove(['notes'], { dependents: 'refuse' })).status,
    'applied',
  );
  assert.equal(runtime.services.keeper.state, keeper);
  assert.equal(runtime.actions.get('notes.create'), undefined);
  assert.equal(runtime.slots.get('toolbar').items.length, 0);
  assert.equal(runtime.slots.has('notes.footer'), false);
  assert.equal(runtime.settings.has('notes.count'), false);
  assert.equal(runtime.events.ownerOf('notes.changed'), undefined);
  assert.equal(
    runtime.modules.some((module) => module.id === 'notes'),
    false,
  );
  assert.equal((await runtime.plugins.add([plugin])).status, 'applied');
});

test('disable refuses active dependents or stops them; enable requires providers first', async (t) => {
  const log = [];
  const runtime = await host(t, [
    servicePlugin('source', [], { stop: () => log.push('source') }),
    servicePlugin('consumer', ['source.state'], { stop: () => log.push('consumer') }),
    servicePlugin('keeper'),
  ]);
  const keeper = runtime.services.keeper.state;
  assert.equal(
    (await runtime.plugins.disable('source', { dependents: 'refuse' })).status,
    'blocked',
  );
  assert.equal(runtime.isReady('source'), true);
  assert.equal((await runtime.plugins.disable('source', { dependents: 'stop' })).status, 'applied');
  assert.deepEqual(log, ['consumer', 'source']);
  assert.equal(
    runtime.lifecycle.get().plugins.find((entry) => entry.id === 'consumer').enabled,
    false,
  );
  assert.equal((await runtime.plugins.enable('consumer')).status, 'blocked');
  assert.equal((await runtime.plugins.enable('source')).status, 'applied');
  assert.equal(runtime.isReady('consumer'), false);
  assert.equal((await runtime.plugins.enable('consumer')).status, 'applied');
  assert.equal(runtime.services.keeper.state, keeper);
  assert.equal((await runtime.plugins.enable('consumer')).changed.length, 0);
});

test('preflight rejects conflicts and missing services without stopping current plugins', async (t) => {
  const runtime = await host(t, [servicePlugin('keeper')]);
  const keeper = runtime.services.keeper.state;
  assert.equal((await runtime.plugins.add([servicePlugin('keeper')])).status, 'blocked');
  assert.equal(
    (await runtime.plugins.add([servicePlugin('broken', ['missing'])])).status,
    'blocked',
  );
  assert.equal(
    (
      await runtime.plugins.add([
        definePlugin({ id: 'runtime', events: defineEvents({ changed: event() }) }),
      ])
    ).status,
    'blocked',
  );
  assert.equal(runtime.services.keeper.state, keeper);
  assert.equal(runtime.getRevision(), 0);
});

test('a package adds its provider and dependent together regardless of input order', async (t) => {
  const runtime = await host(t);
  assert.equal(
    (
      await runtime.plugins.add([
        servicePlugin('consumer', ['provider.state']),
        servicePlugin('provider'),
      ])
    ).status,
    'applied',
  );
  assert.equal(runtime.isReady('consumer'), true);
  assert.equal(
    (await runtime.plugins.remove(['consumer', 'provider'], { dependents: 'refuse' })).status,
    'applied',
  );
});

test('clean startup failure can be retried explicitly without rolling back or duplicating actions', async (t) => {
  let fail = true;
  const runtime = await host(t, [servicePlugin('keeper')]);
  const broken = servicePlugin('broken', [], {
    start: () => {
      if (fail) throw new Error('start failed');
    },
  });
  assert.equal((await runtime.plugins.add([broken])).status, 'failed');
  assert.equal(runtime.isReady('keeper'), true);
  fail = false;
  assert.equal((await runtime.plugins.enable('broken')).status, 'applied');
  assert.equal(runtime.isReady('broken'), true);
});

test('failed cleanup blocks reuse and replacement', async (t) => {
  const runtime = await host(t, [
    servicePlugin('broken', [], {
      stop: () => {
        throw new Error('cleanup failed');
      },
    }),
  ]);
  assert.equal(
    (await runtime.plugins.disable('broken', { dependents: 'refuse' })).status,
    'failed',
  );
  assert.equal((await runtime.plugins.add([servicePlugin('other')])).status, 'blocked');
  await assert.rejects(runtime.stop());
});

test('overlap and nested startup changes are blocked, and shutdown cancels an in-flight addition', async (t) => {
  const gate = deferred();
  let nested;
  const runtime = await host(t);
  const plugin = servicePlugin('slow', [], {
    start: async () => {
      nested = await runtime.plugins.add([servicePlugin('nested')]);
      await gate.promise;
    },
  });
  const addition = runtime.plugins.add([plugin]);
  await tick();
  assert.equal(nested.status, 'blocked');
  assert.equal((await runtime.plugins.add([servicePlugin('other')])).status, 'blocked');
  const stopping = runtime.stop();
  gate.resolve();
  assert.equal((await addition).status, 'blocked');
  await stopping;
  assert.equal(runtime.isReady(), false);
});

test('composition readers refresh after additions and removals', async (t) => {
  const seen = [];
  const projection = definePlugin({
    id: 'projection',
    setup: ({ scope }) => {
      seen.push(scopeModules(scope).map((module) => module.id));
    },
  });
  const runtime = await host(t, [projection]);
  assert.equal((await runtime.plugins.add([servicePlugin('notes')])).status, 'applied');
  assert.ok(seen.at(-1).includes('notes'));
  assert.equal(
    (await runtime.plugins.remove(['notes'], { dependents: 'refuse' })).status,
    'applied',
  );
  assert.equal(seen.at(-1).includes('notes'), false);
});

test('waiting slot contributions survive disabling and enabling their owner', async (t) => {
  let attachment;
  const owner = definePlugin({
    id: 'owner',
    slots: { extra: defineSlot({ accepts: 'component' }) },
  });
  const contributor = definePlugin({
    id: 'contributor',
    setup: ({ scope }) => {
      attachment = scope.slots.attach(
        { slot: 'owner.extra', id: 'widget', component: () => null },
        { availability: 'wait' },
      );
    },
  });
  const runtime = await host(t, [owner, contributor]);
  assert.equal(attachment.get().phase, 'attached');
  assert.equal(
    (await runtime.plugins.disable('owner', { dependents: 'refuse' })).status,
    'applied',
  );
  assert.equal(attachment.get().phase, 'pending');
  assert.equal((await runtime.plugins.enable('owner')).status, 'applied');
  assert.equal(attachment.get().phase, 'attached');
  assert.equal(
    (await runtime.plugins.remove(['owner'], { dependents: 'refuse' })).status,
    'blocked',
  );
  assert.equal((await runtime.plugins.remove(['owner'], { dependents: 'stop' })).status, 'applied');
  assert.equal(runtime.isReady('contributor'), false);
});

test('retained service and setting namespace handles see newly added declarations', async (t) => {
  const runtime = await host(t, [servicePlugin('keeper')]);
  const services = runtime.services;
  const settings = runtime.settingsAccess;
  const notes = definePlugin({
    ...servicePlugin('notes'),
    settings: defineSettings({ count: setting({ default: 3 }) }),
  });
  assert.equal((await runtime.plugins.add([notes])).status, 'applied');
  assert.equal(services.notes.state.get(), 0);
  assert.equal(settings.notes.count.get(), 3);
  assert.equal(
    (await runtime.plugins.disable('notes', { dependents: 'refuse' })).status,
    'applied',
  );
  assert.equal(settings.notes.count.get(), 3);
});

test('removal waits for affected action work, and exposes no removed actions during cleanup', async (t) => {
  const done = deferred();
  let signal;
  const runtime = await host(t, [
    definePlugin({
      id: 'notes',
      actions: {
        run: defineAction({
          execute: async (context) => {
            signal = context.signal;
            await done.promise;
          },
        }),
      },
    }),
  ]);
  const run = runtime.actions.execute('notes.run');
  await tick();
  const removal = runtime.plugins.remove(['notes'], { dependents: 'refuse' });
  await tick();
  assert.equal(signal.aborted, true);
  assert.equal(runtime.actions.get('notes.run'), undefined);
  done.resolve();
  await run;
  assert.equal((await removal).status, 'applied');
});

test('inventory distinguishes disabled installations from removed plugins', async (t) => {
  const runtime = await host(t, [servicePlugin('notes')]);
  await runtime.plugins.disable('notes', { dependents: 'refuse' });
  const plugin = inspectRuntime(runtime).static.plugins.find((entry) => entry.id === 'notes');
  assert.equal(plugin.enabled, false);
  assert.equal(
    runtime.lifecycle.get().plugins.find((entry) => entry.id === 'notes').phase,
    'stopped',
  );
  await runtime.plugins.remove(['notes'], { dependents: 'refuse' });
  assert.equal(
    inspectRuntime(runtime).static.plugins.some((entry) => entry.id === 'notes'),
    false,
  );
});

test('required service aliases order activation and prevent unsafe provider removal', async (t) => {
  const contract = defineContract('documents').of();
  const provider = definePlugin({
    id: 'notes',
    services: { data: defineService(() => ({ title: 'Notes' }), { provides: contract }) },
  });
  const consumer = definePlugin({
    id: 'reader',
    services: {
      data: defineService(({ services }) => services.documents.title, { requires: ['documents'] }),
    },
  });
  const runtime = await host(t);
  assert.equal((await runtime.plugins.add([consumer, provider])).status, 'applied');
  assert.equal(runtime.services.reader.data, 'Notes');
  assert.equal(
    (await runtime.plugins.disable('notes', { dependents: 'refuse' })).status,
    'blocked',
  );
  assert.equal((await runtime.plugins.disable('notes', { dependents: 'stop' })).status, 'applied');
  assert.equal(runtime.isReady('reader'), false);
});

test('removal refuses in-flight setting writes and ignores late loads from a previous installation', async (t) => {
  const memory = createMemorySettingsStorage();
  const writing = deferred();
  const lateRead = deferred();
  let slowRead = false;
  const storage = {
    ...memory,
    load: (...args) => (slowRead ? lateRead.promise : memory.load(...args)),
    save: async (...args) => {
      await writing.promise;
      return memory.save(...args);
    },
  };
  const persistence = definePlugin({
    id: 'persistence',
    services: { data: defineService(() => storage, { provides: settingsStorage }) },
  });
  const notes = definePlugin({
    id: 'notes',
    settings: defineSettings({ count: setting({ default: 3 }) }),
  });
  const runtime = await host(t, [persistence, notes]);
  await tick();
  const saving = runtime.settings.set('notes.count', 12);
  assert.equal(
    (await runtime.plugins.remove(['notes'], { dependents: 'refuse' })).status,
    'blocked',
  );
  writing.resolve();
  await saving;
  await runtime.plugins.remove(['notes'], { dependents: 'refuse' });
  slowRead = true;
  await runtime.plugins.add([notes]);
  await runtime.plugins.remove(['notes'], { dependents: 'refuse' });
  slowRead = false;
  await runtime.plugins.add([notes]);
  await tick();
  lateRead.resolve({ value: 99, writable: true });
  await tick();
  assert.equal(runtime.settings.get('notes.count'), 12);
});

test('a setting write started during awaited removal cleanup retains its declaration until retry', async (t) => {
  const memory = createMemorySettingsStorage();
  const actionGate = deferred();
  const writeGate = deferred();
  const persistence = definePlugin({
    id: 'persistence',
    services: {
      data: defineService(
        () => ({
          ...memory,
          save: async (...args) => {
            await writeGate.promise;
            return memory.save(...args);
          },
        }),
        { provides: settingsStorage },
      ),
    },
  });
  const notes = definePlugin({
    id: 'notes',
    settings: defineSettings({ count: setting({ default: 3 }) }),
    actions: { wait: defineAction({ execute: () => actionGate.promise }) },
  });
  const projection = definePlugin({
    id: 'projection',
    setup: ({ scope }) => {
      scopeModules(scope);
    },
  });
  const runtime = await host(t, [persistence, projection, notes]);
  await tick();
  const action = runtime.actions.execute('notes.wait');
  const removing = runtime.plugins.remove(['notes'], { dependents: 'refuse' });
  await tick();
  const writing = runtime.settings.set('notes.count', 55);
  actionGate.resolve();
  await action;
  const result = await removing;
  assert.equal(result.status, 'blocked');
  assert.match(result.reasons[0], /during cleanup/);
  assert.equal(runtime.isReady('projection'), false);
  assert.equal(runtime.settings.has('notes.count'), true);
  assert.equal(runtime.isReady('notes'), false);
  writeGate.resolve();
  await writing;
  assert.equal(
    (await runtime.plugins.remove(['notes'], { dependents: 'refuse' })).status,
    'applied',
  );
  assert.equal(runtime.settings.has('notes.count'), false);
});

test('retry restores composition readers whose scopes were disposed by the failed activation', async (t) => {
  let fail = true;
  let projections = 0;
  const projection = definePlugin({
    id: 'projection',
    setup: ({ scope }) => {
      scopeModules(scope);
      projections++;
    },
  });
  const runtime = await host(t, [projection]);
  const notes = servicePlugin('notes', [], {
    start: () => {
      if (fail) throw new Error('start');
    },
  });
  assert.equal((await runtime.plugins.add([notes])).status, 'failed');
  assert.equal(runtime.isReady('projection'), false);
  fail = false;
  assert.equal((await runtime.plugins.enable('notes')).status, 'applied');
  assert.equal(runtime.isReady('projection'), true);
  assert.equal(projections, 3);
});

/** A plugin owned by `parent`, recording its start and stop. */
const childPlugin = (id, parent, log) =>
  definePlugin({
    id,
    ...(parent ? { parent } : {}),
    services: {
      state: defineService(({ store, onStart, onStop }) => {
        onStart(() => log.push(`start ${id}`));
        onStop(() => log.push(`stop ${id}`));
        return store(0);
      }),
    },
  });

test('a parent starts before its children and a missing parent is named at startup', async (t) => {
  const log = [];
  // Installed child-first on purpose: ownership decides the order.
  await host(t, [
    childPlugin('crm-deals-notes', 'crm-deals', log),
    childPlugin('crm-deals', 'crm', log),
    childPlugin('crm', undefined, log),
  ]);
  assert.deepEqual(log, ['start crm', 'start crm-deals', 'start crm-deals-notes']);
  assert.throws(
    () => createRuntime({ plugins: [childPlugin('contacts', 'crm', [])] }),
    /Plugin "contacts" belongs to "crm", which is not installed or is disabled/,
  );
});

test('disabling a parent stops every descendant even with refuse; a child alone leaves the parent', async (t) => {
  const log = [];
  const runtime = await host(t, [
    childPlugin('crm', undefined, log),
    childPlugin('deals', 'crm', log),
    childPlugin('notes', 'deals', log),
    childPlugin('reports', 'crm', log),
    servicePlugin('keeper'),
  ]);
  log.length = 0;
  assert.equal(
    (await runtime.plugins.disable('notes', { dependents: 'refuse' })).status,
    'applied',
  );
  assert.deepEqual(log, ['stop notes']);
  assert.equal(runtime.isReady('crm') && runtime.isReady('deals'), true);
  log.length = 0;
  // Owned descendants follow their parent; they are not "dependents" the policy can refuse.
  const disabled = await runtime.plugins.disable('crm', { dependents: 'refuse' });
  assert.equal(disabled.status, 'applied');
  assert.deepEqual([...disabled.changed].sort(), ['crm', 'deals', 'reports']);
  assert.deepEqual(log.slice(-1), ['stop crm'], 'children stop before their parent');
  assert.equal(runtime.isReady('keeper'), true);
  // A child cannot run without its parent.
  const refused = await runtime.plugins.enable('reports');
  assert.equal(refused.status, 'blocked');
  assert.match(refused.reasons[0], /belongs to "crm", which is disabled/);
  // Enabling the parent restores what its disable switched off, not the child disabled on its own.
  assert.equal((await runtime.plugins.enable('crm')).status, 'applied');
  assert.deepEqual(
    ['crm', 'deals', 'reports', 'notes'].map((id) => runtime.isReady(id)),
    [true, true, true, false],
  );
});

test('an external dependent of a child follows the policy; removing a parent removes its subtree', async (t) => {
  const runtime = await host(t, [
    childPlugin('crm', undefined, []),
    childPlugin('deals', 'crm', []),
    servicePlugin('dashboard', ['deals.state']),
  ]);
  const blocked = await runtime.plugins.remove(['crm'], { dependents: 'refuse' });
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.reasons[0], /dashboard/);
  assert.equal((await runtime.plugins.remove(['crm'], { dependents: 'stop' })).status, 'applied');
  assert.deepEqual(
    runtime.modules.map((module) => module.id).filter((id) => id !== 'app'),
    [],
    'crm and deals are uninstalled; dashboard is stopped',
  );
  assert.equal(
    runtime.lifecycle.get().plugins.some((entry) => entry.id === 'deals'),
    false,
  );
});

test('toggle preview is pure and shares dependency, protection and revision guards with execution', async (t) => {
  const stops = [];
  const runtime = await host(t, [
    servicePlugin('source', [], { stop: () => stops.push('source') }),
    servicePlugin('consumer', ['source.state']),
  ]);
  const request = { operation: 'disable', id: 'source', dependents: 'stop', expectedRevision: 0 };
  const preview = runtime.plugins.preview(request);
  assert.equal(preview.status, 'ready');
  assert.deepEqual(preview.dependents, ['consumer']);
  assert.deepEqual(stops, []);
  assert.equal(runtime.isReady('source'), true);
  assert.equal(runtime.getRevision(), 0);
  assert.equal(runtime.plugins.preview({ ...request, dependents: 'refuse' }).reason, 'dependents');
  assert.equal(runtime.plugins.preview({ ...request, preserve: ['consumer'] }).reason, 'protected');
  assert.equal(
    (await runtime.plugins.disable('source', { ...request, preserve: ['consumer'] })).status,
    'blocked',
  );
  const result = await runtime.plugins.disable('source', request);
  assert.deepEqual(result.changed, preview.changed);
  assert.deepEqual(result.affected, preview.affected);
  assert.deepEqual(stops, ['source']);
  assert.equal(
    runtime.plugins.preview({ operation: 'enable', id: 'source', expectedRevision: 0 }).reason,
    'stale',
  );
  assert.equal((await runtime.plugins.enable('source', { expectedRevision: 0 })).status, 'blocked');
  assert.equal((await runtime.plugins.enable('source')).status, 'applied');
});

test('previewing an already disabled owned child does not change parent restoration intent', async (t) => {
  const runtime = await host(t, [
    childPlugin('parent', undefined, []),
    childPlugin('child', 'parent', []),
  ]);
  await runtime.plugins.disable('parent', { dependents: 'refuse' });
  assert.equal(
    runtime.plugins.preview({ operation: 'disable', id: 'child', dependents: 'stop' }).status,
    'ready',
  );
  await runtime.plugins.enable('parent');
  assert.equal(runtime.isReady('child'), true);
});

test(
  'host Action can await a structural change that restarts composition readers',
  { timeout: 2000 },
  async (t) => {
    const seen = [];
    const runtime = await host(t, [
      servicePlugin('notes'),
      definePlugin({
        id: 'projection',
        setup: ({ scope }) => {
          seen.push(scopeModules(scope).length);
        },
      }),
    ]);
    const release = runtime.bindHostAction(
      'host.toggle',
      defineAction({
        internal: true,
        execute: () => runtime.plugins.disable('notes', { dependents: 'stop' }),
      }),
    );
    const result = await runtime.actions.execute('host.toggle');
    assert.equal(result.status, 'completed');
    assert.equal(result.value.status, 'applied');
    assert.equal(runtime.isReady('projection'), true);
    assert.deepEqual(seen, [3, 2]);
    assert.equal(runtime.plugins.preview({ operation: 'enable', id: 'notes' }).status, 'ready');
    release();
    release();
    assert.equal(runtime.actions.get('host.toggle'), undefined);
    runtime.bindHostAction('host.toggle', defineAction({ execute: () => 1 }));
    assert.equal((await runtime.actions.execute('host.toggle')).value, 1);
  },
);

test('host Action requirements participate in structural planning until their binding is released', async (t) => {
  const runtime = await host(t, [servicePlugin('notes')]);
  const release = runtime.bindHostAction(
    'host.read',
    defineAction({
      requires: ['notes.state'],
      execute: ({ services }) => services.notes.state.get(),
    }),
  );
  assert.equal(
    runtime.plugins.preview({ operation: 'disable', id: 'notes', dependents: 'stop' }).status,
    'restart-required',
  );
  release();
  assert.equal(
    runtime.plugins.preview({ operation: 'disable', id: 'notes', dependents: 'stop' }).status,
    'ready',
  );
});

test('cohort replacement previews conflicts without stopping the active generation', async (t) => {
  const runtime = await host(t, [servicePlugin('keeper'), servicePlugin('remote')]);
  const previous = runtime.services.remote.state;
  const invalid = definePlugin({
    id: 'remote',
    services: { bad: defineService(() => ({}), { requires: ['missing.service'] }) },
  });
  const preview = runtime.plugins.preview({
    operation: 'replace',
    ids: ['remote'],
    plugins: [invalid],
  });
  assert.equal(preview.status, 'blocked');
  assert.equal(runtime.services.remote.state, previous);
  assert.equal((await runtime.plugins.replace(['remote'], [invalid])).status, 'blocked');
  assert.equal(runtime.services.remote.state, previous);
  const keeper = runtime.services.keeper.state;
  const replacement = servicePlugin('remote');
  assert.equal((await runtime.plugins.replace(['remote'], [replacement])).status, 'applied');
  assert.notEqual(runtime.services.remote.state, previous);
  assert.equal(runtime.services.keeper.state, keeper);
});

test('cohort replacement permits explicit membership changes and rejects outside owners or dependents', async (t) => {
  const runtime = await host(t, [servicePlugin('remote'), servicePlugin('keeper')]);
  assert.equal(
    (await runtime.plugins.replace(['remote'], [servicePlugin('keeper')])).status,
    'blocked',
  );
  assert.equal(
    (await runtime.plugins.replace(['remote'], [servicePlugin('new'), servicePlugin('second')]))
      .status,
    'applied',
  );
  assert.equal(runtime.isReady('remote'), false);
  assert.equal(runtime.isReady('new'), true);
  await runtime.plugins.add([definePlugin({ id: 'consumer', dependencies: ['new'] })]);
  assert.equal((await runtime.plugins.replace(['new'], [servicePlugin('new')])).status, 'blocked');
  assert.equal(
    (await runtime.plugins.replace(['new', 'consumer'], [servicePlugin('new')])).status,
    'applied',
  );
});

test('cohort replacement honors revisions and refuses incomplete parent ownership', async (t) => {
  const runtime = await host(t, [
    servicePlugin('parent'),
    definePlugin({ id: 'child', parent: 'parent' }),
  ]);
  assert.equal(
    (await runtime.plugins.replace(['parent'], [servicePlugin('parent')])).status,
    'blocked',
  );
  const preview = runtime.plugins.preview({
    operation: 'replace',
    ids: ['parent', 'child'],
    plugins: [],
  });
  await runtime.plugins.add([servicePlugin('other')]);
  assert.equal(
    (await runtime.plugins.replace(['parent', 'child'], [], { expectedRevision: preview.revision }))
      .status,
    'blocked',
  );
  assert.equal(runtime.isReady('parent'), true);
});
