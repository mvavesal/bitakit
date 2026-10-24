import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  actionFile,
  addContribution,
  addPlugin,
  findProject,
  packagePluginId,
  pluginFiles,
  sampleFiles,
} from '../src/index.mjs';
import { exists } from '../src/project.mjs';
import { link, nextApp, project } from './helpers.mjs';

const read = (root, file) => readFile(path.join(root, file), 'utf8');
const relative = (root, files) =>
  files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();

test('add plugin starts with one page and its navigation link', async (t) => {
  const root = await project(nextApp(), t);
  const result = await addPlugin('user-notes', { cwd: root });
  assert.equal(result.path, '/user-notes');
  assert.equal(result.navigation, true);
  assert.deepEqual(relative(root, result.created), [
    'src/plugins/user-notes/actions/open.ts',
    'src/plugins/user-notes/ui/pages/index.tsx',
  ]);
  const page = await read(root, 'src/plugins/user-notes/ui/pages/index.tsx');
  assert.match(page, /export default function UserNotesPage\(\)/);
  assert.match(page, /npx bitakit add service user-notes\/<name> \(starts as a counter store\)/);
  assert.match(
    await read(root, 'src/plugins/user-notes/actions/open.ts'),
    /href: '\/user-notes', groups: \['navigation'\], slots: \["shell\.navigation"\]/,
  );
});

