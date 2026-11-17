import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { identity, mountPlugin, mountServer } from '../testing/index.mjs';
import { definePlugin, isBitaKitStartupError, isOperationError } from '../dist/core.js';
import { defineService, requestContext } from '../dist/server/index.js';

const core = fileURLToPath(new URL('..', import.meta.url));

/** A project inside Core, so its files resolve @bitakit/core and zod from the workspace. */
async function project(files, run) {
  const root = await mkdtemp(path.join(core, '.copy-'));
  const cwd = process.cwd();
  try {
    for (const [file, source] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), source);
    }
    // Sources are named relative to the working directory, as from an app root.
    process.chdir(root);
    await run(root);
  } finally {
    process.chdir(cwd);
    await rm(root, { recursive: true, force: true });
  }
}

/** Rejects with an OperationError of `code` (and `reason`, when given). */
const refused = (promise, code, reason) =>
  assert.rejects(promise, (error) => {
    assert.ok(isOperationError(error), `expected an OperationError, got ${error}`);
    assert.equal(error.code, code);
    if (reason) assert.equal(error.reason, reason);
    return true;
  });

/**
 * A todos plugin with a server half that imports the app's `@/server/db` and an extensionless
 * `./helpers`, next to client files, UI and server code that must never be mounted.
 */
const todos = {
  'package.json': JSON.stringify({ name: 'demo', type: 'module' }),
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      strict: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM'],
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      paths: { '@/*': ['./src/*'] },
    },
  }),
  'src/server/db.ts': `export const rows = new Map<string, string[]>();
`,
  'src/plugins/todos/events.ts': `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ added: event<{ title: string }>() });
`,
  'src/plugins/todos/configs/limits.ts': `export default { max: 10 };
`,
  'src/plugins/todos/server/helpers.ts': `export const clean = (title: string) => title.trim();
`,
  // A dotted flat file: server/actions.add.ts is the operation todos.add.
  'src/plugins/todos/server/actions.add.ts': `import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';
import { rows } from '@/server/db';
import { clean } from './helpers';

export default defineAction({
  access: 'organization',
  expose: true,
  input: z.object({ title: z.string().min(1) }),
  output: z.object({ titles: z.array(z.string()) }),
  execute: ({ input, ctx, events, config }) => {
    const list = rows.get(ctx.organization.id) ?? [];
    if (list.length >= config.plugin.get('limits.max', 10)) throw new Error('full');
    list.push(clean(input.title));
    rows.set(ctx.organization.id, list);
    events.emit('todos.added', { title: input.title });
    return { titles: [...list], secret: 'stripped by output' };
  },
});
`,
  // Private (no expose), and reads the same @/server/db module through a service.
  'src/plugins/todos/server/actions/count.ts': `import { defineAction } from '@bitakit/core/server';

export default defineAction({
  access: 'organization',
  execute: ({ ctx, services }) => services.todos.store.count(ctx.organization.id),
});
`,
  'src/plugins/todos/server/actions/purge.ts': `import { defineAction } from '@bitakit/core/server';
import { rows } from '@/server/db';

export default defineAction({
  access: { permission: { todos: ['delete'] } },
  execute: ({ ctx }) => {
    rows.delete(ctx.organization.id);
  },
});
`,
  'src/plugins/todos/server/actions/whoami.ts': `import { defineAction } from '@bitakit/core/server';

export default defineAction({
  access: 'user',
  execute: ({ ctx }) => ({ user: ctx.user.id }),
});
`,
  'src/plugins/todos/server/services/store.ts': `import { defineService } from '@bitakit/core/server';
import { rows } from '@/server/db';

export default defineService(({ events }) => {
  const seen: string[] = [];
  events.on('todos.added', (event, { ctx }) => seen.push(\`\${ctx?.organization?.id}:\${event.data.title}\`));
  return { seen, count: (organization: string) => rows.get(organization)?.length ?? 0 };
});
`,
  'src/plugins/todos/server/interceptors/audit.ts': `import { defineInterceptor } from '@bitakit/core/server';

export default defineInterceptor({
  action: 'todos.*',
  before: ({ input, ctx }) => {
    if ((input as { title?: string } | undefined)?.title === 'blocked') return false;
    (globalThis as any).__audit?.push(ctx.user?.id ?? 'anonymous');
  },
});
`,
  // Client half: never part of the server, and it holds JSX the server loader must not read.
  'src/plugins/todos/actions/add.ts': `import { defineAction } from '@bitakit/core';

export default defineAction<{ title: string }>({
  title: 'Add',
  execute: ({ input, remote }) => remote.todos.add(input),
});
`,
  'src/plugins/todos/services/items.ts': `throw new Error('client services never load on the server');
`,
  'src/plugins/todos/ui/pages/index.tsx': `export default () => <main />;
`,
  'src/plugins/todos/setup.ts': `throw new Error('setup.ts never loads on the server');
`,
  // The module's own server code that is not a server kind: never imported by mountServer.
  'src/plugins/todos/server/routes.ts': `throw new Error('server/routes.ts is not a server kind');
`,
};

