import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { planProject, createApp, createProject, useLocalPackages } from '../src/create-app.mjs';
import { bitakitRange } from '../src/project-files.mjs';

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bitakit-create-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const read = (target, file) => readFile(path.join(target, file), 'utf8');
const exists = (target, file) => access(path.join(target, file));
const missing = (target, file) => assert.rejects(access(path.join(target, file)));

// The official scaffolds are replaced by their minimal output; the real scaffold/install/build
// path is verified against packed packages separately.
async function scaffoldNext(command, args) {
  assert.equal(command, process.execPath);
  assert.ok(args.includes('--skip-install'));
  assert.ok(args.includes('--disable-git'));
  const target = args[1];
  await mkdir(path.join(target, 'src/app'), { recursive: true });
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      dependencies: { next: '16.4.2', react: '19.2.0', 'react-dom': '19.2.0' },
      devDependencies: {},
      scripts: {},
    }),
  );
  await writeFile(path.join(target, 'src/app/page.tsx'), 'export default function Page() {}');
  await writeFile(path.join(target, 'src/app/layout.tsx'), 'export default function Layout() {}');
  await writeFile(path.join(target, 'src/app/globals.css'), '@import "tailwindcss";\n');
  await writeFile(path.join(target, 'next.config.ts'), 'export default {};\n');
  await writeFile(path.join(target, '.gitignore'), 'node_modules/\n');
  await writeFile(path.join(target, 'AGENTS.md'), '<!-- next rules -->\n');
}
async function scaffoldStart(command, args) {
  assert.equal(command, process.execPath);
  assert.ok(args.includes('--blank'));
  assert.ok(args.includes('--no-install'));
  assert.ok(args.includes('--no-git'));
  const target = args[args.indexOf('--target-dir') + 1];
  await mkdir(path.join(target, 'src/routes'), { recursive: true });
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      dependencies: { react: '19.2.0', 'react-dom': '19.2.0' },
      scripts: { dev: 'vite dev', build: 'vite build' },
    }),
  );
  await writeFile(path.join(target, 'src/routes/index.tsx'), 'export {};');
  await writeFile(path.join(target, 'src/routes/__root.tsx'), 'export {};');
}

test('rejects existing directories and symlinks without touching user files', async (t) => {
  const root = await workspace(t);
  const existing = path.join(root, 'existing');
  await mkdir(existing);
  await writeFile(path.join(existing, 'keep.txt'), 'user content');
  await symlink(existing, path.join(root, 'linked'));
  await assert.rejects(planProject(existing), /already exists/);
  await assert.rejects(planProject(path.join(root, 'linked')), /already exists/);
  assert.equal(await readFile(path.join(existing, 'keep.txt'), 'utf8'), 'user content');
});

test('defaults to the full app frame and resolves prerequisites before writing', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'app');
  assert.deepEqual((await planProject(target)).features, ['preferences', 'shell', 'quick-search']);
  assert.deepEqual((await planProject(target, { features: [] })).features, []);
  assert.deepEqual((await planProject(target, { features: ['quick-search'] })).features, [
    'preferences',
    'shell',
    'quick-search',
  ]);
  const plugin = await planProject(target, { type: 'plugin', features: [], sample: true });
  assert.equal(plugin.type, 'plugin');
  assert.equal(plugin.sample, false);
  assert.deepEqual(plugin.features, ['preferences', 'shell', 'quick-search']);
  await assert.rejects(planProject(target, { framework: 'unsupported' }), /Unsupported framework/);
  await assert.rejects(planProject(target, { features: ['unknown'] }), /Unknown feature/);
  await assert.rejects(planProject(target, { type: 'widget' }), /Unknown project type/);
  await assert.rejects(planProject(path.join(root, 'Bad Name')), /Invalid project name/);
  await missing(root, 'app');
});

