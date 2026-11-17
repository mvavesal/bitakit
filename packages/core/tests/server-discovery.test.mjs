import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import ts from 'typescript';
import { generateBitaKit, describeBitaKit, describeModule } from '@bitakit/discovery';
// Internal module: the package exports only its public entry.
import { contributionKindSpecs, discoverEntries } from '../../discovery/src/entries.mjs';
import { createRuntime } from '../dist/core.js';

const coreRuntime = new URL('../dist/core.js', import.meta.url).pathname;
const coreServer = new URL('../dist/server/index.js', import.meta.url).pathname;
const coreTypes = new URL('../dist/core.d.ts', import.meta.url).pathname;
const serverTypes = new URL('../dist/server/index.d.ts', import.meta.url).pathname;
const actionTypes = new URL('../dist/actions/core.d.ts', import.meta.url).pathname;

/** A temporary project. The root is resolved so it matches the paths discovery reports. */
async function fixture(run) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'bitakit-server-discovery-')));
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
/**
 * The app's installed `@bitakit/core`, as discovery sees it: only the manifest. Code and types
 * resolve to this build through `loadGenerated` and `typeErrors`.
 */
const installCore = (put, { server = true } = {}) =>
  put(
    'node_modules/@bitakit/core/package.json',
    JSON.stringify({
      name: '@bitakit/core',
      version: server ? '0.3.2' : '0.3.1',
      exports: {
        '.': './dist/core.js',
        ...(server ? { './server': './dist/server/index.js' } : {}),
      },
    }),
  );
/** Strict TypeScript errors for generated output and consumers, against this build of Core. */
const typeErrors = (files, root) =>
  ts
    .getPreEmitDiagnostics(
      ts.createProgram(files, {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: root,
        paths: {
          '@bitakit/core': [coreTypes],
          '@bitakit/core/server': [serverTypes],
          '@bitakit/core/actions': [actionTypes],
        },
      }),
    )
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
/** Loads a generated file the way a bundler would, with `@bitakit/core` pointing at this build. */
const loadGenerated = (generated) =>
  createJiti(import.meta.url, {
    moduleCache: false,
    alias: { '@bitakit/core/server': coreServer, '@bitakit/core': coreRuntime },
  }).import(generated);
const stampOf = (source) => source.match(/stamp: "([0-9a-f]+)"/)?.[1];
const operationsOf = (source) => JSON.parse(source.match(/operations: (\[.*\]),/)[1]);

/** A todos plugin with a server half, an app server half and module code discovery leaves alone. */
async function todoApp(put) {
  await installCore(put);
  await put(
    'bitakit.config.ts',
    `export default { configOverrides: { todos: { limits: { max: 3 } } }, plugins: { overrides: { off: { enabled: false } } } };`,
  );
  await put(
    'src/plugins/todos/events.ts',
    `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ added: event<{ title: string }>() });
`,
  );
  await put(
    'src/plugins/todos/configs/limits.ts',
    `import { defineConfig } from '@bitakit/core';
export default defineConfig({ defaults: { max: 10 } });
`,
  );
  await put(
    'src/plugins/todos/server/services/store.ts',
    `import { defineService } from '@bitakit/core/server';
export default defineService(() => {
  const titles: string[] = [];
  return {
    add: (organization: string, title: string) => titles.push(\`\${organization}:\${title}\`),
    titles: () => [...titles],
  };
});
`,
  );
  await put(
    'src/plugins/todos/server/actions/add.ts',
    `import { defineAction } from '@bitakit/core/server';
// The button is actions/add.ts.
export default defineAction({
  access: 'organization',
  expose: true,
  input: {
    parse(value: unknown) {
      if (typeof (value as { title?: unknown })?.title !== 'string') throw new Error('A title is required.');
      return value as { title: string };
    },
  },
  execute: ({ input, ctx, services, events }) => {
    events.emit('todos.added', { title: input.title });
    return services.todos.store.add(ctx.organization.id, input.title);
  },
});
`,
  );
  await put(
    'src/plugins/todos/server/actions.ts',
    `import { defineAction } from '@bitakit/core/server';
export default {
  list: defineAction({ access: 'public', expose: true, execute: ({ services }) => services.todos.store.titles() }),
  count: defineAction({ access: 'public', execute: ({ services }) => services.todos.store.titles().length }),
};
`,
  );
  await put(
    'src/plugins/todos/server/actions.clear.ts',
    `import { defineAction } from '@bitakit/core/server';
const exposed = false;
export default defineAction({ access: 'user', expose: exposed, execute: () => 'cleared' as const });
`,
  );
  await put(
    'src/plugins/todos/server/interceptors/audit.ts',
    `import { defineInterceptor } from '@bitakit/core/server';
export default defineInterceptor({
  action: 'todos.*',
  before: ({ id, ctx }) => {
    ((globalThis as { __serverAudit?: string[] }).__serverAudit ??= []).push(\`\${id}:\${ctx.user?.id ?? 'anonymous'}\`);
  },
});
`,
  );
  // KnightCMS-style module code under server/: never imported, never reported.
  for (const file of ['extension.ts', 'routes.ts', 'content/index.ts'])
    await put(
      `src/plugins/todos/server/${file}`,
      'throw new Error("never imported"); export default {};',
    );
  await put('src/plugins/todos/server/schema.zmodel', 'model Todo { id String @id }');
  await put(
    'src/plugins/todos/actions/add.ts',
    `import { defineAction } from '@bitakit/core';
export default defineAction({ title: 'Add', execute: ({ remote }) => remote.todos.add({ title: 'From the button' }) });
`,
  );
  await put(
    'src/plugins/notes/events.ts',
    `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ saved: event<{ id: string }>() });
`,
  );
  await put(
    'src/plugins/off/server/actions/hidden.ts',
    `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', expose: true, execute: () => 'off' });
`,
  );
  await put(
    'src/server/services/request-context.ts',
    `import { defineService, requestContext } from '@bitakit/core/server';
export default defineService(
  () => ({
    resolve: (request: Request) => {
      const user = request.headers.get('x-user');
      return user ? { user: { id: user }, organization: { id: 'org-1' } } : { user: null };
    },
  }),
  { provides: requestContext },
);
`,
  );
  await put(
    'src/server/actions/ping.ts',
    `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', expose: true, execute: () => 'pong' as const });
`,
  );
  await put('src/server/db.ts', 'throw new Error("never imported"); export default {};');
}