test('mountServer loads the shared files and server/ half, with @/ aliases and extensionless imports', () =>
  project(todos, async () => {
    globalThis.__audit = [];
    const mounted = await mountServer('src/plugins/todos');
    try {
      assert.equal(mounted.id, 'todos');
      assert.deepEqual(
        (await mounted.server.operations()).map((item) => `${item.id}:${item.exposed}`).sort(),
        ['todos.add:true', 'todos.count:false', 'todos.purge:false', 'todos.whoami:false'],
        'only server/actions are operations; the client button todos.add is not mounted',
      );
      const member = mounted.as(identity({ organization: 'org-1' }));
      assert.deepEqual(await member.todos.add({ title: ' First ' }), { titles: ['First'] });
      // The service reads the same @/server/db module instance the Action wrote.
      assert.equal(await member.todos.count(), 1, 'private operations are callable in-process');
      assert.deepEqual(globalThis.__audit, ['user-1', 'user-1']);

      // Another organization sees only its own rows.
      const other = mounted.as(identity({ user: 'user-2', organization: 'org-2' }));
      assert.equal(await other.todos.count(), 0);
      assert.deepEqual(await other.todos.add({ title: 'Theirs' }), { titles: ['Theirs'] });
      // A page loaded for org-1 that now runs under org-2 conflicts instead of writing.
      await refused(
        other.todos.add({ title: 'Stale' }, { organizationId: 'org-1' }),
        'CONFLICT',
        'ORGANIZATION_CHANGED',
      );

      await refused(mounted.as(identity({ user: null })).todos.add({ title: 'x' }), 'UNAUTHORIZED');
      await refused(
        mounted.as(identity()).todos.add({ title: 'x' }),
        'FORBIDDEN',
        'NO_ACTIVE_ORGANIZATION',
      );
      await refused(
        mounted.as(identity({ reason: 'NOT_A_MEMBER' })).todos.add({ title: 'x' }),
        'FORBIDDEN',
        'NOT_A_MEMBER',
      );
      assert.deepEqual(await mounted.as(identity({ user: { id: 'u-9' } })).todos.whoami(), {
        user: 'u-9',
      });
      await refused(member.todos.add({ title: '' }), 'BAD_REQUEST');
      await refused(member.todos.add({ title: 'blocked' }), 'FORBIDDEN', 'INTERCEPTED');
    } finally {
      await mounted.stop();
      delete globalThis.__audit;
    }
    await refused(
      mounted.as(identity({ organization: 'org-1' })).todos.count(),
      'SERVICE_UNAVAILABLE',
    );
  }));