test('a bare app wraps next.config, mounts one provider, imports one generated stylesheet and renders plugin pages', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), { features: [], install: false });
  await createApp(plan, { run: scaffoldNext });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  assert.equal(manifest.dependencies['@bitakit/shell'], undefined);
  for (const name of ['core', 'ui', 'next'])
    assert.equal(manifest.dependencies[`@bitakit/${name}`], bitakitRange);
  assert.equal(manifest.devDependencies['@bitakit/cli'], bitakitRange);
  assert.equal(manifest.devDependencies['@bitakit/discovery'], bitakitRange);
  assert.deepEqual(manifest.scripts, {
    dev: 'next dev',
    build: 'next build',
    typecheck: 'bitakit generate && next typegen && tsc --noEmit',
  });
  assert.equal(
    await read(plan.target, 'next.config.ts'),
    "import { withBitaKit } from '@bitakit/next/config';\n\nexport default withBitaKit({});\n",
  );
  const layout = await read(plan.target, 'src/app/layout.tsx');
  assert.match(layout, /import \{ BitaKitProvider \} from '@\/bitakit\.gen';/);
  assert.equal(layout.match(/<BitaKitProvider>/g).length, 1);
  assert.doesNotMatch(layout, /BitaKitRuntimeProvider|NuqsAdapter/);
  // The theme script belongs to the Shell; without it the layout stays plain.
  assert.doesNotMatch(layout, /ShellThemeScript|suppressHydrationWarning|<head>/);
  assert.equal(
    await read(plan.target, 'src/app/globals.css'),
    "@layer theme, base, components, utilities;\n@import 'tailwindcss';\n/* Styles of the installed BitaKit packages, generated by discovery. Add your own CSS below. */\n@import '../bitakit.gen.css';\n",
  );
  assert.match(
    await read(plan.target, 'src/app/[...path]/page.tsx'),
    /<PluginPage fallback=\{<PageHeader title="Page not found" \/>\} \/>/,
  );
  await exists(plan.target, 'src/app/page.tsx');
  await missing(plan.target, 'src/app/settings');
  await missing(plan.target, 'src/plugins');
  await missing(plan.target, 'src/configs');
  const rules = await read(plan.target, 'AGENTS.md');
  assert.match(rules, /^<!-- next rules -->\n\n<!-- BEGIN:bitakit-agent-rules -->/);
  assert.match(rules, /npx bitakit add plugin <name>/);
  assert.match(rules, /`ui\/pages\/<path>\.tsx`/);
  assert.match(rules, /App-owned routes stay native framework routes in `src\/app`/);
  assert.match(rules, /Never edit generated files: `src\/bitakit\.gen\.\*`/);
  // One screen: the block may change, but it must not grow back past this budget.
  const block = rules.slice(rules.indexOf('<!-- BEGIN:bitakit-agent-rules -->'));
  assert.ok(block.length <= 3200, `agent rules are ${block.length} characters; the budget is 3200`);
  assert.ok(block.split('\n').length <= 40, 'agent rules fit on one screen');
  assert.equal(
    await read(plan.target, '.gitignore'),
    'node_modules/\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n',
  );
  assert.doesNotMatch(await read(plan.target, 'README.md'), /Todo sample/);
});

