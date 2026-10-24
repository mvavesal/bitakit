import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlugin, doctor } from '../src/index.mjs';
import { releaseVersion, catchAll, find, nextApp, project, status, write } from './helpers.mjs';

test('doctor passes a wired app once a route renders its plugin pages', async (t) => {
  const root = await project(
    {
      ...nextApp(),
      // A private workspace app linked into node_modules is not a published package.
      'node_modules/@bitakit/web/package.json': {
        name: '@bitakit/web',
        version: '0.1.0',
        private: true,
      },
    },
    t,
  );
  await addPlugin('notes', { cwd: root });
  let { results } = await doctor({ cwd: root });
  assert.equal(status(results, new RegExp(`All 2 @bitakit packages are ${releaseVersion}`)), 'ok');
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

test('doctor follows the root CSS import, including alternative filenames and nested imports', async (t) => {
  const root = await project(
    nextApp({
      'src/app/layout.tsx':
        "import './styles.css'; export default function Layout() { return null; }",
      'src/app/styles.css': "@import './packages.css';",
      'src/app/packages.css': "@import '../bitakit.gen.css';",
    }),
    t,
  );
  let { results } = await doctor({ cwd: root });
  const styles = find(results, /Package styles are imported in src\/app\/styles.css/);
  assert.equal(styles.status, 'ok');
  assert.match(styles.details[0], /Static.*browser verification/);
  await write(root, { 'src/app/packages.css': "/* @import '../bitakit.gen.css'; */" });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /Installed packages ship styles that are not imported/), 'warn');
  await write(root, {
    'src/app/layout.tsx':
      "// import './globals.css';\nexport default function Layout() { return null; }",
  });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /Installed packages ship styles that are not imported/), 'warn');
});

test('doctor follows rendered provider wrappers but ignores unused provider imports', async (t) => {
  const root = await project(
    nextApp({
      'src/app/layout.tsx':
        "import { Providers } from '@/components/providers'; export default function Layout({ children }) { return <Providers>{children}</Providers>; }",
      'src/components/providers.tsx':
        "import { BitaKitProvider as Root } from '@/bitakit.gen'; export function Providers({ children }) { return <Root>{children}</Root>; }",
    }),
    t,
  );
  let { results } = await doctor({ cwd: root });
  assert.equal(status(results, /root layout mounts the BitaKit provider/), 'ok');
  await write(root, {
    'src/components/providers.tsx':
      "import { BitaKitProvider } from '@/bitakit.gen'; export function Providers({ children }) { return children; }",
  });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /No BitaKit provider in the root layout/), 'error');
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

