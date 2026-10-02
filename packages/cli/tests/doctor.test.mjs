import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlugin, doctor } from '../src/index.mjs';
import { catchAll, find, nextApp, project, status, write } from './helpers.mjs';

test('doctor passes a wired app once a route renders its plugin pages', async (t) => {
  const root = await project(nextApp(), t);
  await addPlugin('notes', { cwd: root });
  let { results } = await doctor({ cwd: root });
  assert.equal(status(results, /All 2 @bitakit packages are 0\.2\.0/), 'ok');
  assert.equal(status(results, /One copy of @bitakit\/core/), 'ok');
  assert.equal(status(results, /next\.config wraps the configuration with withBitaKit/), 'ok');
  assert.equal(status(results, /root layout mounts the BitaKit provider/), 'ok');
  const pages = find(results, /plugin pages cannot be reached/);
  assert.equal(pages.status, 'error');
  assert.deepEqual(pages.details, [
    'plugin "notes" has a page at /notes (src/plugins/notes/ui/pages/index.tsx), but no route renders plugin pages.',
  ]);
  assert.match(
    pages.fix,
    /^Create src\/app\/\(app\)\/\[\.\.\.path\]\/page\.tsx:\n\n'use client';\nimport \{ PluginPage \} from '@bitakit\/ui';/,
  );
  assert.match(pages.fix, /<PluginPage \/>/);
  assert.equal(status(results, /The navigation link has a page/), 'ok');
  assert.equal(status(results, /Service names are unique/), 'ok');
  assert.equal(status(results, /Package styles are imported in src\/app\/globals\.css/), 'ok');
  assert.equal(status(results, /Every contribution file has a default export/), 'ok');
  assert.equal(status(results, /Folder layout is current/), 'ok');
  assert.deepEqual(
    results.filter((result) => result.status !== 'ok'),
    [pages],
  );

  await write(root, catchAll);
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /The plugin page can be reached/), 'ok');
  assert.ok(
    results.every((result) => result.status === 'ok'),
    JSON.stringify(results, null, 2),
  );
});