test('the shell app adds the App Shell, settings, a not-found fallback and the Todos sample', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), { install: false, sample: true });
  await createApp(plan, { run: scaffoldNext });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  for (const name of ['app-preferences', 'shell', 'quick-search'])
    assert.equal(manifest.dependencies[`@bitakit/${name}`], bitakitRange);
  assert.match(
    await read(plan.target, 'src/app/(app)/layout.tsx'),
    /<AppShell>\{children\}<\/AppShell>/,
  );
  const shellLayout = await read(plan.target, 'src/app/layout.tsx');
  assert.match(shellLayout, /import \{ ShellThemeScript \} from '@bitakit\/shell';/);
  assert.match(shellLayout, /<html lang="en" suppressHydrationWarning>/);
  assert.match(shellLayout, /<head>\n\s+<ShellThemeScript \/>\n\s+<\/head>\n\s+<body>/);
  assert.equal(shellLayout.match(/<BitaKitProvider>/g).length, 1);
  assert.match(
    await read(plan.target, 'src/app/(app)/[...path]/page.tsx'),
    /<PluginPage fallback=\{<NotFoundPage \/>\} \/>/,
  );
  assert.match(
    await read(plan.target, 'src/app/settings/[[...section]]/page.tsx'),
    /<SettingsRoute \/>/,
  );
  assert.match(
    await read(plan.target, 'src/configs/shell.ts'),
    /export default defineConfig\(\{[\s\S]*navigationSlot: 'shell\.navigation',[\s\S]*\} satisfies ShellOptions/,
  );
  await missing(plan.target, 'src/app/page.tsx');
  await missing(plan.target, 'src/app/[...path]');
  assert.match(await read(plan.target, 'src/app/(app)/page.tsx'), /Open Todos in the navigation/);
  const todos = (file) => path.join(plan.target, 'src/plugins/todos', file);
  for (const file of [
    'services/items.ts',
    'settings.ts',
    'events.ts',
    'slots/footer.ts',
    'actions/add.ts',
    'actions/remove.ts',
    'actions/clear.ts',
    'actions/open.ts',
    'ui/pages/index.tsx',
  ])
    await access(todos(file));
  // A second plugin listens to todos.changed and fills todos.footer without editing todos.
  const activity = (file) => path.join(plan.target, 'src/plugins/activity', file);
  assert.match(
    await readFile(activity('services/feed.ts'), 'utf8'),
    /events\.on\('todos\.changed'/,
  );
  await access(activity('ui/slots/todos.footer.tsx'));
  assert.match(
    await readFile(todos('ui/pages/index.tsx'), 'utf8'),
    /<PluginSlot name="todos\.footer" \/>/,
  );
  assert.match(await readFile(todos('ui/pages/index.tsx'), 'utf8'), /<Button type="submit" \/>/);
  await assert.rejects(access(todos('pages')));
  assert.match(await readFile(todos('actions/open.ts'), 'utf8'), /href: '\/todos'/);
  assert.match(
    await readFile(todos('ui/pages/index.tsx'), 'utf8'),
    /useServiceState\('todos\.items'/,
  );
  const readme = await read(plan.target, 'README.md');
  assert.match(readme, /Todo sample is a working example in two plugins/);
  assert.match(readme, /`src\/plugins\/<name>\/ui\/pages`/);
  assert.match(readme, /`src\/configs\/shell\.ts`/);
});

test('CLI dry-run does not create files and unsupported framework exits with an error', async (t) => {
  const root = await workspace(t);
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const target = path.join(root, 'app');
  const result = await execa(process.execPath, [
    cli,
    target,
    '--features',
    'quick-search',
    '--sample',
    '--dry-run',
    '--yes',
  ]);
  assert.match(result.stdout, /preferences, shell, quick-search/);
  assert.match(result.stdout, /Todo \(todos \+ activity plugins\)/);
  await missing(root, 'app');
  const plugin = await execa(process.execPath, [
    cli,
    path.join(root, 'widget'),
    '--plugin',
    '--dry-run',
    '--yes',
  ]);
  assert.match(plugin.stdout, /plugin package with a Next\.js playground/);
  await missing(root, 'widget');
  const rejected = await execa(
    process.execPath,
    [cli, target, '--framework', 'unsupported', '--yes'],
    { reject: false },
  );
  assert.notEqual(rejected.exitCode, 0);
  await missing(root, 'app');
});

test('installation failures propagate and leave generated files available for inspection', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'));
  await assert.rejects(
    createApp(plan, {
      run: async (command, args) => {
        if (command === 'npm') throw new Error('Registry unavailable');
        await scaffoldNext(command, args);
      },
    }),
    /Registry unavailable/,
  );
  await exists(plan.target, 'package.json');
  await exists(plan.target, 'next.config.ts');
});