test('doctor accepts different patch versions on one release line', async (t) => {
  const root = await project(
    nextApp({
      'node_modules/@bitakit/core/package.json': { name: '@bitakit/core', version: '0.2.2' },
      'node_modules/@bitakit/cli/package.json': { name: '@bitakit/cli', version: '0.2.3' },
      ...catchAll,
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const versions = find(results, /@bitakit packages are on the 0\.2\.x release line/);
  assert.equal(versions.status, 'ok');
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
    'src/routes/__root.tsx':
      "import { BitaKitProvider } from '../bitakit.gen'; export function Root({ children }) { return <BitaKitProvider>{children}</BitaKitProvider>; }\n",
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
});

const service = (options = '{}', body = '() => ({})') =>
  `import { defineService } from '@bitakit/core';\nexport default defineService(${body}, ${options});\n`;

test('doctor checks that every requires entry names a service, an alias, a contract or a provider', async (t) => {
  const root = await project(
    nextApp({
      'bitakit.config.ts':
        'export default { plugins: { overrides: { archive: { enabled: false } } } };\n',
      'src/plugins/todos/services/items.ts': service("{ exposeAs: 'todo-items' }"),
      'src/plugins/todos/services/stats.ts': service(
        "{ requires: ['todos.items', 'todos.itmes'] }",
      ),
      'src/plugins/todos/actions/open.ts':
        "import { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'Open', requires: ['todos.items', 'todos.gone'], execute: () => {} });\n",
      // A local plugin named like a contract does not turn the flat name "auth" into one of its IDs.
      'src/plugins/auth/plugin.config.ts': 'export default {};\n',
      'src/plugins/notes/services/feed.ts': service(
        "{ requires: ['todo-items', 'archive.store', 'billing.invoices', 'auth'] }",
      ),
      'src/plugins/notes/ui/providers/query.tsx':
        "export default () => null;\nexport const requires = ['notes.feed', 'notes.missing'];\n",
      'src/plugins/archive/services/store.ts': service(),
    }),
    t,
  );
  let { results } = await doctor({ cwd: root });
  const wiring = find(results, /required services are not provided/);
  assert.equal(wiring.status, 'error');
  // Names in a local namespace are checked exactly, also against disabled plugins. "billing.invoices"
  // is not local and the installed Shell package could provide it, so it passes.
  assert.deepEqual(wiring.details, [
    'plugin "notes" requires "archive.store" (src/plugins/notes/services/feed.ts), but plugin "archive", which provides it, is disabled.',
    'plugin "notes" requires "notes.missing" (src/plugins/notes/ui/providers/query.tsx), but no provider, service, alias or contract has that name. Available in "notes": notes.feed, notes.query.',
    'plugin "todos" requires "todos.itmes" (src/plugins/todos/services/stats.ts), but no service, alias or contract has that name. Available in "todos": todos.items, todos.stats.',
    'plugin "todos" requires "todos.gone" (src/plugins/todos/actions/open.ts), but no service, alias or contract has that name. Available in "todos": todos.items, todos.stats.',
  ]);
  assert.match(wiring.fix, /enable the plugin that provides it/);

  await write(root, {
    'src/plugins/todos/services/stats.ts': service("{ requires: ['todos.items'] }"),
    'src/plugins/todos/actions/open.ts':
      "import { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'Open', requires: ['todos.items'], execute: () => {} });\n",
    'src/plugins/notes/services/feed.ts': service(
      "{ requires: ['todo-items', 'billing.invoices', 'auth'] }",
    ),
    'src/plugins/notes/ui/providers/query.tsx':
      "export default () => null;\nexport const requires = ['notes.feed'];\n",
  });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /All 6 service requirements can be satisfied/), 'ok');

  // Without installed plugin packages every name is checked; provided keys satisfy requirements.
  const bare = await project(
    nextApp({
      'package.json': {
        name: 'bare',
        dependencies: { next: '16.0.0', '@bitakit/core': '^0.2.0' },
      },
      'src/plugins/pay/services/gateway.ts':
        "import { defineService, serviceKey } from '@bitakit/core';\nconst payments = serviceKey<{}, 'payments'>('payments');\nexport default defineService(() => ({}), { provides: payments });\n",
      // The documented form keeps the name in the inner call: defineContract('ledger').of<T>().
      'src/plugins/pay/services/ledger.ts':
        "import { defineContract, defineService } from '@bitakit/core';\nconst ledger = defineContract('ledger').of<{}>();\nexport default defineService(() => ({}), { provides: ledger });\n",
      'src/plugins/shop/services/cart.ts': service(
        "{ requires: ['payments', 'pay.gateway', 'auth', 'billing.invoices', 'ledger'] }",
      ),
    }),
    t,
  );
  ({ results } = await doctor({ cwd: bare }));
  assert.deepEqual(find(results, /required services are not provided/).details, [
    'plugin "shop" requires "auth" (src/plugins/shop/services/cart.ts), but no service, alias or contract has that name.',
    'plugin "shop" requires "billing.invoices" (src/plugins/shop/services/cart.ts), but no service, alias or contract has that name.',
  ]);
  // A contract the app registers through the core key satisfies "auth"; a key whose name lives in
  // another file could provide anything, so the remaining names can no longer be judged.
  await write(bare, {
    'src/plugins/pay/services/session.ts':
      "import { authService, defineService } from '@bitakit/core';\nexport default defineService(() => ({}), { provides: authService });\n",
    'src/plugins/pay/services/other.ts':
      "import { defineService } from '@bitakit/core';\nimport { other } from '../keys';\nexport default defineService(() => ({}), { provides: other });\n",
  });
  ({ results } = await doctor({ cwd: bare }));
  assert.equal(status(results, /All 5 service requirements can be satisfied/), 'ok');
});

test('doctor reports plugin dependency cycles and enabled plugins that depend on disabled ones', async (t) => {
  const manifest = (dependencies) =>
    `export default { dependencies: ${JSON.stringify(dependencies)} };\n`;
  const root = await project(
    nextApp({
      'bitakit.config.ts':
        'export default { plugins: { overrides: { e: { enabled: false } } } };\n',
      'src/plugins/a/plugin.config.ts': manifest(['b']),
      'src/plugins/b/plugin.config.ts': manifest(['c']),
      'src/plugins/c/plugin.config.ts': manifest(['a']),
      // Installed plugin packages are not part of the local graph.
      'src/plugins/d/plugin.config.ts': manifest(['e', 'shell']),
      'src/plugins/e/plugin.config.ts': manifest([]),
    }),
    t,
  );
  let { results } = await doctor({ cwd: root });
  const cycle = find(results, /Plugin dependencies form a cycle/);
  assert.equal(cycle.status, 'error');
  assert.deepEqual(cycle.details, ['a → b → c → a']);
  assert.match(cycle.fix, /event, or with a shared service/);
  const disabled = find(results, /Enabled plugins depend on disabled plugins/);
  assert.equal(disabled.status, 'warn');
  assert.deepEqual(disabled.details, [
    'plugin "d" depends on "e", which is disabled, so "d" fails to start.',
  ]);
  assert.match(disabled.fix, /plugins\.overrides of bitakit\.config\.ts/);

  await write(root, {
    'bitakit.config.ts': 'export default {};\n',
    'src/plugins/c/plugin.config.ts': manifest([]),
  });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /Plugin dependencies are consistent/), 'ok');
  assert.equal(find(results, /form a cycle|disabled plugins/), undefined);
});

