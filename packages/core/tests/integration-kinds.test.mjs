import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import { generateFoundation } from '../discovery/generate.mjs';
import { contributionKindSpecs } from '../discovery/entries.mjs';
import {
  FoundationRuntime,
  PluginScope,
  scopeModule,
  createActionList,
  Action,
  ActionGroup,
} from '../dist/core.js';

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'foundation-kinds-'));
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

test('contributions install per module in dependency order before actions and setup; cleanup is owned', () => {
  const events = [];
  const widgets = (values, { module, app, services }) => {
    events.push(`install ${module} ${app} ${values.join(',')} ${typeof services}`);
    return () => events.push(`cleanup ${module}`);
  };
  class Probe extends Action {
    connect() {
      events.push('action connect');
      return () => {};
    }
    execute() {}
  }
  const list = createActionList();
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
        actions: [{ kind: 'native', id: 'probe', load: () => new Probe({ title: 'Probe' }) }],
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
  assert.deepEqual(events.slice(0, 2), [
    'install content false a,b object',
    'install app true app-widget object',
  ]);
  assert.ok(events.indexOf('action connect') > 1);
  assert.ok(events.indexOf('content setup') > events.indexOf('action connect'));
  events.length = 0;
  stop();
  assert.deepEqual(
    events.filter((event) => event.startsWith('cleanup')),
    ['cleanup app', 'cleanup content'],
  );
  unmount();
});

test('a kind without installer or with two installers is an actionable mount error', () => {
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

test('runtime-issued scopes identify their module; foreign scopes are rejected', () => {
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

test('integration kinds are validated and cannot collide with built-in or other folders', () => {
  const kind = { name: 'widgets', directory: 'widgets', from: 'x', normalize: 'discoverWidgets' };
  assert.equal(contributionKindSpecs([kind])[0].directory, 'widgets');
  assert.throws(
    () => contributionKindSpecs([{ ...kind, directory: 'actions' }]),
    /already used by built-in kind "actions"/,
  );
  assert.throws(
    () => contributionKindSpecs([kind, { ...kind, name: 'other' }]),
    /already used by kind "widgets"/,
  );
  assert.throws(() => contributionKindSpecs([kind, kind]), /Duplicate contribution kind/);
  assert.throws(() => contributionKindSpecs([{ ...kind, directory: '../x' }]), /relative folder/);
  assert.throws(
    () => contributionKindSpecs([{ ...kind, normalize: 'not valid' }]),
    /normalizer export/,
  );
});

test('discovery emits imports for integration kinds per module without executing them', async () =>
  fixture(async (root, put) => {
    const normalizer = await put(
      'normalizers.mjs',
      'export const discoverWidgets = (files, moduleId) => files.map((file) => ({ moduleId, source: file.source, path: file.path, value: file.value }));',
    );
    await put(
      'foundation.config.ts',
      `export default { kinds: [{ name: 'widgets', directory: 'ui/widgets', from: ${JSON.stringify(normalizer)}, normalize: 'discoverWidgets' }], plugins: { directory: './src/plugins', overrides: { off: { enabled: false } } } }`,
    );
    await put('src/plugin.config.ts', 'export default { id: "app" }');
    await put('src/ui/widgets/first.ts', 'export default "first"');
    await put('src/ui/widgets/-draft.ts', 'export default "draft"');
    await put('src/ui/widgets/server/secret.ts', 'export default "secret"');
    await put('src/ui/widgets/helper.ts', 'export const helper = 1');
    await put('src/widgets/elsewhere.ts', 'export default "wrong folder"');
    await put('src/plugins/content/plugin.config.ts', 'export default { id: "content" }');
    await put('src/plugins/content/ui/widgets/second.tsx', 'export default "second"');
    await put(
      'src/plugins/custom/plugin.config.ts',
      'export default { id: "custom", entries: { widgets: "components/widgets" } }',
    );
    await put('src/plugins/custom/components/widgets/third.ts', 'export default "third"');
    await put('src/plugins/off/plugin.config.ts', 'export default { id: "off" }');
    await put('src/plugins/off/ui/widgets/disabled.ts', 'export default "disabled"');
    const never = await put(
      'src/plugins/content/ui/widgets/never.ts',
      'throw new Error("must not execute during discovery"); export default "never"',
    );
    await generateFoundation(root);
    await rm(never);
    await generateFoundation(root);
    const output = path.join(root, '.foundation/plugins.ts');
    const source = await readFile(output, 'utf8');
    assert.doesNotMatch(source, /draft|secret|helper|elsewhere|disabled/);
    const jiti = createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': new URL('../dist/core.js', import.meta.url).pathname },
    });
    const { foundationConfig } = await jiti.import(output);
    assert.deepEqual(foundationConfig.contributions.widgets, [
      { moduleId: 'app', source: 'ui/widgets/first.ts', path: 'first', value: 'first' },
    ]);
    const byId = Object.fromEntries(foundationConfig.plugins.map((plugin) => [plugin.id, plugin]));
    assert.equal(byId.content.contributions.widgets[0].value, 'second');
    assert.equal(byId.custom.contributions.widgets[0].value, 'third');
    assert.equal(byId.off, undefined);
    const installed = [];
    const runtime = new FoundationRuntime(createActionList(), {
      ...foundationConfig,
      plugins: [
        ...foundationConfig.plugins,
        {
          id: 'widget-host',
          installs: {
            widgets: (values, { module }) => void installed.push([module, values.length]),
          },
        },
      ],
    });
    runtime.mount()();
    assert.deepEqual(installed.sort(), [
      ['app', 1],
      ['content', 1],
      ['custom', 1],
    ]);
  }));