test('TanStack apps get the same frame through native file routes and the Vite plugin', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'start'), {
    framework: 'tanstack',
    install: false,
  });
  await createApp(plan, { run: scaffoldStart });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  assert.equal(manifest.dependencies['@bitakit/tanstack'], bitakitRange);
  assert.equal(manifest.dependencies['@bitakit/next'], undefined);
  assert.equal(manifest.dependencies['@bitakit/shell'], bitakitRange);
  assert.ok(manifest.dependencies['@tanstack/react-start']);
  assert.ok(manifest.devDependencies.tailwindcss);
  assert.deepEqual(manifest.scripts, {
    dev: 'vite dev',
    build: 'vite build',
    typecheck: 'bitakit generate && tsr generate && tsc --noEmit',
  });
  const vite = await read(plan.target, 'vite.config.ts');
  assert.match(vite, /import \{ bitakit \} from '@bitakit\/tanstack\/config';/);
  assert.match(vite, /plugins: \[bitakit\(\), tanstackStart\(\), react\(\), tailwindcss\(\)\]/);
  const rootRoute = await read(plan.target, 'src/routes/__root.tsx');
  assert.match(rootRoute, /import \{ BitaKitProvider \} from '\.\.\/bitakit\.gen';/);
  assert.equal(rootRoute.match(/<BitaKitProvider>/g).length, 1);
  assert.doesNotMatch(rootRoute, /BitaKitRuntimeProvider/);
  assert.match(rootRoute, /import \{ ShellThemeScript \} from '@bitakit\/shell';/);
  assert.match(rootRoute, /<head>\n\s+<HeadContent \/>\n\s+<ShellThemeScript \/>\n\s+<\/head>/);
  assert.doesNotMatch(rootRoute, /suppressHydrationWarning/);
  assert.match(await read(plan.target, 'src/routes/_app.tsx'), /<AppShell>/);
  assert.match(
    await read(plan.target, 'src/routes/_app.$.tsx'),
    /<PluginPage fallback=\{<NotFoundPage \/>\} \/>/,
  );
  assert.match(await read(plan.target, 'src/routes/settings.$.tsx'), /SettingsRoute/);
  assert.equal(
    await read(plan.target, 'src/styles.css'),
    "@layer theme, base, components, utilities;\n@import 'tailwindcss';\n/* Styles of the installed BitaKit packages, generated by discovery. Add your own CSS below. */\n@import './bitakit.gen.css';\n",
  );
  await missing(plan.target, 'src/routes/index.tsx');
  assert.equal(await read(plan.target, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(
    await read(plan.target, 'AGENTS.md'),
    /App-owned routes stay native framework routes in `src\/routes`/,
  );
  assert.equal(
    await read(plan.target, '.gitignore'),
    'node_modules/\ndist/\n.env*\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n',
  );
});

test('a plugin package has the same folders as an app plugin, a headless test and a playground', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'my-notes'), { type: 'plugin', install: false });
  await createProject(plan, { run: scaffoldNext });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  assert.equal(manifest.name, 'my-notes');
  assert.deepEqual(manifest.bitakit, { plugin: './plugin', id: 'my-notes' });
  assert.deepEqual(manifest.exports, {
    './package.json': './package.json',
    './plugin': { types: './dist/plugin.d.ts', default: './dist/plugin.js' },
  });
  assert.deepEqual(manifest.files, ['dist']);
  assert.deepEqual(manifest.workspaces, ['playground']);
  assert.equal(manifest.dependencies, undefined);
  for (const name of ['@bitakit/core', '@bitakit/ui'])
    assert.equal(manifest.peerDependencies[name], bitakitRange);
  assert.equal(manifest.peerDependencies.react, '^19.0.0');
  // One React: the plugin develops against the playground's exact version.
  assert.equal(manifest.devDependencies.react, '19.2.0');
  assert.equal(manifest.devDependencies['react-dom'], '19.2.0');
  assert.equal(manifest.devDependencies['@bitakit/cli'], bitakitRange);
  assert.equal(manifest.devDependencies['@bitakit/discovery'], bitakitRange);
  assert.equal(manifest.scripts.build, 'bitakit build');
  assert.equal(manifest.scripts.typecheck, 'bitakit build --check');
  assert.equal(manifest.scripts.test, 'node --test tests/*.test.ts');
  assert.equal(manifest.scripts.dev, 'npm run dev --workspace playground');
  const tsconfig = JSON.parse(await read(plan.target, 'tsconfig.json'));
  assert.deepEqual(tsconfig.include, ['src', '.bitakit/plugin.d.ts']);
  assert.equal(tsconfig.compilerOptions.rootDir, 'src');
  const spec = await read(plan.target, 'tests/my-notes.test.ts');
  assert.match(spec, /import \{ mountPlugin \} from '@bitakit\/core\/testing';/);
  assert.match(spec, /const plugin = await mountPlugin\('src'\);/);
  assert.match(spec, /await plugin\.execute\('add', 'First item'\);/);
  assert.match(
    spec,
    /plugin\.events\.recorded\.some\(\(event\) => event\.type === 'my-notes\.changed'\)/,
  );
  assert.match(spec, /plugin\.actions\.get\('my-notes\.clear'\)\?\.enabled/);
  for (const file of [
    'services/items.ts',
    'events.ts',
    'actions/add.ts',
    'actions/remove.ts',
    'actions/clear.ts',
    'actions/open.ts',
    'ui/pages/index.tsx',
  ])
    await exists(plan.target, `src/${file}`);
  assert.match(
    await read(plan.target, 'src/actions/add.ts'),
    /services\["my-notes"\]\.items\.add\(input\)/,
  );
  assert.match(await read(plan.target, '.gitignore'), /^node_modules\/\ndist\/\n\.bitakit\/\n/);
  assert.match(
    await read(plan.target, 'AGENTS.md'),
    /# BitaKit plugin package[\s\S]*the ID "my-notes"[\s\S]*`src\/ui\/pages\/<path>\.tsx`/,
  );
  assert.equal(await read(plan.target, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(await read(plan.target, 'README.md'), /npm install my-notes/);

  const playground = path.join(plan.target, 'playground');
  const playgroundManifest = JSON.parse(await read(playground, 'package.json'));
  assert.equal(playgroundManifest.name, 'my-notes-playground');
  assert.equal(playgroundManifest.private, true);
  assert.equal(playgroundManifest.dependencies['@bitakit/devtools'], bitakitRange);
  assert.equal(playgroundManifest.dependencies['@bitakit/shell'], bitakitRange);
  assert.equal(playgroundManifest.overrides, undefined);
  assert.equal(
    await read(playground, 'bitakit.config.ts'),
    "import { defineBitaKit } from '@bitakit/discovery';\n\n// Discover the plugin straight from ../src, so edits reload instantly.\nexport default defineBitaKit({ plugins: { include: { \"my-notes\": '../src' } } });\n",
  );
  assert.match(
    await read(playground, 'src/app/(app)/page.tsx'),
    /import \{ Inspector \} from '@bitakit\/devtools';[\s\S]*<Inspector plugin="my-notes" \/>/,
  );
  assert.match(await read(playground, 'src/app/layout.tsx'), /<BitaKitProvider>/);
  assert.match(await read(playground, 'next.config.ts'), /withBitaKit\(\{\}\)/);
  await exists(playground, 'src/app/(app)/[...path]/page.tsx');
  await missing(playground, 'src/plugins');
});