test('identity() grants exactly the listed permissions', () =>
  project(todos, async () => {
    const mounted = await mountServer('src/plugins/todos');
    try {
      const purge = (permissions) =>
        mounted.as(identity({ organization: 'org-1', permissions })).todos.purge();
      assert.equal(await purge({ todos: ['delete'] }), undefined);
      assert.equal(await purge({ todos: ['create', 'delete'] }), undefined);
      assert.equal(await purge({ todos: '*' }), undefined);
      assert.equal(await purge('*'), undefined);
      await refused(purge({ todos: ['create'] }), 'FORBIDDEN', 'PERMISSION');
      await refused(purge({ notes: ['delete'] }), 'FORBIDDEN', 'PERMISSION');
      await refused(purge(undefined), 'FORBIDDEN', 'PERMISSION');
    } finally {
      await mounted.stop();
    }
    const granted = identity({ organization: 'org-1', permissions: { todos: ['read'] } });
    assert.equal(granted.can({ todos: ['read'] }), true);
    assert.equal(granted.can({ todos: ['read', 'write'] }), false);
    assert.equal(granted.can({}), false, 'an empty request grants nothing');
    assert.equal(identity().can({ todos: ['read'] }), false);
    assert.deepEqual(
      { ...identity({ organization: { id: 'org-3' }, member: { role: 'owner' } }), can: null },
      {
        user: { id: 'user-1' },
        organization: { id: 'org-3' },
        member: { role: 'owner' },
        can: null,
      },
    );
    assert.throws(() => identity({ permissions: ['todos'] }), /permissions is '\*'/);
    assert.throws(() => identity({ permissions: { todos: 'read' } }), /permissions is '\*'/);
  }));

test('configOverrides, further plugin folders and events with ctx reach the mounted server', () =>
  project(
    {
      ...todos,
      'src/plugins/activity/server/services/feed.ts': `import { defineService } from '@bitakit/core/server';

export default defineService(({ events }) => {
  const entries: string[] = [];
  events.on('todos.added', (event, { ctx }) => entries.push(\`\${ctx?.user?.id} added \${event.data.title}\`));
  return { entries };
});
`,
      'src/plugins/activity/server/actions/list.ts': `import { defineAction } from '@bitakit/core/server';

export default defineAction({ access: 'user', execute: ({ services }) => services.activity.feed.entries });
`,
    },
    async () => {
      const mounted = await mountServer('src/plugins/todos', {
        plugins: ['src/plugins/activity'],
        configOverrides: { todos: { limits: { max: 1 } } },
      });
      try {
        const member = mounted.as(identity({ organization: 'org-1' }));
        await member.todos.add({ title: 'One' });
        await refused(member.todos.add({ title: 'Two' }), 'INTERNAL_SERVER_ERROR');
        assert.deepEqual(await member.activity.list(), ['user-1 added One']);
      } finally {
        await mounted.stop();
      }
    },
  ));

test('the test requestContext provider replaces one the mounted folders declare', () =>
  project(
    {
      ...todos,
      // A real provider would read a session; it must not decide who calls in tests.
      'src/server/services/request-context.ts': `import { defineService, requestContext } from '@bitakit/core/server';

export default defineService(
  () => ({ resolve: () => ({ user: { id: 'everyone' }, organization: { id: 'org-1' } }) }),
  { provides: requestContext },
);
`,
      'src/server/actions/whoami.ts': `import { defineAction } from '@bitakit/core/server';

export default defineAction({ access: 'user', expose: true, execute: ({ ctx }) => ctx.user.id });
`,
    },
    async () => {
      // The app module brings its own provider; its operations are unprefixed, as in the
      // generated server file.
      const app = await mountServer('src');
      try {
        assert.equal(app.id, 'app');
        assert.deepEqual(
          (await app.server.operations()).map((item) => item.id),
          ['whoami'],
          'the app module is not a plugin named after the package',
        );
        assert.equal(await app.as(identity({ user: 'u-7' })).whoami(), 'u-7');
        await refused(app.as(identity({ user: null })).whoami(), 'UNAUTHORIZED');
      } finally {
        await app.stop();
      }
      // app: false mounts the same folder as a plugin.
      const plugin = await mountServer('src', { id: 'app-under-test', app: false });
      try {
        assert.equal(await plugin.as(identity({ user: 'u-7' }))['app-under-test'].whoami(), 'u-7');
      } finally {
        await plugin.stop();
      }
      // A Plugin object that provides requestContext is left out the same way.
      const stub = definePlugin({
        id: 'session',
        services: {
          context: defineService(() => ({ resolve: () => ({ user: { id: 'everyone' } }) }), {
            provides: requestContext,
          }),
        },
      });
      const mounted = await mountServer('src/plugins/todos', { plugins: [stub] });
      try {
        await refused(
          mounted.as(identity({ user: null })).todos.whoami(),
          'UNAUTHORIZED',
          undefined,
        );
      } finally {
        await mounted.stop();
      }
      await assert.rejects(
        mountServer('src/plugins/todos', { services: { requestContext: {} } }),
        /mountServer provides requestContext itself/,
      );
      const plain = await mountServer('src/plugins/todos');
      try {
        assert.throws(() => plain.as(), /as\(\) takes an identity/);
      } finally {
        await plain.stop();
      }
    },
  ));