test('doctor reads slot contracts without executing source and attributes duplicate IDs', async (t) => {
  const root = await project(
    nextApp({
      'src/plugins/shell/slots/index.ts': `
      import { defineSlot as slot } from '@bitakit/core';
      throw new Error('must never execute');
      const footer = slot({ accepts: 'component' });
      export default { sidebar: { footer } };
    `,
      'src/plugins/notes/ui/slots/shell.sidebar.footer.tsx': 'export default () => null;',
    }),
    t,
  );
  let { results } = await doctor({ cwd: root });
  assert.equal(status(results, /Slot files target declared slots/), 'ok');
  await write(root, {
    'src/plugins/other/slots/logo.ts': `import { defineSlot } from '@bitakit/core'; export default defineSlot({ id: 'shell.sidebar.footer', accepts: 'component' });`,
  });
  ({ results } = await doctor({ cwd: root }));
  const duplicate = find(results, /Duplicate slot declarations/);
  assert.equal(duplicate.status, 'error');
  assert.match(
    duplicate.details.join(' '),
    /other\/slots\/logo.ts.*shell\/slots\/index.ts|shell\/slots\/index.ts.*other\/slots\/logo.ts/,
  );
});

test('doctor reports unresolved contracts and mismatched component targets honestly', async (t) => {
  const root = await project(
    nextApp({
      'src/slots/menu.ts': `import { defineSlot } from '@bitakit/core'; export default defineSlot({ accepts: 'actions' });`,
      'src/slots/dynamic.ts': 'export { default } from "./-shared";',
      'src/slots/-shared.ts': 'export default {}',
      'src/plugins/notes/ui/slots/menu.tsx': 'export default () => null;',
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const result = results.find((entry) =>
    entry.details?.some((item) => item.includes('contract accepts actions')),
  );
  assert.equal(result.status, 'warn');
  assert.match(result.details.join(' '), /Static inspection cannot resolve.*slots\/dynamic.ts/);
});

test('doctor reports an app whose Tailwind integration was lost, and accepts the Turbopack loader rule', async (t) => {
  const missing = await project({ ...nextApp(catchAll), 'postcss.config.mjs': '' }, t);
  const lost = find((await doctor({ cwd: missing })).results, /Tailwind does not compile/);
  assert.equal(lost.status, 'error');
  assert.match(lost.fix, /@tailwindcss\/turbopack/);
  const loader = await project(
    {
      ...nextApp(catchAll),
      'postcss.config.mjs': '',
      'next.config.ts':
        "import { withBitaKit } from '@bitakit/next/config';\n\nexport default withBitaKit({ turbopack: { rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } } });\n",
    },
    t,
  );
  assert.equal(
    status((await doctor({ cwd: loader })).results, /Tailwind compiles the app styles/),
    'ok',
  );
});

test('doctor asks for a decision on replaceable parts with several candidates', async (t) => {
  const layout = 'export default ({ children }) => children;\n';
  const root = await project(
    {
      ...nextApp(),
      'src/layouts/auth/split.tsx': layout,
      'src/layouts/auth/centered.tsx': layout,
      'src/slots/banner.ts':
        "import { defineSlot } from '@bitakit/core';\nexport default defineSlot({ accepts: 'component' });\n",
      'bitakit.config.ts':
        "export default { choose: { 'screen.nowhere': 'brand', banner: 'mine' } };\n",
    },
    t,
  );
  let { results } = await doctor({ cwd: root });
  const parts = find(results, /replaceable parts? need/);
  assert.equal(parts.status, 'warn');
  assert.deepEqual(parts.details, [
    'bitakit.config.ts chooses "brand" for "screen.nowhere", but no slot "screen.nowhere" exists.',
    'bitakit.config.ts chooses "mine" for "banner", a list slot; choose applies to single slots only.',
    '"layout.auth" has several candidates (app:centered, app:split) and renders its default.',
  ]);
  assert.match(parts.fix, /choose: \{ 'layout\.auth': 'split' \}/);

  await write(root, {
    'bitakit.config.ts': "export default { choose: { 'layout.auth': 'split' } };\n",
  });
  ({ results } = await doctor({ cwd: root }));
  assert.equal(status(results, /Replaceable parts are decided/), 'ok');
});