test('add plugin --example writes a service, its events, actions, a navigation link and a page', async (t) => {
  const root = await project(nextApp(), t);
  const result = await addPlugin('user-notes', { cwd: root, example: true });
  assert.equal(result.path, '/user-notes');
  assert.equal(result.title, 'User notes');
  assert.deepEqual(relative(root, result.created), [
    'src/plugins/user-notes/actions/add.ts',
    'src/plugins/user-notes/actions/clear.ts',
    'src/plugins/user-notes/actions/open.ts',
    'src/plugins/user-notes/actions/remove.ts',
    'src/plugins/user-notes/events.ts',
    'src/plugins/user-notes/services/list.ts',
    'src/plugins/user-notes/ui/pages/index.tsx',
  ]);
  const file = (name) => read(root, `src/plugins/user-notes/${name}`);
  const service = await file('services/list.ts');
  assert.match(service, /export default defineService\(\(\{ store, events \}\) =>/);
  assert.match(service, /export type Entry = \{ id: number; title: string \};/);
  assert.match(service, /store<\{ entries: Entry\[\] \}>\(\{ entries: \[\] \}\)/);
  assert.match(service, /events\.emit\('user-notes\.changed', \{ kind: 'added' \}\)/);
  const events = await file('events.ts');
  assert.match(events, /import \{ defineEvents, event \} from '@bitakit\/core'/);
  assert.match(
    events,
    /export default defineEvents\(\{\n  changed: event<\{ kind: 'added' \| 'removed' \}>\(\),\n\}\)/,
  );
  const add = await file('actions/add.ts');
  assert.match(add, /export default defineAction<string>\(\{/);
  assert.match(add, /title: 'Add entry'/);
  assert.match(add, /services\["user-notes"\]\.list\.add\(input\)/);
  // A plugin's own service needs no requires entry.
  assert.doesNotMatch(add, /requires/);
  assert.match(await file('actions/remove.ts'), /concurrency: 'per-input'/);
  const clear = await file('actions/clear.ts');
  assert.match(clear, /confirm: 'Remove all entries\?'/);
  assert.match(clear, /success: 'All entries removed'/);
  const open = await file('actions/open.ts');
  assert.match(
    open,
    /export default defineAction\(\{ title: 'User notes', href: '\/user-notes', groups: \['navigation'\], slots: \["shell\.navigation"\] \}\)/,
  );
  assert.doesNotMatch(open, /defineURLAction/);
  const page = await file('ui/pages/index.tsx');
  assert.match(page, /^'use client';/);
  assert.match(page, /import \{ Action, useServiceState \} from '@bitakit\/ui';/);
  assert.match(page, /export default function UserNotesPage\(\)/);
  assert.match(page, /useServiceState\('user-notes\.list', \(state\) => state\.entries/);
  assert.match(page, /aria-label="New entry"/);
  for (const id of ['add', 'remove', 'clear'])
    assert.match(page, new RegExp(`<Action id="user-notes\\.${id}"`));
  assert.doesNotMatch(page, /definePage/);
  await assert.rejects(addPlugin('user-notes', { cwd: root }), /already exists/);
  await assert.rejects(addPlugin('Bad Name', { cwd: root }), /Invalid plugin name/);
  await assert.rejects(addPlugin('settings', { cwd: root }), /reserved/);
});

test('add plugin --minimal keeps the service, its events and one action', async (t) => {
  const root = await project(nextApp(), t);
  const result = await addPlugin('stats', { cwd: root, minimal: true });
  assert.equal(result.path, undefined);
  assert.deepEqual(relative(root, result.created), [
    'src/plugins/stats/actions/add.ts',
    'src/plugins/stats/events.ts',
    'src/plugins/stats/services/list.ts',
  ]);
  assert.match(
    await read(root, 'src/plugins/stats/actions/add.ts'),
    /services\.stats\.list\.add\(input\)/,
  );
});

test('the sample and the scaffolds name their data instead of using "items"', () => {
  const sample = sampleFiles();
  // Class names such as items-center are allowed; identifiers, paths and labels are not.
  for (const [file, content] of Object.entries({ ...sample, ...pluginFiles('notes') }))
    assert.doesNotMatch(`${file}\n${content}`, /(?<![\w-])items?(?![\w-])/i, file);
  assert.match(
    sample['todos/services/list.ts'],
    /store<\{ todos: Todo\[\] \}>\(\{ todos: \[\] \}\)/,
  );
  assert.match(
    sample['todos/actions/add.ts'],
    /services\.todos\.list\.state\.get\(\)\.todos\.length/,
  );
  assert.match(
    sample['todos/ui/pages/index.tsx'],
    /useServiceState\('todos\.list', \(state\) => state\.todos, \[\]\)/,
  );
  // scripts/verify-generated.mjs drives the sample by these labels.
  assert.match(sample['todos/ui/pages/index.tsx'], /aria-label="New todo"/);
  assert.match(sample['todos/actions/clear.ts'], /title: 'Clear all'/);
  assert.match(sample['activity/services/feed.ts'], /'Cleared the list'/);
  // Without a known plugin the hint stays a placeholder instead of naming an example plugin.
  assert.match(actionFile('archive'), /for example services\.<plugin>\.<name>\.<method>\(\)/);
});

test('add <kind> <plugin>/<name> derives files, IDs and page paths from nested names', async (t) => {
  const root = await project(nextApp(), t);
  await addPlugin('notes', { cwd: root, minimal: true });
  const created = async (kind, target) => {
    const result = await addContribution(kind, target, { cwd: root });
    return { ...result, files: relative(root, result.created) };
  };
  const action = await created('action', 'notes/team/invite');
  assert.equal(action.id, 'notes.team.invite');
  assert.deepEqual(action.files, ['src/plugins/notes/actions/team/invite.ts']);
  assert.match(
    await read(root, action.files[0]),
    /export default defineAction\(\{\n  title: 'Invite',/,
  );
  // The hint names the plugin the action belongs to, not an example plugin.
  assert.match(
    await read(root, action.files[0]),
    /for example services\.notes\.<name>\.<method>\(\)/,
  );
  const service = await created('service', 'notes/search');
  assert.equal(service.id, 'notes.search');
  assert.deepEqual(service.files, ['src/plugins/notes/services/search.ts']);
  assert.match(
    await read(root, service.files[0]),
    /export default defineService\(\(\{ store \}\) =>/,
  );
  const page = await created('page', 'notes/stats');
  assert.equal(page.path, '/notes/stats');
  assert.deepEqual(page.files, ['src/plugins/notes/ui/pages/stats.tsx']);
  const stats = await read(root, page.files[0]);
  assert.match(stats, /Served at \/notes\/stats/);
  assert.match(stats, /export default function NotesStatsPage\(\)/);
  assert.match(stats, /<PageHeader title="Stats"/);
  assert.doesNotMatch(stats, /definePage/);
  // An index file serves its folder, as discovery derives it.
  const index = await created('page', 'notes/team/index');
  assert.equal(index.path, '/notes/team');
  assert.deepEqual(index.files, ['src/plugins/notes/ui/pages/team/index.tsx']);
  const team = await read(root, index.files[0]);
  assert.match(team, /Served at \/notes\/team;/);
  assert.match(team, /export default function NotesTeamPage\(\)/);
  assert.match(team, /<PageHeader title="Team"/);
  const interceptor = await created('interceptor', 'notes/audit');
  assert.equal(interceptor.id, 'notes.audit');
  assert.deepEqual(interceptor.files, ['src/plugins/notes/interceptors/audit.ts']);
  assert.match(await read(root, interceptor.files[0]), /action: 'notes\.\*'/);
  const config = await created('config', 'notes/limits');
  assert.equal(config.id, 'notes.limits');
  assert.deepEqual(config.files, ['src/plugins/notes/configs/limits.ts']);
  assert.match(await read(root, config.files[0]), /export default defineConfig\(\{/);
  await assert.rejects(
    addContribution('action', 'notes/team/invite', { cwd: root }),
    /already exists/,
  );
});

test('add events writes events.ts once per plugin', async (t) => {
  const root = await project(
    nextApp({
      'src/plugins/bare/services/list.ts': 'export default defineService(() => ({}));\n',
    }),
    t,
  );
  const result = await addContribution('events', 'bare', { cwd: root });
  assert.equal(result.id, 'bare.*');
  assert.deepEqual(relative(root, result.created), ['src/plugins/bare/events.ts']);
  const events = await read(root, 'src/plugins/bare/events.ts');
  assert.match(events, /export default defineEvents\(\{/);
  assert.match(events, /'bare\.<name>'/);
  await assert.rejects(addContribution('events', 'bare', { cwd: root }), /already exists/);
  await assert.rejects(addContribution('events', 'bare/changed', { cwd: root }), /once per plugin/);
  await assert.rejects(
    addContribution('events', undefined, { cwd: root }),
    /Name the plugin too, for example "bitakit add events notes"/,
  );
});

test('add rejects missing plugins, missing or invalid names and unknown kinds', async (t) => {
  const root = await project(nextApp(), t);
  await addPlugin('notes', { cwd: root, minimal: true });
  await assert.rejects(
    addContribution('action', 'archive', { cwd: root }),
    /Name the plugin too, for example "bitakit add action notes\/archive"/,
  );
  // The first contribution creates a missing plugin folder.
  const created = await addContribution('service', 'listener/log', { cwd: root });
  assert.equal(created.createdPlugin, true);
  assert.deepEqual(relative(root, created.created), ['src/plugins/listener/services/log.ts']);
  // Dotted slot names work like folders, the same rule discovery uses.
  const widget = await addContribution('slot', 'listener/notes.sidebar', { cwd: root });
  assert.equal(widget.id, 'notes.sidebar');
  assert.deepEqual(relative(root, widget.created), [
    'src/plugins/listener/ui/slots/notes/sidebar.tsx',
  ]);
  await assert.rejects(addContribution('action', 'notes/', { cwd: root }), /Name the action/);
  await assert.rejects(
    addContribution('action', 'notes/Bad', { cwd: root }),
    /Invalid action name "Bad"/,
  );
  await assert.rejects(
    addContribution('page', 'notes/a//b', { cwd: root }),
    /Invalid page name ""/,
  );
  await assert.rejects(
    addContribution('widget', 'notes/x', { cwd: root }),
    /Unknown kind "widget"/,
  );
});

test('inside a plugin package, contributions go to src and take the package plugin ID', async (t) => {
  const root = await project(
    {
      'package.json': {
        name: '@acme/bitakit-notes',
        bitakit: { plugin: './plugin' },
        peerDependencies: { '@bitakit/core': '^0.2.0' },
      },
      'src/services/list.ts': 'export default defineService(() => ({}));\n',
    },
    t,
  );
  const found = await findProject(root);
  assert.equal(found.kind, 'plugin');
  assert.equal(found.pluginId, 'notes');
  assert.equal(found.moduleRoot, path.join(root, 'src'));
  const action = await addContribution('action', 'archive', { cwd: root });
  assert.equal(action.id, 'notes.archive');
  assert.deepEqual(relative(root, action.created), ['src/actions/archive.ts']);
  assert.match(await read(root, 'src/actions/archive.ts'), /for example services\.notes\.<name>/);
  const page = await addContribution('page', 'team/index', { cwd: root });
  assert.equal(page.path, '/notes/team');
  assert.deepEqual(relative(root, page.created), ['src/ui/pages/team/index.tsx']);
  const events = await addContribution('events', undefined, { cwd: root });
  assert.deepEqual(relative(root, events.created), ['src/events.ts']);
  await assert.rejects(addContribution('events', 'notes', { cwd: root }), /already exists/);
  await assert.rejects(addContribution('events', 'other', { cwd: root }), /once per plugin/);
  await assert.rejects(addPlugin('notes', { cwd: root }), /plugin package/);
  assert.equal(packagePluginId('@acme/bitakit-plugin-notes'), 'notes');
  assert.equal(packagePluginId('notes-plugin'), 'notes');
  assert.equal(packagePluginId(''), 'plugin');
});

test('findProject reads bitakit.config.ts, flags foundation.config.ts and keeps a broken configuration visible', async (t) => {
  const configured = await project(
    nextApp({
      'bitakit.config.ts': "export default { plugins: { directory: './src/features' } };\n",
    }),
    t,
  );
  const found = await findProject(configured);
  assert.equal(found.kind, 'app');
  assert.equal(found.framework, 'next');
  assert.equal(found.legacyConfig, false);
  assert.equal(found.configError, undefined);
  assert.equal(found.pluginsDirectory, path.join(configured, 'src/features'));
  const result = await addPlugin('notes', { cwd: configured, minimal: true });
  assert.ok(
    relative(configured, result.created).every((file) => file.startsWith('src/features/notes/')),
  );

  const legacy = await project(nextApp({ 'foundation.config.ts': 'export default {};\n' }), t);
  assert.equal((await findProject(legacy)).legacyConfig, true);

  // A configuration that cannot be evaluated is reported, not hidden; commands that need it fail with the cause.
  const broken = await project(
    nextApp({
      'bitakit.config.ts':
        "import { defineBitaKit } from 'not-installed';\nexport default defineBitaKit({});\n",
    }),
    t,
  );
  const failed = await findProject(broken);
  assert.equal(failed.kind, 'app');
  assert.equal(failed.legacyConfig, false);
  assert.match(failed.configError?.message ?? '', /not-installed/);
  await assert.rejects(addPlugin('notes', { cwd: broken }), /not-installed/);
  await assert.rejects(findProject(path.parse(broken).root), /No package\.json found/);
});

test('slot-definition scaffolds an owned contract separately from a UI slot contribution', async (t) => {
  const root = await project(nextApp(), t);
  await addPlugin('notes', { cwd: root, minimal: true });
  const definition = await addContribution('slot-definition', 'notes/header/tools', { cwd: root });
  assert.deepEqual(relative(root, definition.created), ['src/plugins/notes/slots/header/tools.ts']);
  assert.match(
    await read(root, 'src/plugins/notes/slots/header/tools.ts'),
    /defineSlot\(\{ accepts: 'component', policy: 'list' \}\)/,
  );
  const view = await addContribution('slot', 'notes/header/tools', { cwd: root });
  assert.deepEqual(relative(root, view.created), ['src/plugins/notes/ui/slots/header/tools.tsx']);
  // A ui/slots file fills the slot its path names; the slot name is not prefixed with the plugin.
  assert.equal(view.id, 'header.tools');
  assert.equal(view.plugin, 'notes');
});

test('custom settings page scaffold retains canonical fields without duplicate registration', async (t) => {
  const root = await project(nextApp(), t);
  await addPlugin('notes', { cwd: root, minimal: true });
  const result = await addContribution('settings-page', 'notes', { cwd: root });
  assert.deepEqual(relative(root, result.created), ['src/plugins/notes/ui/settings/page.tsx']);
  const source = await read(root, 'src/plugins/notes/ui/settings/page.tsx');
  assert.match(source, /section.fields.map\(renderField\)/);
  assert.doesNotMatch(source, /defineAction|slots.attach|useState/);
  await assert.rejects(addContribution('settings-page', 'notes', { cwd: root }), /already exists/);
  await assert.rejects(
    addContribution('settings-page', 'notes/nested', { cwd: root }),
    /once per plugin/,
  );
});

test('add test writes a headless test with a Shell stand-in that runs as generated', async (t) => {
  const manifest = nextApp()['package.json'];
  const root = await project(
    nextApp({
      'package.json': {
        ...manifest,
        type: 'module',
        scripts: { ...manifest.scripts, test: 'node --test tests/*.test.ts' },
        devDependencies: {
          '@bitakit/discovery': '*',
          jiti: '*',
          typescript: '*',
          '@types/node': '*',
        },
      },
    }),
    t,
  );
  await addPlugin('notes', { cwd: root, example: true });
  const before = await read(root, 'package.json');
  const result = await addContribution('test', 'notes', { cwd: root });
  assert.equal(result.plugin, 'notes');
  assert.deepEqual(relative(root, result.created), ['tests/notes.test.ts']);
  assert.deepEqual(result.setup, []);
  assert.equal(result.run, 'npm test');
  assert.equal(await read(root, 'package.json'), before);
  const source = await read(root, 'tests/notes.test.ts');
  assert.match(source, /import \{ definePlugin, defineSlot \} from '@bitakit\/core';/);
  assert.match(source, /slots: \{ navigation: defineSlot\(\{ accepts: 'actions' \}\) \},/);
  assert.match(source, /await mountPlugin\('src\/plugins\/notes', \{ plugins: \[shell\] \}\);/);
  assert.match(source, /assert\.equal\(plugin\.runtime\.isReady\(plugin\.id\), true\);/);
  assert.match(source, /finally \{\n    await plugin\.stop\(\);/);
  assert.doesNotMatch(source, /TODO/);

  // The generated file runs unchanged against the real packages, not the stubbed manifest.
  await rm(path.join(root, 'node_modules/@bitakit/core'), { recursive: true });
  await link(root, '@bitakit/core', 'packages/core');
  await link(root, '@bitakit/discovery', 'packages/discovery');
  const env = { ...process.env };
  // Without this, the nested runner reports to the outer one instead of printing its result.
  delete env.NODE_TEST_CONTEXT;
  const run = await promisify(execFile)(process.execPath, ['--test', 'tests/notes.test.ts'], {
    cwd: root,
    env,
  }).catch((error) => error);
  assert.equal(run.code ?? 0, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /pass 1/);

  await assert.rejects(addContribution('test', 'notes', { cwd: root }), /already exists/);
});

test('add test lists the missing setup and mounts by ID outside a plugins directory', async (t) => {
  const bare = await project(nextApp({ 'src/plugins/log/services/entries.ts': '' }), t);
  const result = await addContribution('test', 'log', { cwd: bare });
  assert.deepEqual(result.setup, [
    'npm install --save-dev @bitakit/discovery jiti typescript @types/node',
    'npm pkg set type=module',
    'npm pkg set scripts.test="node --test tests/*.test.ts"',
  ]);
  assert.equal(result.run, 'npm test');
  const source = await read(bare, 'tests/log.test.ts');
  assert.match(source, /await mountPlugin\('src\/plugins\/log'\);/);
  assert.doesNotMatch(source, /definePlugin|shell/);

  const manifest = nextApp()['package.json'];
  const features = await project(
    nextApp({
      'package.json': {
        ...manifest,
        type: 'module',
        scripts: { ...manifest.scripts, test: 'vitest run' },
        devDependencies: {
          '@bitakit/discovery': '*',
          jiti: '*',
          typescript: '*',
          '@types/node': '*',
        },
      },
      'bitakit.config.ts': "export default { plugins: { directory: './src/features' } };\n",
      'src/features/log/plugin.config.ts': "export default { id: 'journal' };\n",
      'src/features/log/services/entries.ts': '',
      'src/features/notes/services/entries.ts': '',
    }),
    t,
  );
  const configured = await addContribution('test', 'log', { cwd: features });
  assert.equal(configured.id, 'journal');
  assert.deepEqual(configured.setup, []);
  // Another runner owns npm test, so the file is run directly.
  assert.equal(configured.run, 'node --test tests/log.test.ts');
  assert.match(
    await read(features, 'tests/log.test.ts'),
    /await mountPlugin\('src\/features\/log', \{ id: 'journal' \}\);/,
  );
  // Without plugin.config.ts the folder name is the ID; mountPlugin would use the package name.
  await addContribution('test', 'notes', { cwd: features });
  assert.match(
    await read(features, 'tests/notes.test.ts'),
    /await mountPlugin\('src\/features\/notes', \{ id: 'notes' \}\);/,
  );

  const npmInit = await project(
    nextApp({
      'package.json': {
        ...manifest,
        scripts: { test: 'echo "Error: no test specified" && exit 1' },
      },
      'src/plugins/log/services/entries.ts': '',
    }),
    t,
  );
  const fresh = await addContribution('test', 'log', { cwd: npmInit });
  assert.ok(fresh.setup.includes('npm pkg set scripts.test="node --test tests/*.test.ts"'));
});

test('add test owns every Shell slot that Actions are placed in, and only those', async (t) => {
  const root = await project(
    nextApp({
      'src/plugins/print/actions/open.ts':
        "export default defineAction({ title: 'Print', href: '/print', slots: ['todos.toolbar'] });\n",
      // A Shell slot listed after a placement that contains brackets is still found.
      'src/plugins/print/actions/run.ts':
        "export default defineAction({ title: 'Print now', requires: ['shell.appearance'], slots: [{ slot: 'shell.toolbar', input: () => ['a'] }, 'shell.navigation'] });\n",
    }),
    t,
  );
  await addContribution('test', 'print', { cwd: root });
  const source = await read(root, 'tests/print.test.ts');
  assert.match(
    source,
    /slots: \{\n    navigation: defineSlot\(\{ accepts: 'actions' \}\),\n    toolbar: defineSlot\(\{ accepts: 'actions' \}\),\n  \},/,
  );
  assert.doesNotMatch(source, /appearance|todos/);
});

test('add test rejects missing plugins, nested names and plugin packages without writing', async (t) => {
  const root = await project(nextApp(), t);
  await assert.rejects(
    addContribution('test', 'notes', { cwd: root }),
    /src[\\/]plugins[\\/]notes does not exist\. Create the plugin first, for example "bitakit add plugin notes"/,
  );
  assert.equal(await exists(path.join(root, 'tests')), false);
  assert.equal(await exists(path.join(root, 'src/plugins/notes')), false);
  await addPlugin('notes', { cwd: root, minimal: true });
  await assert.rejects(
    addContribution('test', 'notes/items', { cwd: root }),
    /run "bitakit add test notes" without a further name/,
  );
  await assert.rejects(addContribution('test', undefined, { cwd: root }), /Name the plugin/);
  await assert.rejects(addContribution('test', 'Bad', { cwd: root }), /Invalid plugin name/);
  const pluginPackage = await project(
    { 'package.json': { name: 'bitakit-notes', bitakit: { plugin: './plugin' } } },
    t,
  );
  await assert.rejects(addContribution('test', 'notes', { cwd: pluginPackage }), /inside an app/);
});

test('add layout writes a layout.<family> candidate for the app, an app plugin or a package', async (t) => {
  const root = await project(nextApp(), t);
  const flat = await addContribution('layout', 'auth', { cwd: root });
  assert.equal(flat.id, 'layout.auth');
  assert.deepEqual(relative(root, flat.created), ['src/layouts/auth.tsx']);
  const source = await read(root, 'src/layouts/auth.tsx');
  assert.match(source, /export const layout = 'auth';/);
  assert.match(source, /choose: \{ 'layout\.auth': 'default' \}/);
  assert.match(
    source,
    /export default function AuthLayout\(\{ children \}: \{ children\?: ReactNode \}\)/,
  );

  const variant = await addContribution('layout', 'auth/split', { cwd: root });
  assert.deepEqual(relative(root, variant.created), ['src/layouts/auth/split.tsx']);
  assert.match(await read(root, 'src/layouts/auth/split.tsx'), /function AuthSplitLayout/);

  await assert.rejects(
    addContribution('layout', 'auth/split', { cwd: root, plugin: 'brand' }),
    /There is no plugin "brand"\. Create it first/,
  );
  await addPlugin('brand', { cwd: root });
  const plugin = await addContribution('layout', 'auth/split', { cwd: root, plugin: 'brand' });
  assert.deepEqual(relative(root, plugin.created), ['src/plugins/brand/ui/layouts/auth/split.tsx']);

  await assert.rejects(
    addContribution('layout', undefined, { cwd: root }),
    /Name the layout family/,
  );
  await assert.rejects(addContribution('layout', 'a/b/c', { cwd: root }), /"<family>\/<variant>"/);
  await assert.rejects(addContribution('layout', 'Auth', { cwd: root }), /layout family/);

  const pkg = await project(
    {
      'package.json': {
        name: '@acme/bitakit-frames',
        bitakit: { plugin: './plugin' },
        peerDependencies: { '@bitakit/core': '^0.2.0' },
      },
      'src/services/list.ts': 'export default defineService(() => ({}));\n',
    },
    t,
  );
  const packaged = await addContribution('layout', 'onboarding/steps', { cwd: pkg });
  assert.deepEqual(relative(pkg, packaged.created), ['src/ui/layouts/onboarding/steps.tsx']);
});