test('a server half that fails to start rejects with the attributed startup error', () =>
  project(
    {
      ...todos,
      'src/plugins/todos/server/actions/open.ts': `import { defineAction } from '@bitakit/core/server';

export default defineAction({ access: 'user', href: '/todos', execute: () => {} } as never);
`,
    },
    async () => {
      await assert.rejects(mountServer('src/plugins/todos'), (error) => {
        assert.ok(isBitaKitStartupError(error));
        assert.match(error.message, /server:todos\.open/);
        assert.match(error.message, /href/);
        return true;
      });
    },
  ));

test('the app folder of bitakit.config.ts mounts as the app module, with its configured ID', () =>
  project(
    {
      ...todos,
      'bitakit.config.ts': "export default { directory: './app' };\n",
      'app/plugin.config.ts': "export default { id: 'host' };\n",
      'app/server/actions/health.ts': `import { defineAction } from '@bitakit/core/server';

export default defineAction({ access: 'public', execute: () => 'ok' });
`,
    },
    async () => {
      const mounted = await mountServer('app', { plugins: ['src/plugins/todos'] });
      try {
        assert.equal(mounted.id, 'host');
        assert.equal(await mounted.as(identity({ user: null })).health(), 'ok');
        assert.deepEqual(
          await mounted.as(identity({ organization: 'org-1' })).todos.add({ title: 'A' }),
          {
            titles: ['A'],
          },
        );
      } finally {
        await mounted.stop();
      }
      // With directory: './app', src is an ordinary folder: a plugin named after the package.
      const src = await mountServer('src', { plugins: [] });
      try {
        assert.equal(src.id, 'demo');
      } finally {
        await src.stop();
      }
    },
  ));

test('a folder keeps only its dependencies on mounted modules, as the generated server file does', () =>
  project(
    {
      ...todos,
      // shell is a package plugin: it has no server half to mount.
      'src/plugins/todos/plugin.config.ts':
        "export default { dependencies: ['shell', 'activity'] };\n",
      'src/plugins/activity/plugin.config.ts':
        "export default { dependencies: ['organizations', 'todos'] };\n",
      'src/plugins/activity/server/services/feed.ts': `import { defineService } from '@bitakit/core/server';

export default defineService(() => ({ entries: [] as string[] }));
`,
    },
    async () => {
      const alone = await mountServer('src/plugins/todos');
      try {
        assert.deepEqual(
          await alone.as(identity({ organization: 'org-1' })).todos.add({ title: 'A' }),
          {
            titles: ['A'],
          },
        );
      } finally {
        await alone.stop();
      }
      // Dependencies on mounted folders stay: todos and activity name each other, a cycle.
      await assert.rejects(
        mountServer('src/plugins/todos', { plugins: ['src/plugins/activity'] }),
        (error) => {
          assert.ok(isBitaKitStartupError(error));
          assert.match(error.message, /cycle|circular/i);
          return true;
        },
      );
    },
  ));

test('import() returns the module instance the mounted Actions and services use', () =>
  project(
    {
      ...todos,
      'src/plugins/shelf/server/store.ts': `export const items: string[] = [];
`,
      'src/plugins/shelf/server/actions/add.ts': `import { defineAction } from '@bitakit/core/server';
import { items } from '../store';

export default defineAction({ access: 'user', execute: () => items.push('one') });
`,
    },
    async (root) => {
      const mounted = await mountServer('src/plugins/shelf');
      try {
        const { items } = await mounted.import('src/plugins/shelf/server/store.ts');
        items.push('seeded');
        assert.equal(
          await mounted.as(identity()).shelf.add(),
          2,
          'the Action sees the seeded item',
        );
        assert.deepEqual(items, ['seeded', 'one']);
        // The same instance by an absolute path, a ./ path and the tsconfig alias.
        assert.equal(
          (await mounted.import(path.join(root, 'src/plugins/shelf/server/store.ts'))).items,
          items,
        );
        assert.equal((await mounted.import('./src/plugins/shelf/server/store')).items, items);
        const db = await mounted.import('@/server/db');
        assert.ok(db.rows instanceof Map);
      } finally {
        await mounted.stop();
      }
    },
  ));

