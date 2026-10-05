import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import { generateFoundation, describeFoundation } from '@bitakit/discovery';
// Internal module: the package exports only its public entry.
import { contributionKindSpecs } from '../../discovery/src/entries.mjs';
import {
  FoundationRuntime,
  PluginScope,
  scopeModule,
  scopePlugins,
  createActionList,
  defineAction,
  ActionGroup,
} from '../dist/core.js';

const coreRuntime = new URL('../dist/core.js', import.meta.url).pathname;

async function fixture(run) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'bitakit-kinds-')));
  const put = async (file, source) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
    return target;
  };
  try {
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('contributions install per module in dependency order before actions and setup; cleanup is owned', async () => {
  const events = [];
  const widgets = (values, { module, app, services }) => {
    events.push(`install ${module} ${app} ${values.join(',')} ${typeof services}`);
    return () => events.push(`cleanup ${module}`);
  };
  const list = createActionList();
  const unsubscribe = list.subscribe(() => {
    if (list.get('content.probe') && !events.includes('action registered'))
      events.push('action registered');
  });
  const runtime = new FoundationRuntime(list, {
    appId: 'app',
    dependencies: ['content'],
    contributions: { widgets: ['app-widget'] },
    setup: () => void events.push('app setup'),
    plugins: [
      {
        id: 'content',
        dependencies: ['widgets'],
        contributions: { widgets: ['a', 'b'] },
        actions: { probe: defineAction({ title: 'Probe', execute() {} }) },
        setup: () => void events.push('content setup'),
      },
      { id: 'widgets', installs: { widgets } },
    ],
  });
  assert.deepEqual(
    runtime.contributionsOf('widgets').map(({ module, app, values }) => [module, app, values]),
    [
      ['content', false, ['a', 'b']],
      ['app', true, ['app-widget']],
    ],
  );
  assert.equal(events.length, 0, 'contributionsOf is pure and does not install');
  const unmount = list.mount();
  const stop = runtime.mount();
  assert.deepEqual(events, [
    'install content false a,b object',
    'install app true app-widget object',
    'action registered',
    'content setup',
    'app setup',
  ]);
  events.length = 0;
  await stop();
  assert.deepEqual(
    events.filter((event) => event.startsWith('cleanup')),
    ['cleanup app', 'cleanup content'],
  );
  unmount();
  unsubscribe();
});

test('a kind without installer or with two installers is an actionable mount error', async () => {
  const missing = new FoundationRuntime(createActionList(), {
    plugins: [{ id: 'content', contributions: { widgets: [1] } }],
  });
  assert.throws(
    () => missing.mount(),
    /"content" contributes "widgets", but no enabled plugin installs/,
  );
  const twice = new FoundationRuntime(createActionList(), {
    plugins: [
      { id: 'one', installs: { widgets: () => {} } },
      { id: 'two', installs: { widgets: () => {} } },
    ],
  });
  assert.throws(() => twice.mount(), /"widgets" is installed by both "one" and "two"/);
  const empty = new FoundationRuntime(createActionList(), {
    plugins: [{ id: 'content', contributions: { widgets: [] } }],
  });
  empty.mount()();
});

test('runtime-issued scopes identify their module; foreign scopes are rejected', async () => {
  const seen = [];
  const runtime = new FoundationRuntime(createActionList(), {
    appId: 'app',
    setup: ({ app }) => void seen.push(scopeModule(app)),
    plugins: [{ id: 'content', setup: ({ app }) => void seen.push(scopeModule(app)) }],
  });
  runtime.mount()();
  assert.deepEqual(seen, [
    { id: 'app', app: true },
    { id: 'content', app: false },
  ]);
  assert.throws(
    () => scopeModule(new PluginScope(createActionList(), new Map([['x', new ActionGroup('x')]]))),
    /Unknown plugin scope/,
  );
});

test('runtime-issued scopes list the composed plugins by ID and metadata, without the app', async () => {
  const seen = [];
  const runtime = new FoundationRuntime(createActionList(), {
    appId: 'app',
    setup: ({ app }) => void seen.push(scopePlugins(app)),
    plugins: [
      { id: 'notes', metadata: { name: 'Notes' }, services: {} },
      {
        id: 'reports',
        dependencies: ['notes'],
        setup: ({ app }) => void seen.push(scopePlugins(app)),
      },
    ],
  });
  runtime.mount()();
  assert.deepEqual(seen[0], [
    { id: 'notes', metadata: { name: 'Notes' } },
    { id: 'reports', metadata: undefined },
  ]);
  assert.equal(seen[1], seen[0], 'every scope of one runtime shares the same frozen list');
  assert.ok(Object.isFrozen(seen[0]) && Object.isFrozen(seen[0][0]));
  assert.throws(
    () => scopePlugins(new PluginScope(createActionList(), new Map())),
    /Unknown plugin scope/,
  );
});

test('integration kinds are validated: names are unique and not built in, folders are relative and unique', async () => {
  const kind = {
    name: 'widgets',
    directory: './widgets/',
    from: 'x',
    normalize: 'discoverWidgets',
  };
  const [spec] = contributionKindSpecs([kind]);
  assert.deepEqual(spec, {
    name: 'widgets',
    directory: 'widgets',
    from: 'x',
    normalize: 'discoverWidgets',
    types: undefined,
  });
  assert.ok(Object.isFrozen(spec));
  assert.equal(
    contributionKindSpecs([
      { ...kind, name: 'settings.sections', directory: 'settings/sections' },
    ])[0].directory,
    'settings/sections',
  );
  assert.deepEqual(contributionKindSpecs(), []);
  assert.throws(() => contributionKindSpecs({}), /must be an array/);
  assert.throws(
    () => contributionKindSpecs([{ ...kind, name: 'actions' }]),
    /Contribution kind "actions" is built in/,
  );
  assert.throws(
    () => contributionKindSpecs([{ ...kind, name: 'Widgets' }]),
    /Invalid contribution kind name/,
  );
  assert.throws(
    () => contributionKindSpecs([kind, { ...kind, name: 'other' }]),
    /uses folder "widgets", already used by kind "widgets"/,
  );
  assert.throws(() => contributionKindSpecs([kind, kind]), /Duplicate contribution kind/);
  assert.throws(() => contributionKindSpecs([{ ...kind, directory: '../x' }]), /relative folder/);
  assert.throws(() => contributionKindSpecs([{ ...kind, directory: '' }]), /relative folder/);
  assert.throws(
    () => contributionKindSpecs([{ ...kind, from: ' ' }]),
    /module that exports its normalizer/,
  );
  assert.throws(
    () => contributionKindSpecs([{ ...kind, normalize: 'not valid' }]),
    /normalizer export/,
  );
});

test('discovery emits imports for integration kinds per module under contributions/<directory> without executing them', async () =>
  fixture(async (root, put) => {
    // One kind comes from an installed package's discovery export, the other from bitakit.config.ts.
    await put('package.json', JSON.stringify({ dependencies: { '@acme/widgets': '1.0.0' } }));
    await put(
      'node_modules/@acme/widgets/package.json',
      JSON.stringify({ name: '@acme/widgets', bitakit: { discovery: './discovery.mjs' } }),
    );
    await put(
      'node_modules/@acme/widgets/discovery.mjs',
      `export default () => [{
      name: 'widgets', directory: 'widgets', from: '@acme/widgets/normalizers.mjs', normalize: 'discoverWidgets',
      types: { entry: 'DiscoveredWidgetEntry', map: 'WidgetMap' },
    }];`,
    );
    await put(
      'node_modules/@acme/widgets/normalizers.mjs',
      `
      export const discoverWidgets = (files, moduleId) => files.map((file) => ({ moduleId, source: file.source, path: file.path, value: file.value }));
      export const discoverSections = (files, moduleId) => files.map((file) => \`\${moduleId}:\${file.value}\`);
    `,
    );
    await put(
      'bitakit.config.ts',
      `export default {
      kinds: [{ name: 'settings.sections', directory: 'sections', from: '@acme/widgets/normalizers.mjs', normalize: 'discoverSections' }],
      plugins: { overrides: { off: { enabled: false } } },
    };`,
    );
    await put('src/contributions/widgets/first.ts', 'export default "first"');
    await put('src/contributions/widgets/-draft.ts', 'export default "draft"');
    await put('src/contributions/widgets/helper.ts', 'export const helper = 1');
    await put('src/contributions/sections/general.ts', 'export default "general"');
    await put('src/widgets/elsewhere.ts', 'export default "legacy root folder"');
    await put('src/server/widgets/secret.ts', 'export default "secret"');
    await put('src/plugins/content/contributions/widgets/second.tsx', 'export default "second"');
    await put(
      'src/plugins/content/contributions/widgets/nested/third.ts',
      'export default "third"',
    );
    await put(
      'src/plugins/custom/plugin.config.ts',
      'export default { entries: { widgets: "components/widgets" } }',
    );
    await put('src/plugins/custom/components/widgets/fourth.ts', 'export default "fourth"');
    await put(
      'src/plugins/custom/contributions/widgets/ignored.ts',
      'export default "ignored by the explicit entry"',
    );
    await put('src/plugins/off/contributions/widgets/disabled.ts', 'export default "disabled"');
    const never = await put(
      'src/plugins/content/contributions/widgets/never.ts',
      'throw new Error("must not execute during discovery"); export default "never"',
    );
    const first = await generateFoundation(root, { quiet: true });
    assert.deepEqual(first.warnings, [
      'src/contributions/widgets/helper.ts is in a widgets folder but has no default export, so it is ignored. Export the contribution as default, or prefix the file name with "-" for helpers.',
      'src/widgets/elsewhere.ts: move it under contributions/widgets/; the old location is deprecated (run "bitakit migrate").',
    ]);
    await rm(never);
    const { generated } = await generateFoundation(root, { quiet: true });
    const source = await readFile(generated, 'utf8');
    assert.doesNotMatch(source, /draft|secret|helper|disabled|ignored|never/);
    assert.match(
      source,
      /import \{ discoverWidgets as normalize0 \} from '@acme\/widgets\/normalizers\.mjs';/,
    );
    assert.match(
      source,
      /import \{ discoverSections as normalize1 \} from '@acme\/widgets\/normalizers\.mjs';/,
    );
    assert.match(
      source,
      /import type \{ DiscoveredWidgetEntry as KindEntry0 \} from '@acme\/widgets\/normalizers\.mjs';/,
    );
    assert.match(
      source,
      /type KindMap0 = KindEntry0<typeof file\d+, "app"> & KindEntry0<typeof file\d+, "app"> & KindEntry0<typeof file\d+, "content"> & KindEntry0<typeof file\d+, "content"> & KindEntry0<typeof file\d+, "custom">;/,
    );
    assert.match(
      source,
      /declare module '@acme\/widgets\/normalizers\.mjs' \{ interface WidgetMap extends KindMap0 \{\} \}/,
    );
    assert.match(
      source,
      /contributions: \{ "widgets": normalize0\(\[file\d+, file\d+\], "app"\), "settings\.sections": normalize1\(\[file\d+\], "app"\) \}/,
    );
    const { createBitaKitConfig } = await createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': coreRuntime },
    }).import(generated);
    const config = createBitaKitConfig();
    assert.deepEqual(config.contributions.widgets, [
      {
        moduleId: 'app',
        source: 'src/contributions/widgets/first.ts',
        path: 'first',
        value: 'first',
      },
      {
        moduleId: 'app',
        source: 'src/widgets/elsewhere.ts',
        path: 'elsewhere',
        value: 'legacy root folder',
      },
    ]);
    assert.deepEqual(config.contributions['settings.sections'], ['app:general']);
    const byId = Object.fromEntries(config.plugins.map((plugin) => [plugin.id, plugin]));
    assert.deepEqual(
      byId.content.contributions.widgets.map((widget) => [widget.path, widget.value]),
      [
        ['nested.third', 'third'],
        ['second', 'second'],
      ],
    );
    assert.deepEqual(
      byId.custom.contributions.widgets.map((widget) => widget.value),
      ['fourth'],
    );
    assert.deepEqual(byId.custom.contributions['settings.sections'], undefined);
    assert.equal(byId.off, undefined);
    const installed = [];
    const runtime = new FoundationRuntime(createActionList(), {
      ...config,
      plugins: [
        ...config.plugins,
        {
          id: 'widget-host',
          installs: {
            widgets: (values, { module }) =>
              void installed.push(['widgets', module, values.length]),
            'settings.sections': (values, { module }) =>
              void installed.push(['sections', module, values]),
          },
        },
      ],
    });
    runtime.mount()();
    assert.deepEqual(installed.sort(), [
      ['sections', 'app', ['app:general']],
      ['widgets', 'app', 2],
      ['widgets', 'content', 2],
      ['widgets', 'custom', 1],
    ]);
    assert.deepEqual((await describeFoundation(root)).installedPackages, ['@acme/widgets']);

    await put(
      'src/plugins/custom/plugin.config.ts',
      'export default { entries: { widgets: "../outside" } }',
    );
    await assert.rejects(
      generateFoundation(root, { quiet: true }),
      /Entry "widgets" of plugin "custom" points outside the plugin/,
    );
    await put(
      'src/plugins/custom/plugin.config.ts',
      'export default { entries: { widgets: "missing/folder" } }',
    );
    await assert.rejects(
      generateFoundation(root, { quiet: true }),
      /Plugin "custom" names a missing entry for "widgets"/,
    );
    await put(
      'src/plugins/custom/plugin.config.ts',
      'export default { entries: { widgets: false } }',
    );
    const without = await createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': coreRuntime },
    }).import((await generateFoundation(root, { quiet: true })).generated);
    assert.deepEqual(
      without.createBitaKitConfig().plugins.find((plugin) => plugin.id === 'custom').contributions,
      {},
    );
    // bitakit.config.ts may redefine a package kind by name, for example to move its folder.
    await put(
      'bitakit.config.ts',
      `export default { kinds: [{ name: 'widgets', directory: 'other', from: 'app-normalizers', normalize: 'discoverWidgets' }] };`,
    );
    await put('src/contributions/other/alpha.ts', 'export default "alpha"');
    const redefined = await readFile(
      (await generateFoundation(root, { quiet: true })).generated,
      'utf8',
    );
    assert.match(redefined, /import \{ discoverWidgets as normalize0 \} from 'app-normalizers';/);
    assert.match(redefined, /contributions: \{ "widgets": normalize0\(\[file\d+\], "app"\) \}/);
    assert.doesNotMatch(redefined, /@acme\/widgets|contributions\/widgets\/first/);
    await put(
      'bitakit.config.ts',
      `export default { kinds: [{ name: 'widgets', directory: 'a', from: 'x', normalize: 'discoverWidgets' }, { name: 'widgets', directory: 'b', from: 'x', normalize: 'discoverWidgets' }] };`,
    );
    await assert.rejects(
      generateFoundation(root, { quiet: true }),
      /Duplicate contribution kind "widgets"/,
    );
  }));

