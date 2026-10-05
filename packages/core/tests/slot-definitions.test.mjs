import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRuntime,
  definePlugin,
  defineSlot,
  discoverSlots,
  discoveredFile,
  FoundationStartupError,
  validate,
} from '../dist/core.js';

const slot = () => defineSlot({ accepts: 'component', policy: 'list' });
const ids = (runtime) =>
  runtime.modules.flatMap((module) =>
    module.slots.map(({ id, plugin, policy, conflict }) => ({ id, plugin, policy, conflict })),
  );

test('manual flat/nested slots and discovered records share owned immutable declarations', () => {
  const forms = [
    { 'header.actions': slot() },
    { header: { actions: slot() } },
    [defineSlot({ id: 'shell.header.actions', accepts: 'component' })],
    discoverSlots([discoveredFile(slot(), 'header.actions', 'slots/header/actions.ts')], 'shell'),
    discoverSlots([discoveredFile({ header: { actions: slot() } }, '', 'slots/index.ts')], 'shell'),
  ];
  for (const slots of forms) {
    const runtime = createRuntime({ plugins: [definePlugin({ id: 'shell', slots })] });
    assert.deepEqual(ids(runtime), [
      { id: 'shell.header.actions', plugin: 'shell', policy: 'list', conflict: 'error' },
    ]);
    assert.ok(Object.isFrozen(runtime.modules[1].slots));
    assert.ok(Object.isFrozen(runtime.modules[1].slots[0]));
    assert.equal(
      runtime.lifecycle.get().plugins.find((entry) => entry.id === 'shell').phase,
      'idle',
      'a declaration does not activate its owner',
    );
  }
});

test('app slots have plain IDs even with custom appId; explicit IDs remain absolute', () => {
  const runtime = createRuntime({
    appId: 'host',
    slots: { toolbar: slot() },
    plugins: [
      {
        id: 'shell',
        slots: { logo: defineSlot({ id: 'brand', accepts: 'component', policy: 'single' }) },
      },
    ],
  });
  assert.deepEqual(
    ids(runtime).map(({ id, plugin }) => [id, plugin]),
    [
      ['toolbar', 'host'],
      ['brand', 'shell'],
    ],
  );
  assert.throws(() => createRuntime({ slots: [slot()] }), /slot in an array needs an id/);
});

test('duplicate canonical paths and explicit IDs name the conflicting sources and owner', () => {
  const files = [
    discoveredFile({ header: { actions: slot() } }, '', 'slots/index.ts'),
    discoveredFile(slot(), 'header.actions', 'slots/header.actions.ts'),
  ];
  assert.throws(
    () => discoverSlots(files, 'shell'),
    (error) =>
      error instanceof FoundationStartupError &&
      error.plugin === 'shell' &&
      error.source === 'slots/header.actions.ts' &&
      /slots\/index.ts.*slots\/header.actions.ts/.test(error.message),
  );
  assert.throws(
    () =>
      discoverSlots(
        ['a', 'b'].map((path) =>
          discoveredFile(defineSlot({ id: 'same', accepts: 'actions' }), path, `${path}.ts`),
        ),
        'shell',
      ),
    /Duplicate slot "same".*a.ts.*b.ts/,
  );
  assert.throws(
    () =>
      createRuntime({
        slots: { same: slot() },
        plugins: [{ id: 'shell', slots: [defineSlot({ id: 'same', accepts: 'component' })] }],
      }),
    (error) => error.plugin === 'shell' && /Duplicate slot "same"/.test(error.message),
  );
  assert.throws(
    () =>
      createRuntime({
        plugins: [
          { id: 'shell', slots: { 'header.actions': slot(), header: { actions: slot() } } },
        ],
      }),
    /Duplicate contribution/,
  );
});

test('payload and data use existing schemas; Core retains contracts without interpreting UI', async () => {
  let parsed = 0;
  const schema = {
    parse: (value) => {
      parsed++;
      return { count: Number(value.count) };
    },
  };
  const definition = defineSlot({ accepts: 'data', schema, payload: schema, policy: 'keyed' });
  const runtime = createRuntime({
    slots: { totals: definition },
    ui: { slots: [{ slot: 'legacy', component: 'opaque' }] },
  });
  assert.equal(parsed, 0);
  assert.equal(runtime.modules[0].slots[0].schema, schema);
  assert.equal(runtime.modules[0].views[0].component, 'opaque');
  assert.deepEqual(await validate(definition.schema, { count: '2' }), { count: 2 });
  assert.equal(runtime.modules[0].slots[0].conflict, 'error');
});

test('malformed exports and invalid identifiers fail with source attribution', () => {
  assert.throws(
    () => discoverSlots([discoveredFile(() => slot(), 'header', 'slots/header.ts')], 'shell'),
    (error) => error.source === 'slots/header.ts' && error.plugin === 'shell',
  );
  assert.throws(
    () =>
      discoverSlots([
        discoveredFile(
          defineSlot({ id: 'bad id', accepts: 'actions' }),
          'header',
          'slots/header.ts',
        ),
      ]),
    /Invalid slot ID/,
  );
});