test('server-only contribution kinds load from bitakit.config.ts and options.kinds', () =>
  project(
    {
      ...todos,
      'bitakit.config.ts': `export default {
  kinds: [
    { name: 'tasks', directory: 'tasks', from: './kinds/tasks', normalize: 'discoverTasks', runtime: 'server' },
    // A client kind's files are not part of the server.
    { name: 'widgets', directory: 'widgets', from: './kinds/tasks', normalize: 'discoverTasks' },
  ],
};
`,
      'src/kinds/tasks.ts': `export const discoverTasks = (files: { path: string; value: unknown }[], moduleId: string) =>
  files.map((file) => ({ id: \`\${moduleId}.\${file.path}\`, value: file.value }));
`,
      'src/plugins/todos/server/contributions/tasks/nightly.ts': `export default { cron: '0 3 * * *' };
`,
      'src/plugins/todos/server/contributions/jobs/sweep.ts': `export default { every: 'hour' };
`,
      'src/plugins/todos/contributions/widgets/badge.ts': `throw new Error('client kinds never load on the server');
`,
    },
    async () => {
      const installed = [];
      const host = definePlugin({
        id: 'kind-host',
        installs: {
          tasks: (values, { module }) => void installed.push({ module, values }),
          jobs: (values, { module }) => void installed.push({ module, values }),
        },
      });
      const mounted = await mountServer('src/plugins/todos', { plugins: [host] });
      await mounted.stop();
      assert.deepEqual(installed, [
        { module: 'todos', values: [{ id: 'todos.nightly', value: { cron: '0 3 * * *' } }] },
      ]);
      // A kind a package declares through its discovery hook is passed explicitly.
      installed.length = 0;
      const withJobs = await mountServer('src/plugins/todos', {
        plugins: [host],
        kinds: [
          {
            name: 'jobs',
            directory: 'jobs',
            from: './kinds/tasks',
            normalize: 'discoverTasks',
            runtime: 'server',
          },
        ],
      });
      await withJobs.stop();
      assert.deepEqual(installed.map((entry) => entry.values[0].id).sort(), [
        'todos.nightly',
        'todos.sweep',
      ]);
      await assert.rejects(
        mountServer('src/plugins/todos', {
          kinds: [
            {
              name: 'tasks',
              directory: 'tasks',
              from: './kinds/tasks',
              normalize: 'missing',
              runtime: 'server',
            },
          ],
        }),
        /Contribution kind "tasks": \.\/kinds\/tasks has no export missing\./,
      );
    },
  ));

/** The same plugin with a client half that starts under `mountPlugin`. */
const client = {
  ...todos,
  'src/plugins/todos/services/items.ts': `import { defineService } from '@bitakit/core';
export default defineService(({ store }) => ({ state: store({ titles: [] as string[] }) }));
`,
  'src/plugins/todos/setup.ts': 'export default () => {};\n',
};

test('mountPlugin({ remote }) lets the client half call its real server half in-process', () =>
  project(client, async () => {
    const server = await mountServer('src/plugins/todos');
    const client = await mountPlugin('src/plugins/todos', {
      remote: server.as(identity({ organization: 'org-1' })),
    });
    try {
      assert.deepEqual(await client.execute('add', { title: 'From the button' }), {
        status: 'completed',
        value: { titles: ['From the button'] },
      });
    } finally {
      await client.stop();
      await server.stop();
    }
    // A stub works the same way.
    const calls = [];
    const stubbed = await mountPlugin('src/plugins/todos', {
      remote: { todos: { add: async (input) => (calls.push(input), { titles: [] }) } },
    });
    try {
      assert.equal((await stubbed.execute('add', { title: 'Stubbed' })).status, 'completed');
      assert.deepEqual(calls, [{ title: 'Stubbed' }]);
    } finally {
      await stubbed.stop();
    }
  }));