test('owned slot definitions reserve a built-in kind and respect module entry selection', async () => {
  assert.throws(() => contributionKindSpecs([{ name: 'slotDefinitions', directory: 'slots', from: 'x', normalize: 'x' }]), /Invalid contribution kind name|built in/);
  await fixture(async (root, put) => {
    await put('src/plugins/shell/plugin.config.ts', `export default { entries: { slotDefinitions: 'extension-points' } };`);
    await put('src/plugins/shell/extension-points/logo.ts', `import { defineSlot } from '@bitakit/core'; export default defineSlot({ accepts: 'component', policy: 'single' });`);
    await put('src/plugins/shell/slots/ignored.ts', `throw new Error('overridden folder must not load'); export default {};`);
    const result = await generateFoundation(root, { quiet: true });
    const generated = await createJiti(import.meta.url, { moduleCache: false, alias: { '@bitakit/core': coreRuntime } }).import(result.generated);
    const runtime = new FoundationRuntime(createActionList(), generated.createBitaKitConfig());
    assert.deepEqual(runtime.modules[1].slots.map((slot) => slot.id), ['shell.logo']);
    const description = await describeFoundation(root);
    assert.deepEqual(description.slotDeclarations.map((slot) => slot.id), ['shell.logo']);
    await put('src/plugins/shell/plugin.config.ts', `export default { entries: { slotDefinitions: false } };`);
    assert.deepEqual((await describeFoundation(root)).slotDeclarations, []);
  });
});