test('the server file holds every enabled module with its server half; it loads, type-checks, answers and goes with the last server file', () =>
  fixture(async (root, put) => {
    await todoApp(put);
    const result = await generateBitaKit(root, { quiet: true });
    const serverFile = path.join(root, 'src/bitakit.gen.server.ts');
    assert.equal(result.server, serverFile);
    assert.deepEqual(result.warnings, []);
    const source = await readFile(serverFile, 'utf8');
    assert.match(source, /^\/\/ Generated by BitaKit\. Do not edit\.\n\/\/ Server only/);
    assert.doesNotMatch(source, /use client|react/i, 'server only: no client code');
    assert.doesNotMatch(source, /from '@bitakit\/core'/, 'imports only @bitakit/core/server');
    assert.doesNotMatch(source, /extension|routes|content\/index|zmodel|\/db'|hidden|"off"/);
    for (const entry of [
      /"ping": ServerActionEntry<typeof file\d+, "app", true>;/,
      /"todos\.add": ServerActionEntry<typeof file\d+, "todos", true>;/,
      /"todos\.list": ServerActionEntry<typeof file\d+, "todos", true, "list">;/,
      /"todos\.count": ServerActionEntry<typeof file\d+, "todos", false, "count">;/,
      /"todos\.clear": ServerActionEntry<typeof file\d+, "todos", false>;/,
      /interface ServerServiceMap extends DiscoveredServerServices \{\}/,
      /type DiscoveredServerServices = DiscoveredServiceEntry<typeof file\d+, ""> & DiscoveredServiceEntry<typeof file\d+, "todos">;/,
    ])
      assert.match(source, entry);
    assert.doesNotMatch(source, /interface (ServiceMap|ActionMap)\b/);
    assert.match(
      source,
      /withPluginOrigin\(\{ id: "notes", dependencies: \[\], events: discoverEvents\(\[file\d+\]\)/,
      'a module without a server half still brings its shared declarations',
    );
    assert.match(source, /export const server = createServer\(createBitaKitServerConfig\(\), \{/);
    assert.match(source, /instance: 'bitakit',\n {2}endpoint: "\/api\/rpc",/);
    assert.deepEqual(operationsOf(source), ['ping', 'todos.add', 'todos.list']);
    // The stamp is stable across runs (it follows the server code, see the stamp test).
    assert.match(stampOf(source), /^[0-9a-f]{16}$/);
    await generateBitaKit(root, { quiet: true });
    assert.equal(await readFile(serverFile, 'utf8'), source);

    // The client file names the exposed operations for remote.
    const client = await readFile(result.generated, 'utf8');
    assert.match(
      client,
      /remote: \{"endpoint":"\/api\/rpc","operations":\["ping","todos\.add","todos\.list"\]\},\n {4}plugins: \[/,
    );
    assert.doesNotMatch(client, /server\/|ServerActionMap/);
    const { createBitaKitConfig } = await loadGenerated(result.generated);
    const runtime = createRuntime(createBitaKitConfig());
    assert.equal(typeof runtime.remote.todos.add, 'function');
    assert.equal(typeof runtime.remote.ping, 'function');
    assert.equal(runtime.remote.todos.count, undefined);

    const consumer = await put(
      'consumer.ts',
      `import type { Remote } from '@bitakit/core';
import { server, createBitaKitServerConfig } from './src/bitakit.gen.server';
declare const remote: Remote;
export const added: Promise<number> = remote.todos.add({ title: 'x' });
export const pong: Promise<'pong'> = remote.ping();
// @ts-expect-error private operations are not part of remote
void remote.todos.count;
const caller = server.as(new Headers());
export const count: Promise<number> = caller.todos.count();
export const cleared: Promise<'cleared'> = caller.todos.clear();
// @ts-expect-error the input is typed by the schema
void caller.todos.add({ name: 'x' });
export const appId: string | undefined = createBitaKitServerConfig().appId;
`,
    );
    assert.deepEqual(typeErrors([serverFile, result.generated, consumer], root), []);

    const loaded = await loadGenerated(serverFile);
    const config = loaded.createBitaKitServerConfig();
    assert.deepEqual(config.configOverrides, createBitaKitConfig().configOverrides);
    assert.deepEqual(config.configOverrides, { todos: { limits: { max: 3 } } });
    assert.deepEqual(
      config.plugins.map((plugin) => plugin.id),
      ['notes', 'todos'],
    );
    const { server } = loaded;
    globalThis.__serverAudit = [];
    try {
      const member = server.as(new Headers({ 'x-user': 'u1' }));
      assert.equal(await member.todos.add({ title: 'Write tests' }), 1);
      assert.deepEqual(await member.todos.list(), ['org-1:Write tests']);
      assert.equal(await member.todos.count(), 1);
      assert.equal(await member.ping(), 'pong');
      await assert.rejects(server.as(new Headers()).todos.add({ title: 'x' }), {
        code: 'UNAUTHORIZED',
      });
      // Public operations resolve no identity; their ctx has no user.
      assert.deepEqual(globalThis.__serverAudit, [
        'todos.add:u1',
        'todos.list:anonymous',
        'todos.count:anonymous',
      ]);
      assert.deepEqual(
        (await server.operations()).map(({ id, plugin, exposed }) => `${plugin}/${id}:${exposed}`),
        [
          'app/ping:true',
          'todos/todos.add:true',
          'todos/todos.clear:false',
          'todos/todos.list:true',
          'todos/todos.count:false',
        ],
      );
    } finally {
      await server.stop();
      delete globalThis.__serverAudit;
    }

    // Describe reports the same server half per module.
    const description = await describeBitaKit(root);
    assert.deepEqual(description.app.server, {
      actions: [{ path: 'ping', file: 'src/server/actions/ping.ts' }],
      services: [{ path: 'request-context', file: 'src/server/services/request-context.ts' }],
      interceptors: [],
      contributions: {},
    });
    const todos = description.plugins.find((plugin) => plugin.id === 'todos');
    assert.deepEqual(todos.server, {
      actions: [
        { path: 'add', file: 'src/plugins/todos/server/actions/add.ts' },
        { path: 'clear', file: 'src/plugins/todos/server/actions.clear.ts' },
        { path: '', file: 'src/plugins/todos/server/actions.ts' },
      ],
      services: [{ path: 'store', file: 'src/plugins/todos/server/services/store.ts' }],
      interceptors: [{ path: 'audit', file: 'src/plugins/todos/server/interceptors/audit.ts' }],
      contributions: {},
    });
    assert.deepEqual(description.plugins.find((plugin) => plugin.id === 'notes').server, {
      actions: [],
      services: [],
      interceptors: [],
      contributions: {},
    });
    assert.deepEqual(description.warnings, []);
    const module = await describeModule(path.join(root, 'src/plugins/todos'));
    assert.deepEqual(
      module.server.actions.map((entry) => entry.path),
      ['add', 'clear', ''],
    );
    assert.equal(
      module.server.services[0].file,
      path.join(root, 'src/plugins/todos/server/services/store.ts'),
    );

    // Without server content the file goes, and so does the client's remote.
    for (const folder of [
      'src/plugins/todos/server/actions',
      'src/plugins/todos/server/services',
      'src/plugins/todos/server/interceptors',
      'src/server/actions',
      'src/server/services',
    ])
      await rm(path.join(root, folder), { recursive: true });
    await rm(path.join(root, 'src/plugins/todos/server/actions.ts'));
    await rm(path.join(root, 'src/plugins/todos/server/actions.clear.ts'));
    await rm(path.join(root, 'src/plugins/todos/actions/add.ts'));
    const plain = await generateBitaKit(root, { quiet: true });
    assert.equal(plain.server, undefined);
    assert.deepEqual(plain.warnings, []);
    await assert.rejects(readFile(serverFile), /ENOENT/);
    assert.doesNotMatch(await readFile(plain.generated, 'utf8'), /remote:/);
  }));

test('dependencies on package plugins are dropped from the server file; disabled and package plugins stay out', () =>
  fixture(async (root, put) => {
    await installCore(put);
    await put('package.json', JSON.stringify({ dependencies: { '@acme/shell': '1.0.0' } }));
    await put(
      'node_modules/@acme/shell/package.json',
      JSON.stringify({
        name: '@acme/shell',
        exports: { './package.json': './package.json', './plugin': './plugin.mjs' },
        bitakit: { plugin: './plugin' },
      }),
    );
    await put('node_modules/@acme/shell/plugin.mjs', `export default () => ({ id: 'shell' });`);
    await put(
      'src/plugins/todos/plugin.config.ts',
      `export default { dependencies: ['notes', 'shell'] };`,
    );
    await put(
      'src/plugins/notes/events.ts',
      `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ saved: event<{ id: string }>() });
`,
    );
    await put(
      'src/plugins/todos/server/actions/ping.ts',
      `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', execute: () => 'pong' });
`,
    );
    await put(
      'src/plugins/todos/list/plugin.config.ts',
      `export default { dependencies: ['todos'] };`,
    );
    const result = await generateBitaKit(root, { quiet: true });
    const client = await readFile(result.generated, 'utf8');
    const source = await readFile(result.server, 'utf8');
    assert.match(client, /id: "todos", metadata: \{\}, dependencies: \["notes","shell"\]/);
    assert.match(source, /id: "todos", dependencies: \["notes"\]/);
    assert.match(source, /id: "list", parent: "todos", dependencies: \["todos"\]/);
    assert.doesNotMatch(source, /shell|packagePlugin/);
    assert.deepEqual(operationsOf(source), []);
    assert.doesNotMatch(client, /remote:/, 'no exposed operations, no remote');
    const { server } = await loadGenerated(result.server);
    try {
      assert.equal(await server.as(new Headers()).todos.ping(), 'pong');
    } finally {
      await server.stop();
    }
  }));

/** Runs `run` and returns what it logged with console.error (the kernel's boot failure). */
async function loggedErrors(run) {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    await run();
  } finally {
    console.error = original;
  }
  return logged.flat().filter((item) => item instanceof Error);
}

test('the server file keeps only config overrides for its own modules; a package plugin override does not stop its boot', () =>
  fixture(async (root, put) => {
    await installCore(put);
    await put('package.json', JSON.stringify({ dependencies: { '@acme/shell': '1.0.0' } }));
    await put(
      'node_modules/@acme/shell/package.json',
      JSON.stringify({
        name: '@acme/shell',
        exports: { './package.json': './package.json', './plugin': './plugin.mjs' },
        bitakit: { plugin: './plugin' },
      }),
    );
    await put(
      'node_modules/@acme/shell/plugin.mjs',
      `export default () => ({ id: 'shell', config: { theme: 'light' } });`,
    );
    // Core matches override keys case-insensitively; "Todos" names the local todos plugin.
    await put(
      'bitakit.config.ts',
      `export default { configOverrides: { shell: { theme: 'dark' }, Todos: { limits: { max: 3 } } } };`,
    );
    await put(
      'src/plugins/todos/configs/limits.ts',
      `import { defineConfig } from '@bitakit/core';
export default defineConfig({ defaults: { max: 10 } });
`,
    );
    await put(
      'src/plugins/todos/server/actions/limit.ts',
      `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', expose: true, execute: ({ config }) => config.plugin.get('limits.max', 0) });
`,
    );
    const result = await generateBitaKit(root, { quiet: true });
    const client = await readFile(result.generated, 'utf8');
    assert.match(
      client,
      /"shell":\{"theme":"dark"\}/,
      'the client file keeps the package override',
    );
    const { server, createBitaKitServerConfig } = await loadGenerated(result.server);
    assert.deepEqual(createBitaKitServerConfig().configOverrides, {
      Todos: { limits: { max: 3 } },
    });
    try {
      assert.equal(await server.as(new Headers()).todos.limit(), 3);
    } finally {
      await server.stop();
    }
  }));

test('a dependency or parent that is a disabled local plugin stays in the server file, so its kernel refuses to start like the client', () =>
  fixture(async (root, put) => {
    await installCore(put);
    await put(
      'bitakit.config.ts',
      `export default { plugins: { overrides: { billing: { enabled: false } } } };`,
    );
    await put(
      'src/plugins/billing/server/services/ledger.ts',
      `import { defineService } from '@bitakit/core/server';
export default defineService(() => ({ total: () => 42 }));
`,
    );
    await put(
      'src/plugins/invoices/plugin.config.ts',
      `export default { dependencies: ['Billing'] };`,
    );
    await put(
      'src/plugins/invoices/server/actions/total.ts',
      `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', expose: true, execute: () => 'served' });
`,
    );
    /** The client runtime and the server kernel refuse to start with the same message. */
    const bothRefuse = async (result, call, message) => {
      const { createBitaKitConfig } = await loadGenerated(result.generated);
      assert.throws(() => createRuntime(createBitaKitConfig()), { message });
      const { server } = await loadGenerated(result.server);
      const errors = await loggedErrors(async () => {
        await assert.rejects(call(server.as(new Headers())), { code: 'SERVICE_UNAVAILABLE' });
        await server.stop();
      });
      assert.ok(
        errors.some((error) => message.test(error.message)),
        `the server logs ${message}`,
      );
    };
    const dependent = await generateBitaKit(root, { quiet: true });
    const source = await readFile(dependent.server, 'utf8');
    assert.match(source, /id: "invoices", dependencies: \["billing"\]/);
    assert.doesNotMatch(source, /id: "billing"|ledger/, 'the disabled plugin stays out');
    await bothRefuse(
      dependent,
      (caller) => caller.invoices.total(),
      /^Plugin "invoices" depends on "billing", which is not installed or is disabled\./,
    );

    // A child plugin under a disabled parent: its exposed operation must not answer.
    await rm(path.join(root, 'src/plugins/invoices'), { recursive: true });
    await put('src/plugins/billing/admin/plugin.config.ts', 'export default {};');
    await put(
      'src/plugins/billing/admin/server/actions/refund.ts',
      `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', expose: true, execute: () => 'refunded' });
`,
    );
    const child = await generateBitaKit(root, { quiet: true });
    assert.match(await readFile(child.server, 'utf8'), /id: "admin", parent: "billing", /);
    await bothRefuse(
      child,
      (caller) => caller.admin.refund(),
      /^Plugin "admin" belongs to "billing", which is not installed or is disabled\./,
    );
  }));

test('the stamp follows the server code: an edited Action body or server/ helper boots the new code in development', () =>
  fixture(async (root, put) => {
    const environment = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    await installCore(put);
    const action = (version) => `import { defineAction } from '@bitakit/core/server';
import { label } from '../lib/label';
export default defineAction({ access: 'public', expose: true, execute: () => \`\${label}:${version}\` });
`;
    await put('src/plugins/stamped/server/actions/version.ts', action('v1'));
    await put('src/plugins/stamped/server/lib/label.ts', `export const label = 'first';`);
    await put(
      'src/plugins/stamped/actions/show.ts',
      `import { defineAction } from '@bitakit/core';
export default defineAction({ title: 'Show', execute: () => {} });
`,
    );
    const generate = async () => {
      const result = await generateBitaKit(root, { quiet: true });
      return readFile(result.server, 'utf8');
    };
    const serverFile = path.join(root, 'src/bitakit.gen.server.ts');
    const first = await generate();
    const copy1 = await loadGenerated(serverFile);
    try {
      assert.equal(await copy1.server.as(new Headers()).stamped.version(), 'first:v1');
      assert.equal(await generate(), first, 'no change, same file and stamp');

      // Only the Action's body changes: the file differs only in its stamp.
      await put('src/plugins/stamped/server/actions/version.ts', action('v2'));
      const second = await generate();
      assert.notEqual(stampOf(second), stampOf(first));
      assert.equal(second.replace(stampOf(second), stampOf(first)), first);
      // The bundler re-evaluates the server file with the edited module: the new code answers,
      // also through the older module copy's handle.
      const copy2 = await loadGenerated(serverFile);
      assert.equal(await copy2.server.as(new Headers()).stamped.version(), 'first:v2');
      assert.equal(await copy1.server.as(new Headers()).stamped.version(), 'first:v2');

      // A helper under server/ counts too; client files do not.
      await put('src/plugins/stamped/server/lib/label.ts', `export const label = 'second';`);
      const third = await generate();
      assert.notEqual(stampOf(third), stampOf(second));
      await put(
        'src/plugins/stamped/actions/show.ts',
        `import { defineAction } from '@bitakit/core';
export default defineAction({ title: 'Show it', execute: () => {} });
`,
      );
      assert.equal(stampOf(await generate()), stampOf(third), 'a client Action is not server code');
      const copy3 = await loadGenerated(serverFile);
      assert.equal(await copy3.server.as(new Headers()).stamped.version(), 'second:v2');
      await copy3.server.stop();
    } finally {
      await copy1.server.stop();
      if (environment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environment;
    }
  }));

test('server and both contribution kinds: files, type maps, boot without installers and misplacement errors', () =>
  fixture(async (root, put) => {
    await installCore(put);
    await put('package.json', JSON.stringify({ dependencies: { '@acme/kinds': '1.0.0' } }));
    await put(
      'node_modules/@acme/kinds/package.json',
      JSON.stringify({ name: '@acme/kinds', bitakit: { discovery: './discovery.mjs' } }),
    );
    await put(
      'node_modules/@acme/kinds/discovery.mjs',
      `export default () => [
  { name: 'media.storage', directory: 'storage', from: '@acme/kinds/normalizers.mjs', normalize: 'discoverStorage', runtime: 'server', types: { entry: 'StorageEntry', map: 'StorageMap' } },
  { name: 'topics', directory: 'topics', from: '@acme/kinds/normalizers.mjs', normalize: 'discoverTopics', runtime: 'both' },
];`,
    );
    await put(
      'node_modules/@acme/kinds/normalizers.mjs',
      `export const discoverStorage = (files, moduleId) => files.map((file) => ({ moduleId, path: file.path, value: file.value }));
export const discoverTopics = (files, moduleId) => files.map((file) => \`\${moduleId}:\${file.value}\`);
export const discoverWidgets = (files) => files.map((file) => file.value);
`,
    );
    await put(
      'node_modules/@acme/kinds/normalizers.d.mts',
      `export declare const discoverStorage: (files: readonly unknown[], moduleId: string) => unknown[];
export declare const discoverTopics: (files: readonly unknown[], moduleId: string) => string[];
export declare const discoverWidgets: (files: readonly unknown[], moduleId: string) => unknown[];
export type StorageEntry<F, M extends string> = F extends { path: infer P extends string } ? { [K in \`\${M}.\${P}\`]: true } : {};
export interface StorageMap {}
`,
    );
    await put(
      'bitakit.config.ts',
      `export default { kinds: [{ name: 'widgets', directory: 'widgets', from: '@acme/kinds/normalizers.mjs', normalize: 'discoverWidgets' }] };`,
    );
    await put('src/plugins/media/server/contributions/storage/local.ts', 'export default "disk";');
    await put('src/plugins/media/server/contributions/storage/-helper.ts', 'export default "no";');
    await put('src/plugins/media/contributions/topics/uploaded.ts', 'export default "uploaded";');
    await put('src/plugins/media/contributions/widgets/panel.ts', 'export default "panel";');
    await put('src/server/contributions.storage.memory.ts', 'export default "memory";');
    const result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result.warnings, []);
    const client = await readFile(result.generated, 'utf8');
    const source = await readFile(result.server, 'utf8');
    assert.doesNotMatch(client, /storage|discoverStorage|helper/);
    assert.match(client, /"topics": normalize\d\(\[file\d+\], "media"\), "widgets": normalize\d/);
    assert.match(
      source,
      /contributions: \{ "media\.storage": normalize0\(\[file\d+\], "app"\) \}/,
      'the app module reads server/contributions too (dotted)',
    );
    assert.match(
      source,
      /contributions: \{ "media\.storage": normalize0\(\[file\d+\], "media"\), "topics": normalize1\(\[file\d+\], "media"\) \}/,
    );
    assert.doesNotMatch(source, /widgets|helper/);
    assert.match(
      source,
      /declare module '@acme\/kinds\/normalizers\.mjs' \{ interface StorageMap extends KindMap0 \{\} \}/,
    );
    assert.doesNotMatch(client, /StorageMap/);
    // The app's program always holds the client file too, which imports @bitakit/core.
    assert.deepEqual(typeErrors([result.server, result.generated], root), []);
    const consumer = await put(
      'consumer.ts',
      `import type { StorageMap } from '@acme/kinds/normalizers.mjs';
import './src/bitakit.gen.server';
export const local: StorageMap['media.local'] = true;
`,
    );
    assert.deepEqual(typeErrors([result.server, result.generated, consumer], root), []);
    // Nothing installs the server kind yet; the kernel boots and contributionsOf reads it.
    const { contributionsOf } = await import('../dist/server/index.js');
    const { server, createBitaKitServerConfig } = await loadGenerated(result.server);
    try {
      assert.deepEqual(await server.operations(), []);
      assert.deepEqual(contributionsOf(createBitaKitServerConfig(), 'media.storage'), [
        { plugin: 'app', value: { moduleId: 'app', path: 'memory', value: 'memory' } },
        { plugin: 'media', value: { moduleId: 'media', path: 'local', value: 'disk' } },
      ]);
      assert.deepEqual(contributionsOf(createBitaKitServerConfig(), 'topics'), [
        { plugin: 'media', value: 'media:uploaded' },
      ]);
    } finally {
      await server.stop();
    }
    const description = await describeBitaKit(root);
    assert.deepEqual(description.plugins[0].server.contributions, {
      'media.storage': [
        { path: 'local', file: 'src/plugins/media/server/contributions/storage/local.ts' },
      ],
    });
    assert.deepEqual(description.app.server.contributions, {
      'media.storage': [{ path: 'memory', file: 'src/server/contributions.storage.memory.ts' }],
    });
    // Package kinds are unknown without their discovery hooks.
    const metadataOnly = await describeBitaKit(root, { packageMetadataOnly: true });
    assert.deepEqual(metadataOnly.plugins[0].server.contributions, {});
    const kinds = [
      { name: 'media.storage', directory: 'storage', from: 'x', normalize: 'y', runtime: 'server' },
    ];
    const module = await describeModule(path.join(root, 'src/plugins/media'), { kinds });
    assert.deepEqual(Object.keys(module.server.contributions), ['media.storage']);
    assert.deepEqual(
      (await describeModule(path.join(root, 'src/plugins/media'))).server.contributions,
      {},
    );

    // A file on the wrong side is an error naming where it belongs.
    const misplaced = [
      [
        'src/plugins/media/contributions/storage/s3.ts',
        /^Error: src\/plugins\/media\/contributions\/storage\/s3\.ts belongs to the contribution kind "media\.storage", which is server-only, so its files live under server\/: move it to src\/plugins\/media\/server\/contributions\/storage\/s3\.ts\.$/,
      ],
      [
        'src/contributions/storage.s3.ts',
        /^Error: src\/contributions\/storage\.s3\.ts belongs .*: move it to src\/server\/contributions\/storage\.s3\.ts\.$/,
      ],
      [
        'src/plugins/media/server/contributions/widgets/menu.ts',
        /^Error: src\/plugins\/media\/server\/contributions\/widgets\/menu\.ts belongs to the contribution kind "widgets", which runs in the browser, so its files live in contributions\/: move it to src\/plugins\/media\/contributions\/widgets\/menu\.ts\.$/,
      ],
      [
        'src/plugins/media/server/contributions/topics/deleted.ts',
        /which runs on both sides, so its files live in contributions\/: move it to src\/plugins\/media\/contributions\/topics\/deleted\.ts\.$/,
      ],
    ];
    for (const [file, message] of misplaced) {
      const target = await put(file, 'export const helper = 1;');
      await assert.rejects(generateBitaKit(root, { quiet: true }), message);
      await rm(target);
    }
    assert.equal(await readFile(result.server, 'utf8'), source, 'a failed run writes nothing');

    // The old root folder <dir>/, still read for client kinds: a server kind's contribution
    // there is misplaced too (a runtime switch must not lose it); other files get the warning.
    for (const [file, target] of [
      ['src/plugins/media/storage/s3.ts', 'src/plugins/media/server/contributions/storage/s3.ts'],
      ['src/storage.s3.ts', 'src/server/contributions/storage.s3.ts'],
    ]) {
      const misplacedFile = await put(file, 'export default "s3";');
      await assert.rejects(generateBitaKit(root, { quiet: true }), {
        message: `${file} belongs to the contribution kind "media.storage", which is server-only, so its files live under server/: move it to ${target}.`,
      });
      await rm(misplacedFile);
    }
    await put('src/plugins/media/storage/notes.ts', 'export const notes = 1;');
    assert.deepEqual((await generateBitaKit(root, { quiet: true })).warnings, [
      'src/plugins/media/storage/notes.ts is in a media.storage folder but has no default export, so it is ignored. Export the contribution as default, or prefix the file name with "-" for helpers.',
    ]);
  }));

test('contribution kinds keep their runtime; client is the default', () => {
  const kind = { name: 'widgets', directory: 'widgets', from: 'x', normalize: 'discoverWidgets' };
  assert.equal(contributionKindSpecs([kind])[0].runtime, 'client');
  for (const runtime of ['client', 'server', 'both'])
    assert.equal(contributionKindSpecs([{ ...kind, runtime }])[0].runtime, runtime);
  assert.throws(
    () => contributionKindSpecs([{ ...kind, runtime: 'edge' }]),
    /Contribution kind "widgets" has runtime "edge"; use "client", "server" or "both"\./,
  );
});

test('discoverEntries on the server side: the client segment rules after server/, everything else silent', () =>
  fixture(async (root, put) => {
    const sources = [
      await put('server/actions/team/refresh.ts', 'export default {}'),
      await put('server/actions.save.ts', 'export default {}'),
      await put('server/actions/index.ts', 'export default {}'),
      await put('server/actions/legacy.action.ts', 'export default {}'),
      await put('server/actions/-helper.ts', 'export default {}'),
      await put('server/actions/plain.ts', 'export const plain = 1;'),
      await put('server/services.store.ts', 'export default {}'),
      await put('server/extension.ts', 'export default {}'),
      await put('server/schema/actions.ts', 'export default {}'),
      await put('actions/button.ts', 'export default {}'),
    ];
    const server = await discoverEntries(root, sources, 'actions', { side: 'server' });
    assert.deepEqual(
      server.entries.map((entry) => entry.path),
      [['team', 'refresh'], ['save'], [], ['legacy', 'action']],
    );
    assert.deepEqual(server.warnings, [
      'server/actions/plain.ts is in a actions folder but has no default export, so it is ignored. Export the contribution as default, or prefix the file name with "-" for helpers.',
    ]);
    const services = await discoverEntries(root, sources, 'services', { side: 'server' });
    assert.deepEqual(
      services.entries.map((entry) => entry.source),
      ['server/services.store.ts'],
    );
    const client = await discoverEntries(root, sources, 'actions');
    assert.deepEqual(
      client.entries.map((entry) => entry.source),
      ['actions/button.ts'],
    );
    await assert.rejects(
      discoverEntries(root, sources, 'pages', { side: 'server' }),
      /Kind "pages" has no server folder/,
    );
    await assert.rejects(
      discoverEntries(
        root,
        [
          path.join(root, 'server/actions.save.ts'),
          await put('server/actions/save.ts', 'export default {}'),
        ],
        'actions',
        { side: 'server' },
      ),
      /Duplicate actions path "save"/,
    );
  }));

test('static field rules: server Actions need access and boolean expose, no client fields or reserved names; buttons have no server fields', () =>
  fixture(async (root, put) => {
    await installCore(put);
    const action = (file, body) =>
      put(
        file,
        `import { defineAction } from '@bitakit/core/server';
export default defineAction(${body});
`,
      );
    const cases = [
      [
        'src/plugins/todos/server/actions/add.ts',
        `{ access: 'public', icon: 'plus', execute: () => 1 }`,
        /^Error: src\/plugins\/todos\/server\/actions\/add\.ts: server:todos\.add has the client-only field "icon"\. The operation has no UI; that field belongs to the button in actions\/, which calls remote\.todos\.add\(\)\.$/,
      ],
      [
        'src/plugins/todos/server/actions/add.ts',
        `{ expose: true, execute: () => 1 }`,
        /^Error: src\/plugins\/todos\/server\/actions\/add\.ts: server:todos\.add needs access: 'public', 'user', 'organization' or \{ permission/,
      ],
      [
        'src/plugins/todos/server/actions/add.ts',
        `{ access: 'public', expose: 'yes', execute: () => 1 }`,
        /server:todos\.add has an expose that is not true or false\./,
      ],
      [
        'src/plugins/todos/server/actions/add.ts',
        `{ access: 'public', expose: Boolean(process.env.X), execute: () => 1 }`,
        /server:todos\.add has an expose that is not true or false\./,
      ],
      [
        'src/plugins/todos/server/actions/then.ts',
        `{ access: 'public', execute: () => 1 }`,
        /^Error: src\/plugins\/todos\/server\/actions\/then\.ts: server:todos\.then uses the reserved name "then"; then, catch, finally, subscribe, toJSON, valueOf, toString, constructor, prototype cannot name a server Action/,
      ],
      [
        'src/server/actions/todos/add.ts',
        `{ access: 'public', execute: () => 1 }`,
        /^Error: Two server Actions are named "todos\.add": src\/server\/actions\/todos\/add\.ts and src\/plugins\/todos\/server\/actions\/add\.ts\./,
      ],
      [
        'src/server/actions/Todos/add.ts',
        `{ access: 'public', execute: () => 1 }`,
        /^Error: Two server Actions are named "todos\.add" \("Todos\.add" differs only in case\)/,
      ],
    ];
    const valid = `{ access: 'public', execute: () => 1 }`;
    for (const [file, body, message] of cases) {
      await action('src/plugins/todos/server/actions/add.ts', valid);
      const target = await action(file, body);
      await assert.rejects(generateBitaKit(root, { quiet: true }), message);
      if (file !== 'src/plugins/todos/server/actions/add.ts') await rm(target);
      // Folders too: on a case-insensitive file system Todos/ would land in todos/.
      await rm(path.join(root, 'src/server'), { recursive: true, force: true });
    }
    await put(
      'src/plugins/todos/server/actions.ts',
      `import { defineAction } from '@bitakit/core/server';
export default { sub: { subscribe: defineAction({ access: 'public', execute: () => 1 }) } };
`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /server:todos\.sub\.subscribe uses the reserved name "subscribe"/,
    );
    await rm(path.join(root, 'src/plugins/todos/server/actions.ts'));

    // The button side: a server field in actions/ names the operation's file and remote call.
    await put(
      'src/plugins/todos/actions/add.ts',
      `import { defineAction } from '@bitakit/core';
export default defineAction({ title: 'Add', access: 'public', execute: () => 1 });
`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /^Error: src\/plugins\/todos\/actions\/add\.ts: `access` is a server field\. This file is the button; put the operation, with `expose: true`, in server\/actions\/add\.ts and call it with remote\.todos\.add\(\)\.$/,
    );
    await rm(path.join(root, 'src/plugins/todos/actions/add.ts'));
    await put(
      'src/actions.ts',
      `import { defineAction as action } from '@bitakit/core';
export default { team: { save: action({ output: { parse: (value: unknown) => value }, execute: () => 1 }) } };
`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /src\/actions\.ts: `output` is a server field\. This file is the button; put the operation, with `expose: true`, in server\/actions\/team\/save\.ts and call it with remote\.team\.save\(\)\./,
    );
    await rm(path.join(root, 'src/actions.ts'));

    // Definitions the parser cannot read are left to Core: no generation error, no types, and the
    // kernel warns when such an exposed operation is missing from remote.
    await put(
      'src/plugins/todos/server/-shared.ts',
      `import { defineAction } from '@bitakit/core/server';
export const shared = defineAction({ access: 'public', expose: true, execute: () => 'shared' });
`,
    );
    await put(
      'src/plugins/todos/server/actions/shared.ts',
      `import { shared } from '../-shared';
export default shared;
`,
    );
    const result = await generateBitaKit(root, { quiet: true });
    const source = await readFile(result.server, 'utf8');
    assert.doesNotMatch(source, /"todos\.shared"/);
    assert.deepEqual(operationsOf(source), []);
    const warned = [];
    const warn = console.warn;
    console.warn = (message) => warned.push(String(message));
    const { server } = await loadGenerated(result.server);
    try {
      assert.equal(await server.as(new Headers()).todos.shared(), 'shared');
    } finally {
      console.warn = warn;
      await server.stop();
    }
    assert.ok(
      warned.some((message) =>
        /server:todos\.shared is exposed over HTTP but missing from the generated remote.*src\/plugins\/todos\/server\/actions\/shared\.ts/.test(
          message,
        ),
      ),
      JSON.stringify(warned),
    );
  }));

test('the installed @bitakit/core needs the ./server entry once there is server content; the endpoint comes from bitakit.config.ts', () =>
  fixture(async (root, put) => {
    await put('src/plugins/todos/server/helpers.ts', 'export const helper = 1;');
    await put(
      'src/plugins/todos/events.ts',
      `import { defineEvents, event } from '@bitakit/core';
export default defineEvents({ saved: event<{ id: string }>() });
`,
    );
    // No server content: an older Core (or none) is fine, as for KnightCMS today.
    assert.equal((await generateBitaKit(root, { quiet: true })).server, undefined);
    await installCore(put, { server: false });
    assert.equal((await generateBitaKit(root, { quiet: true })).server, undefined);
    const client = await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8');

    await put(
      'src/plugins/todos/server/actions/add.ts',
      `import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', expose: true, execute: () => 1 });
`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /^Error: src\/plugins\/todos\/server\/actions\/add\.ts needs @bitakit\/core 0\.3\.2 or newer \(the @bitakit\/core\/server entry\), but the installed @bitakit\/core 0\.3\.1 does not have it\. Update @bitakit\/core to 0\.3\.2 or newer\.$/,
    );
    assert.equal(
      await readFile(path.join(root, 'src/bitakit.gen.ts'), 'utf8'),
      client,
      'nothing is written before the check',
    );
    await rm(path.join(root, 'node_modules'), { recursive: true });
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /needs @bitakit\/core 0\.3\.2 or newer \(the @bitakit\/core\/server entry\), but @bitakit\/core is not installed\./,
    );

    await installCore(put);
    await put('bitakit.config.ts', `export default { server: { endpoint: '/rpc/v1/' } };`);
    const result = await generateBitaKit(root, { quiet: true });
    assert.match(await readFile(result.server, 'utf8'), /endpoint: "\/rpc\/v1",/);
    assert.match(
      await readFile(result.generated, 'utf8'),
      /remote: \{"endpoint":"\/rpc\/v1","operations":\["todos\.add"\]\}/,
    );
    const { server } = await loadGenerated(result.server);
    assert.equal(server.endpoint, '/rpc/v1');
    await server.stop();
    for (const endpoint of ['api/rpc', '/api rpc', '/api/../rpc', 7]) {
      await put(
        'bitakit.config.ts',
        `export default { server: { endpoint: ${JSON.stringify(endpoint)} } };`,
      );
      await assert.rejects(
        generateBitaKit(root, { quiet: true }),
        /server\.endpoint in bitakit\.config\.ts must be a URL path such as "\/api\/rpc"/,
      );
    }
  }));