test('mountServer names the discovery version it needs when describeModule reports no server/ folder', async () => {
  // A copy of the testing entry next to a discovery stub from before server/ folders.
  const root = await mkdtemp(path.join(core, '.copy-'));
  try {
    const stub = path.join(root, 'node_modules/@bitakit/discovery');
    await mkdir(stub, { recursive: true });
    await writeFile(
      path.join(stub, 'package.json'),
      JSON.stringify({
        name: '@bitakit/discovery',
        version: '0.3.0',
        type: 'module',
        main: 'index.mjs',
      }),
    );
    await writeFile(
      path.join(stub, 'index.mjs'),
      `export const packagePluginId = (name) => name;
export const loadDiscoveryConfig = async () => ({ config: {}, file: undefined, legacy: false });
export async function describeModule(directory) {
  return { directory, actions: [], services: [], events: [], settings: [], configs: [], interceptors: [], slotDefinitions: [], warnings: [] };
}
`,
    );
    await mkdir(path.join(root, 'testing'));
    await symlink(path.join(core, 'dist'), path.join(root, 'dist'), 'dir');
    await writeFile(
      path.join(root, 'testing/index.mjs'),
      await import('node:fs/promises').then(({ readFile }) =>
        readFile(path.join(core, 'testing/index.mjs'), 'utf8'),
      ),
    );
    await mkdir(path.join(root, 'plugins/todos'), { recursive: true });
    const { mountServer: oldMount } = await import(path.join(root, 'testing/index.mjs'));
    await assert.rejects(
      oldMount(path.join(root, 'plugins/todos')),
      /mountServer needs @bitakit\/discovery 0\.3\.1 or newer/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the testing types: as() calls every operation with typed input, also as a client remote', () =>
  project(
    {
      ...todos,
      // Only the test file is checked; the fixture's own sources are covered by the tests above.
      'tsconfig.types.json': JSON.stringify({
        extends: './tsconfig.json',
        files: ['tests/types.ts'],
      }),
      'tests/types.ts': `import { identity, mountPlugin, mountServer } from '@bitakit/core/testing';

declare module '@bitakit/core' {
  interface ServerActionMap {
    'todos.add': { input: { title: string }; result: { titles: string[] }; exposed: true };
    'todos.count': { input: undefined; result: number; exposed: false };
  }
}

export async function check() {
  const mounted = await mountServer('src/plugins/todos', { configOverrides: { todos: {} } });
  const caller = mounted.as(identity({ organization: 'org-1', permissions: { todos: ['delete'] } }));
  const added: { titles: string[] } = await caller.todos.add({ title: 'A' }, { organizationId: 'org-1' });
  const count: number = await caller.todos.count();
  // @ts-expect-error The input follows the operation's schema.
  await caller.todos.add({ name: 'A' });
  // @ts-expect-error permissions list operations per resource.
  identity({ permissions: { todos: 'delete' } });
  await mountPlugin('src/plugins/todos', { remote: caller });
  const db = await mounted.import<typeof import('../src/server/db.ts')>('src/server/db.ts');
  const rows: Map<string, string[]> = db.rows;
  await mounted.stop();
  const app = await mountServer('src', {
    app: true,
    kinds: [{ name: 'tasks', directory: 'tasks', from: './kinds', normalize: 'n', runtime: 'server' }],
  });
  // @ts-expect-error A kind's runtime is client, server or both.
  await mountServer('src', { kinds: [{ name: 'x', directory: 'x', from: 'y', normalize: 'z', runtime: 'edge' }] });
  await app.stop();
  void [added, count, rows];
}
`,
    },
    async (root) => {
      const tsc = fileURLToPath(
        new URL('../../../node_modules/typescript/bin/tsc', import.meta.url),
      );
      const result = await promisify(execFile)(
        process.execPath,
        [tsc, '--noEmit', '-p', 'tsconfig.types.json'],
        { cwd: root },
      ).catch((error) => error);
      assert.equal(result.code ?? 0, 0, `${result.stdout}${result.stderr}`);
    },
  ));