test('doctor reports missing wiring with the lines to add', async (t) => {
  const root = await project(
    nextApp({
      'package.json': {
        name: 'demo',
        dependencies: { next: '16.0.0', '@bitakit/shell': '^0.2.0' },
        scripts: { dev: 'foundation-generate && next dev --webpack' },
      },
      'next.config.ts': 'export default {};\n',
      'src/app/layout.tsx': 'export default function Layout({ children }) { return children; }\n',
      'src/app/globals.css': "@import 'tailwindcss';\n",
      '.gitignore': 'node_modules/\n',
      ...catchAll,
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const config = find(results, /next\.config does not run BitaKit discovery/);
  assert.equal(config.status, 'error');
  assert.match(
    config.fix,
    /import \{ withBitaKit \} from '@bitakit\/next\/config';\nexport default withBitaKit\(\{\}\);/,
  );
  assert.equal(status(results, /Scripts still force Webpack/), 'warn');
  assert.equal(status(results, /Scripts use the old foundation-generate command/), 'warn');
  const provider = find(results, /No BitaKit provider in the root layout/);
  assert.equal(provider.status, 'error');
  assert.match(
    provider.fix,
    /import \{ BitaKitProvider \} from '@\/bitakit\.gen';\n<BitaKitProvider>\{children\}<\/BitaKitProvider>/,
  );
  const ignored = find(results, /Generated files are not ignored by Git/);
  assert.equal(ignored.status, 'warn');
  assert.match(ignored.fix, /src\/bitakit\.gen\.\*/);
  const styles = find(results, /Installed packages ship styles that are not imported/);
  assert.equal(styles.status, 'warn');
  assert.deepEqual(styles.details, ['@bitakit/shell/styles.css']);
  assert.equal(
    styles.fix,
    "Add this line after @import 'tailwindcss'; in src/app/globals.css:\n\n@import '../bitakit.gen.css';",
  );
});

test('doctor finds dead links, alias collisions, mixed versions, ignored files and deprecated layouts', async (t) => {
  const root = await project(
    nextApp({
      'node_modules/@bitakit/ui/package.json': { name: '@bitakit/ui', version: '0.1.0' },
      'src/plugins/a/services/items.ts':
        "import { defineService } from '@bitakit/core';\nexport default defineService(({ store }) => ({ state: store({}) }), { exposeAs: 'items' });\n",
      'src/plugins/b/services/items.ts':
        "import { defineService } from '@bitakit/core';\nexport default defineService(({ store }) => ({ state: store({}) }), { exposeAs: 'items' });\n",
      'src/plugins/b/actions/open.ts':
        "import { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'B', href: '/missing', groups: ['navigation'] });\n",
      'src/plugins/b/actions/helper.ts': 'export const helper = 1;\n',
      'src/plugins/c/actions/add.action.ts':
        "import { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'Add', execute: () => {} });\n",
      'src/plugins/c/actions/open.ts':
        "import { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'C', href: '/legacy-c', groups: ['navigation'] });\n",
      // A 0.1 page keeps the path it declares until it moves under ui/pages.
      'src/plugins/c/pages/c.tsx':
        "import { definePage } from '@bitakit/core';\nexport default definePage({ path: '/legacy-c', component: () => null });\n",
      ...catchAll,
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const versions = find(results, /Mixed @bitakit versions/);
  assert.equal(versions.status, 'error');
  assert.ok(versions.details.includes('@bitakit/ui@0.1.0'));
  assert.match(versions.fix, /npm install .*@bitakit\/ui@latest/);
  const aliases = find(results, /Service aliases collide/);
  assert.equal(aliases.status, 'error');
  assert.deepEqual(aliases.details, [
    'plugin "a" (src/plugins/a/services/items.ts) and plugin "b" (src/plugins/b/services/items.ts) both expose a service as "items".',
  ]);
  const links = find(results, /Some navigation links lead nowhere/);
  assert.equal(links.status, 'warn');
  assert.deepEqual(links.details, [
    'plugin "b" links to /missing (src/plugins/b/actions/open.ts), but no page or route exists there.',
  ]);
  assert.equal(status(results, /The plugin page can be reached/), 'ok');
  const ignored = find(results, /ignored by discovery/);
  assert.equal(ignored.status, 'warn');
  assert.equal(ignored.details.length, 1);
  assert.match(ignored.details[0], /^src\/plugins\/b\/actions\/helper\.ts .*no default export/);
  assert.match(ignored.fix, /default export/);
  assert.doesNotMatch(ignored.fix, /migrate/);
  const deprecated = find(results, /2 files use a deprecated layout/);
  assert.equal(deprecated.status, 'warn');
  assert.ok(
    deprecated.details.some((detail) => detail.startsWith('src/plugins/c/actions/add.action.ts')),
  );
  assert.ok(deprecated.details.some((detail) => detail.startsWith('src/plugins/c/pages/c.tsx')));
  assert.match(deprecated.fix, /npx bitakit migrate/);
});

test('doctor names the app module by its configured ID and detects routes that shadow plugin pages', async (t) => {
  const root = await project(
    nextApp({
      'src/plugin.config.ts': "export default { id: 'myapp' };\n",
      'src/ui/pages/about.tsx': 'export default function About() { return null; }\n',
      'src/app/about/page.tsx': 'export default function Page() {}\n',
      'src/plugins/notes/ui/pages/index.tsx': 'export default function Notes() { return null; }\n',
      'src/app/(app)/notes/page.tsx': 'export default function Page() {}\n',
      ...catchAll,
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const pages = find(results, /plugin pages cannot be reached/);
  assert.equal(pages.status, 'error');
  assert.deepEqual(pages.details, [
    'the app has a page at /about, but the app route src/app/about/page.tsx takes precedence.',
    'plugin "notes" has a page at /notes, but the app route src/app/(app)/notes/page.tsx takes precedence.',
  ]);
  assert.equal(pages.fix, undefined);
});

test('doctor checks TanStack Start wiring and suggests the $ route', async (t) => {
  const files = {
    'package.json': {
      name: 'start',
      dependencies: { '@tanstack/react-start': '1.0.0', '@bitakit/core': '^0.2.0' },
    },
    'node_modules/@bitakit/core/package.json': { name: '@bitakit/core', version: '0.2.0' },
    'vite.config.ts':
      "import { bitakit } from '@bitakit/tanstack/config';\nexport default { plugins: [bitakit()] };\n",
    'src/routes/__root.tsx': "import { BitaKitProvider } from '../bitakit.gen';\n",
    'src/routes/index.tsx': 'export const Route = {};\n',
    'src/styles.css': "@import 'tailwindcss';\n@import './bitakit.gen.css';\n",
    'src/plugins/notes/ui/pages/index.tsx': 'export default function Notes() { return null; }\n',
    '.gitignore': 'src/bitakit.gen.*\n',
  };
  const root = await project(files, t);
  let { results } = await doctor({ cwd: root });
  assert.equal(status(results, /vite\.config runs the BitaKit plugin/), 'ok');
  assert.equal(status(results, /root layout mounts the BitaKit provider/), 'ok');
  const pages = find(results, /plugin pages cannot be reached/);
  assert.equal(pages.status, 'error');
  assert.match(
    pages.fix,
    /^Create src\/routes\/\$\.tsx:\n\nimport \{ createFileRoute \} from '@tanstack\/react-router';/,
  );
  assert.match(pages.fix, /createFileRoute\('\/\$'\)\(\{ component: \(\) => <PluginPage \/> \}\)/);
  await write(root, { 'src/routes/$.tsx': 'export const Route = {};\n' });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /The plugin page can be reached/), 'ok');

  const broken = await project(
    {
      ...files,
      'vite.config.ts': 'export default {};\n',
      'src/routes/__root.tsx': 'export const Route = {};\n',
    },
    t,
  );
  ({ results } = await doctor({ cwd: broken }));
  const config = find(results, /vite\.config does not run BitaKit discovery/);
  assert.equal(config.status, 'error');
  assert.match(config.fix, /import \{ bitakit \} from '@bitakit\/tanstack\/config';/);
  assert.equal(status(results, /No BitaKit provider in the root layout/), 'error');
});

test('doctor checks a plugin package manifest', async (t) => {
  const ready = await project(
    {
      'package.json': {
        name: '@acme/bitakit-notes',
        exports: {
          './package.json': './package.json',
          './plugin': { types: './dist/plugin.d.ts', default: './dist/plugin.js' },
        },
        bitakit: { plugin: './plugin' },
        peerDependencies: { '@bitakit/core': '^0.2.0' },
      },
      'node_modules/@bitakit/core/package.json': { name: '@bitakit/core', version: '0.2.0' },
    },
    t,
  );
  let { project: found, results } = await doctor({ cwd: ready });
  assert.equal(found.kind, 'plugin');
  assert.equal(status(results, /Plugin package "notes" is ready to publish/), 'ok');
  assert.ok(results.every((result) => result.status === 'ok'));

  const broken = await project(
    {
      'package.json': {
        name: 'notes-plugin',
        exports: {},
        foundation: { plugin: './plugin' },
        dependencies: { '@bitakit/core': '^0.2.0' },
      },
    },
    t,
  );
  ({ results } = await doctor({ cwd: broken }));
  const manifest = find(results, /Plugin package manifest needs changes/);
  assert.equal(manifest.status, 'error');
  assert.deepEqual(manifest.details, [
    'Export "./package.json" so apps can read the bitakit metadata.',
    'Export ./plugin (the plugin entry named in bitakit.plugin).',
    'Move @bitakit/core from dependencies to peerDependencies to avoid a second copy.',
    'Add @bitakit/core to peerDependencies.',
    'Rename the "foundation" field in package.json to "bitakit".',
  ]);
  assert.equal(status(results, /No @bitakit packages installed/), 'warn');
});

test('doctor reports a configuration that cannot be loaded instead of crashing', async (t) => {
  const legacy = await project(
    nextApp({
      'foundation.config.ts':
        "import { defineFoundation } from '@bitakit/next/config';\nexport default defineFoundation({});\n",
    }),
    t,
  );
  let { results } = await doctor({ cwd: legacy });
  const config = find(results, /foundation\.config\.ts could not be loaded/);
  assert.equal(config.status, 'error');
  assert.match(config.details[0], /@bitakit\/next\/config/);
  assert.match(config.fix, /npx bitakit migrate/);
  assert.equal(find(results, /plugin page/), undefined);

  const current = await project(
    nextApp({
      'bitakit.config.ts': "export default { plugins: { directory: './src/features' } ;\n",
    }),
    t,
  );
  ({ results } = await doctor({ cwd: current }));
  const broken = find(results, /bitakit\.config\.ts could not be loaded/);
  assert.equal(broken.status, 'error');
  assert.doesNotMatch(broken.fix, /migrate/);

  const deprecated = await project(nextApp({ 'foundation.config.ts': 'export default {};\n' }), t);
  ({ results } = await doctor({ cwd: deprecated }));
  const notice = find(results, /foundation\.config\.ts is deprecated/);
  assert.equal(notice.status, 'warn');
  assert.match(notice.fix, /bitakit migrate/);
  assert.equal(status(results, /deprecated layout/), 'warn');
});