test('a TanStack playground opens the Inspector on its index route', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'start-notes'), {
    type: 'plugin',
    framework: 'tanstack',
    install: false,
  });
  await createProject(plan, { run: scaffoldStart });
  const playground = path.join(plan.target, 'playground');
  assert.equal(
    await read(playground, 'src/routes/_app.index.tsx'),
    "import { createFileRoute } from '@tanstack/react-router';\nimport { Inspector } from '@bitakit/devtools';\n\nexport const Route = createFileRoute('/_app/')({ component: () => <Inspector plugin=\"start-notes\" /> });\n",
  );
  assert.match(await read(playground, 'bitakit.config.ts'), /"start-notes": '\.\.\/src'/);
  assert.match(await read(playground, 'vite.config.ts'), /bitakit\(\)/);
  assert.match(await read(plan.target, 'README.md'), /A TanStack Start app to try the plugin in/);
  assert.equal(JSON.parse(await read(plan.target, 'package.json')).devDependencies.react, '19.2.0');
});

test('local tarballs replace every @bitakit dependency, including dev tools', async (t) => {
  const root = await workspace(t);
  const tarballs = path.join(root, 'tarballs');
  await mkdir(tarballs);
  for (const name of ['core', 'ui', 'next', 'cli'])
    await writeFile(path.join(tarballs, `bitakit-${name}-0.2.0.tgz`), '');
  const target = path.join(root, 'app');
  await mkdir(target);
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      dependencies: {
        '@bitakit/core': '^0.2.0',
        '@bitakit/ui': '^0.2.0',
        '@bitakit/next': '^0.2.0',
      },
      devDependencies: { '@bitakit/cli': '^0.2.0' },
    }),
  );
  await useLocalPackages(target, tarballs);
  const manifest = JSON.parse(await read(target, 'package.json'));
  assert.equal(
    manifest.devDependencies['@bitakit/cli'],
    `file:${path.join(tarballs, 'bitakit-cli-0.2.0.tgz')}`,
  );
  assert.equal(
    manifest.overrides['@bitakit/core'],
    `file:${path.join(tarballs, 'bitakit-core-0.2.0.tgz')}`,
  );
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({ dependencies: { '@bitakit/shell': '^0.2.0' } }),
  );
  await assert.rejects(
    useLocalPackages(target, tarballs),
    /Missing npm tarball for @bitakit\/shell/,
  );
});
