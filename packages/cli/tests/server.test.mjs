import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describeBitaKit } from '@bitakit/discovery';
import { addContribution, agentRules, doctor } from '../src/index.mjs';
import { inspectionFromDescription } from '../src/inventory.mjs';
import { bitakit, catchAll, find, link, nextApp, project, status, write } from './helpers.mjs';

const read = (root, file) => readFile(path.join(root, file), 'utf8');
const relative = (root, files) =>
  files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();

/** The `@/*` alias create-next-app writes, plus one more `paths` alias. */
const tsconfig = {
  'tsconfig.json': {
    compilerOptions: {
      strict: true,
      moduleResolution: 'bundler',
      module: 'esnext',
      paths: { '@/*': ['./src/*'], '~lib/*': ['./src/lib/*'] },
    },
  },
};
const operation = (access = "'organization'", expose = 'true') =>
  `import { defineAction } from '@bitakit/core/server';\nexport default defineAction({ access: ${access}, expose: ${expose}, execute: () => 1 });\n`;
const button =
  "import { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'Add', execute: ({ remote }) => remote.todos.add() });\n";
const boundary = (results) => find(results, /Browser code (never )?imports? server code/);

test('doctor follows the client import graph into server code: helpers, @/ and paths aliases, use client files', async (t) => {
  const root = await project(
    nextApp({
      ...tsconfig,
      ...catchAll,
      'src/server/db.ts': 'export const db = {};\n',
      'src/server/secrets.ts': 'export const key = process.env.KEY;\n',
      // A helper outside server/ that leaks server code to the button importing it.
      'src/lib/format.ts': "import { db } from '../server/db';\nexport const format = () => db;\n",
      // Two helpers that import each other: the walk stops.
      'src/lib/a.ts': "import { b } from './b';\nexport const a = () => b;\n",
      'src/lib/b.ts': "import { a } from './a';\nexport const b = () => a;\n",
      'src/plugins/todos/actions/add.ts': `import { defineAction } from '@bitakit/core';
import { format } from '@/lib/format';
import { a } from '~lib/a';
export default defineAction({ title: 'Add', execute: () => [format(), a()] });
`,
      // A 'use client' component outside every discovered folder.
      'src/components/secret-badge.tsx': `'use client';
import { key } from '@/server/secrets';
export function SecretBadge() { return key; }
`,
      // Fine: a type-only import, a route handler and a server component are not browser code.
      'src/plugins/todos/actions/remove.ts': `import type { db } from '@/server/db';
import { type key } from '@/server/secrets';
import { defineAction } from '@bitakit/core';
export default defineAction({ title: 'Remove', execute: () => null as unknown as typeof db | typeof key });
`,
      'src/app/api/rpc/[...path]/route.ts':
        "import { fetchHandler } from '@bitakit/core/server';\nimport { server } from '@/bitakit.gen.server';\nexport const POST = fetchHandler(server);\n",
      'src/app/(app)/page.tsx':
        "import { db } from '@/server/db';\nexport default function Page() { return String(db); }\n",
      'src/plugins/todos/server/actions/add.ts': operation(),
      'src/server/services/request-context.ts':
        "import { defineService, requestContext } from '@bitakit/core/server';\nexport default defineService(() => ({ resolve: () => ({ user: null }) }), { provides: requestContext });\n",
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const leak = boundary(results);
  assert.equal(leak.status, 'error');
  assert.equal(leak.title, 'Browser code imports server code');
  assert.deepEqual(leak.details.sort(), [
    'src/components/secret-badge.tsx → src/server/secrets.ts',
    'src/plugins/todos/actions/add.ts → src/lib/format.ts → src/server/db.ts',
  ]);
  assert.match(leak.fix, /remote\.<plugin>\.<name>\(\)/);
  assert.equal(status(results, /Server code imports no React or UI code/), 'ok');
  assert.equal(status(results, /answers \/api\/rpc\/<operation id>/), 'ok');
  assert.equal(status(results, /A server service provides requestContext/), 'ok');
});

test('doctor reports @bitakit/core/server and the generated server file in browser code, and React in server code', async (t) => {
  const root = await project(
    nextApp({
      ...tsconfig,
      ...catchAll,
      // A generated client file reaches a client-kind contribution that discovery alone does not list.
      'src/bitakit.gen.config.ts':
        "import widget from './plugins/media/contributions/widgets/upload';\nexport const config = { widget };\n",
      'src/plugins/media/contributions/widgets/upload.ts':
        "import { bucket } from '../../server/storage';\nexport default { bucket };\n",
      'src/plugins/media/server/storage.ts': "export const bucket = 'private';\n",
      'src/plugins/todos/actions/add.ts':
        "import { OperationError } from '@bitakit/core/server';\nimport { defineAction } from '@bitakit/core';\nexport default defineAction({ title: 'Add', execute: () => OperationError });\n",
      'src/components/status.tsx':
        "'use client';\nimport { server } from '@/bitakit.gen.server';\nexport const Status = () => String(server);\n",
      // Dynamic imports count; a 'use client' file inside server/ is a contradiction.
      'src/plugins/todos/services/lazy.ts':
        "import { defineService } from '@bitakit/core';\nexport default defineService(() => ({ load: () => import('../server/heavy') }));\n",
      'src/plugins/todos/server/heavy.ts': 'export const heavy = 1;\n',
      'src/plugins/todos/server/widget.tsx': "'use client';\nexport const Widget = () => null;\n",
      // Server code that renders: React, @bitakit/ui and a module's ui/ folder.
      'src/plugins/todos/server/actions/render.ts': `import { renderToString } from 'react-dom/server';
import { Button } from '@bitakit/ui/components';
import Page from '../../ui/pages/index';
import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', execute: () => renderToString(Page) + String(Button) });
`,
      'src/plugins/todos/server/actions/types.ts': `import type { ReactNode } from 'react';
import { defineAction } from '@bitakit/core/server';
export default defineAction({ access: 'public', execute: (): ReactNode => null });
`,
      'src/plugins/todos/ui/pages/index.tsx': 'export default function Page() { return null; }\n',
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  const leak = boundary(results);
  assert.equal(leak.status, 'error');
  assert.deepEqual(leak.details.sort(), [
    'src/bitakit.gen.config.ts → src/plugins/media/contributions/widgets/upload.ts → src/plugins/media/server/storage.ts',
    'src/components/status.tsx imports the generated server file (@/bitakit.gen.server).',
    'src/plugins/todos/actions/add.ts imports @bitakit/core/server.',
    'src/plugins/todos/server/widget.tsx is browser code inside a server/ folder.',
    'src/plugins/todos/services/lazy.ts → src/plugins/todos/server/heavy.ts',
  ]);
  const rendering = find(results, /Server code imports React or UI code/);
  assert.equal(rendering.status, 'error');
  assert.deepEqual(rendering.details, [
    'src/plugins/todos/server/actions/render.ts imports react-dom/server.',
    'src/plugins/todos/server/actions/render.ts imports @bitakit/ui/components.',
    'src/plugins/todos/server/actions/render.ts imports src/plugins/todos/ui/pages/index.tsx.',
  ]);
  // Public operations need no requestContext provider.
  assert.equal(find(results, /requestContext/), undefined);
});

test('a server-only file no client root reaches passes, as in KnightCMS contribution folders', async (t) => {
  const root = await project(
    nextApp({
      ...catchAll,
      // contributions/x is not a configured kind, so neither discovery nor a client file imports it.
      'src/plugins/media/contributions/x/a.ts':
        "import { b } from '../../server/b';\nexport default { b };\n",
      'src/plugins/media/server/b.ts': 'export const b = 1;\n',
      'src/plugins/media/server/extension.ts': "import { b } from './b';\nexport default b;\n",
      // Server code may use a plain helper another module keeps in its ui/ folder.
      'src/plugins/media/server/tools.ts':
        "import { pending } from '../../builder/ui/components/pending';\nexport default pending;\n",
      'src/plugins/builder/ui/components/pending.ts': 'export const pending = [];\n',
    }),
    t,
  );
  const { results } = await doctor({ cwd: root });
  assert.equal(boundary(results).status, 'ok');
  assert.match(boundary(results).title, /client files? checked/);
  assert.equal(status(results, /Server code imports no React or UI code/), 'ok');
  // No server Actions: no route or provider results.
  assert.equal(find(results, /route answers|requestContext/), undefined);
});

test("doctor does not follow Next 'use server' modules: the browser gets references, never their code", async (t) => {
  const root = await project(
    nextApp({
      ...tsconfig,
      ...catchAll,
      'src/server/db.ts': 'export const db = { insert: (value: unknown) => value };\n',
      // Server Functions outside and inside a server/ folder, imported by client components.
      'src/lib/actions.ts': `'use server';
import { db } from '@/server/db';
export async function createTodo(form: FormData) { db.insert(form.get('title')); }
`,
      'src/server/functions.ts': `"use server";
import { db } from './db';
export async function removeTodo(id: string) { db.insert(id); }
`,
      'src/components/todo-form.tsx': `'use client';
import { createTodo } from '@/lib/actions';
import { removeTodo } from '@/server/functions';
export function TodoForm() { return <form action={createTodo}><button formAction={() => removeTodo('1')} /></form>; }
`,
    }),
    t,
  );
  const leak = boundary((await doctor({ cwd: root })).results);
  assert.equal(leak.status, 'ok', leak.details?.join('\n'));

  // Without the directive the same module is ordinary browser code.
  await write(root, {
    'src/lib/actions.ts':
      "import { db } from '@/server/db';\nexport async function createTodo(form: FormData) { db.insert(form.get('title')); }\n",
  });
  assert.deepEqual(boundary((await doctor({ cwd: root })).results).details, [
    'src/components/todo-form.tsx → src/lib/actions.ts → src/server/db.ts',
  ]);
});

test('doctor skips imports the compiler drops because they are used only as types', async (t) => {
  const files = nextApp({
    ...tsconfig,
    ...catchAll,
    'src/server/db/schema.ts': 'export type Todo = { id: string };\nexport const todos = [];\n',
    'src/server/db/client.ts': 'export const client = {};\n',
    'src/components/todo-row.tsx': `'use client';
import { Todo } from '@/server/db/schema';
import Client, * as everything from '@/server/db/client';
interface Row { todo: Todo; all: typeof everything; client: typeof Client }
export function TodoRow({ todo }: { todo: Todo }): Todo | null { return (null as unknown as Row) && todo; }
`,
  });
  const root = await project(files, t);
  assert.equal(boundary((await doctor({ cwd: root })).results).status, 'ok');

  // A value use keeps the import, also next to type uses; so does a class that extends it.
  await write(root, {
    'src/components/todo-count.tsx': `'use client';
import { Todo, todos } from '@/server/db/schema';
export const count = (list: Todo[] = todos) => list.length;
`,
    'src/components/todo-client.tsx': `'use client';
import { Base } from '@/server/db/base';
export class Client extends Base {}
`,
    'src/server/db/base.ts': 'export class Base {}\n',
  });
  assert.deepEqual(boundary((await doctor({ cwd: root })).results).details.sort(), [
    'src/components/todo-client.tsx → src/server/db/base.ts',
    'src/components/todo-count.tsx → src/server/db/schema.ts',
  ]);

  // verbatimModuleSyntax keeps every import that does not say type.
  const verbatim = await project(
    {
      ...files,
      'tsconfig.json': {
        compilerOptions: {
          ...tsconfig['tsconfig.json'].compilerOptions,
          verbatimModuleSyntax: true,
        },
      },
    },
    t,
  );
  assert.deepEqual(boundary((await doctor({ cwd: verbatim })).results).details.sort(), [
    'src/components/todo-row.tsx → src/server/db/client.ts',
    'src/components/todo-row.tsx → src/server/db/schema.ts',
  ]);
});

test('in TanStack apps every route file is browser code, except what Start keeps on the server', async (t) => {
  const root = await project(
    {
      'package.json': {
        name: 'start',
        dependencies: {
          '@tanstack/react-start': '1.168.59',
          '@tanstack/react-router': '1.168.59',
          '@bitakit/core': '^0.3.0',
        },
      },
      'node_modules/@bitakit/core/package.json': { name: '@bitakit/core', version: '0.3.0' },
      ...tsconfig,
      'src/server/secrets.ts': 'export const apiKey = process.env.KEY;\n',
      'src/server/db.ts': 'export const db = { list: () => [] };\n',
      'src/routes/__root.tsx':
        "import { createRootRoute } from '@tanstack/react-router';\nexport const Route = createRootRoute({});\n",
      // A component that renders a secret: Start bundles it for the browser.
      'src/routes/index.tsx': `import { createFileRoute } from '@tanstack/react-router';
import { apiKey } from '@/server/secrets';
export const Route = createFileRoute('/')({ component: () => <p>{apiKey}</p> });
`,
      // Server handlers, server functions and a helper only they use stay on the server.
      'src/routes/todos.tsx': `import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { db } from '@/server/db';
import { apiKey } from '@/server/secrets';
const listed = () => db.list();
const load = createServerFn({ method: 'GET' }).handler(async () => listed());
export const Route = createFileRoute('/todos')({
  loader: () => load(),
  component: () => null,
  server: { handlers: { GET: () => Response.json({ key: apiKey }) } },
});
`,
      // The RPC route add --server writes.
      'src/routes/api/rpc.$.ts': `import { createFileRoute } from '@tanstack/react-router';
import type {} from '@tanstack/react-start';
import { fetchHandler } from '@bitakit/core/server';
import { server } from '../../bitakit.gen.server';

const handle = fetchHandler(server);

export const Route = createFileRoute('/api/rpc/$')({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
`,
      // Older Start releases declare server routes with createServerFileRoute(...).methods(...).
      'src/routes/api/legacy.ts': `import { createServerFileRoute } from '@tanstack/react-start/server';
import { db } from '@/server/db';
export const ServerRoute = createServerFileRoute('/api/legacy').methods({ GET: () => Response.json(db.list()) });
`,
      // Files starting with "-" are not routes; only what imports them counts.
      'src/routes/-server-only.ts': "import { db } from '@/server/db';\nexport default db;\n",
    },
    t,
  );
  const leak = boundary((await doctor({ cwd: root })).results);
  assert.equal(leak.status, 'error');
  assert.deepEqual(leak.details, ['src/routes/index.tsx → src/server/secrets.ts']);

  // TanStack Router without Start strips nothing: the handlers' imports reach the browser too.
  await write(root, {
    'package.json': {
      name: 'start',
      dependencies: { '@tanstack/react-router': '1.168.59', '@bitakit/core': '^0.3.0' },
    },
  });
  assert.ok(
    boundary((await doctor({ cwd: root })).results).details.includes(
      'src/routes/todos.tsx → src/server/db.ts',
    ),
  );
});

test('doctor warns about exposed operations without a route and guarded ones without a provider', async (t) => {
  const files = nextApp({
    'src/app/[...path]/page.tsx':
      "'use client';\nexport default function Page() { return null; }\n",
    'src/plugins/todos/server/actions/add.ts': operation(),
    'src/plugins/todos/server/actions.ts': `import { defineAction } from '@bitakit/core/server';
export default {
  list: defineAction({ access: 'user', expose: true, execute: () => [] }),
  count: defineAction({ access: { permission: { todos: ['read'] } }, execute: () => 0 }),
};
`,
  });
  const root = await project(files, t);
  const { results } = await doctor({ cwd: root });
  const route = find(results, /No route answers the exposed server Actions/);
  assert.equal(route.status, 'warn', 'a catch-all page renders plugin pages, it answers no POST');
  assert.match(route.details[0], /^server:todos\.add, server:todos\.list are exposed/);
  assert.match(route.fix, /^Create src\/app\/api\/rpc\/\[\.\.\.path\]\/route\.ts:/);
  assert.match(route.fix, /export const POST = fetchHandler\(server\);/);
  const provider = find(results, /No service provides requestContext/);
  assert.equal(provider.status, 'warn');
  assert.match(
    provider.details[0],
    /^server:todos\.add, server:todos\.list, server:todos\.count need a signed-in caller/,
  );
  assert.match(provider.fix, /src\/server\/services\/request-context\.ts/);

  // A configured endpoint moves the route; a route handler there answers it.
  const moved = await project(
    {
      ...files,
      'bitakit.config.ts': "export default { server: { endpoint: '/api/v2/ops/' } };\n",
    },
    t,
  );
  const fix = find((await doctor({ cwd: moved })).results, /No route answers/).fix;
  assert.match(fix, /^Create src\/app\/api\/v2\/ops\/\[\.\.\.path\]\/route\.ts:/);
  assert.match(fix, /POST \/api\/v2\/ops\/<operation id>/);
});

test('add action --server writes the operation, its test, the button and the RPC route once; the test runs green', async (t) => {
  const manifest = nextApp()['package.json'];
  const root = await project(
    nextApp({
      ...tsconfig,
      ...catchAll,
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
  // The real packages, so the generated test runs unchanged; this Core has the /server entry.
  await rm(path.join(root, 'node_modules/@bitakit/core'), { recursive: true });
  await link(root, '@bitakit/core', 'packages/core');
  await link(root, '@bitakit/discovery', 'packages/discovery');
  await link(root, 'zod', 'node_modules/zod');
  const result = await addContribution('action', 'todos/add', { cwd: root, server: true });
  assert.equal(result.id, 'todos.add');
  assert.equal(result.server, true);
  assert.equal(result.createdPlugin, true);
  assert.equal(result.remote, 'remote.todos.add');
  assert.deepEqual(relative(root, result.created), [
    'src/app/api/rpc/[...path]/route.ts',
    'src/plugins/todos/actions/add.ts',
    'src/plugins/todos/server/actions/add.ts',
    'tests/todos.add.server.test.ts',
  ]);
  assert.deepEqual(result.route, { file: 'src/app/api/rpc/[...path]/route.ts', created: true });
  assert.deepEqual(result.setup, ['npm install zod']);
  assert.equal(result.run, 'npm test');

  const operationSource = await read(root, 'src/plugins/todos/server/actions/add.ts');
  assert.match(
    operationSource,
    /^\/\/ The operation todos\.add\. It runs only on the server; the button in actions\/add\.ts calls it\n\/\/ with remote\.todos\.add\(input\)\./,
  );
  assert.match(operationSource, /import \{ defineAction \} from '@bitakit\/core\/server';/);
  assert.match(operationSource, /access: 'organization',/);
  assert.match(operationSource, /expose: true,/);
  assert.match(operationSource, /input: z\.object\(\{ title: z\.string\(\)\.min\(1\) \}\),/);
  assert.match(operationSource, /output: z\.object\(/);
  assert.match(
    await read(root, 'src/plugins/todos/actions/add.ts'),
    /execute: \(\{ input, remote \}\) => remote\.todos\.add\(input\),/,
  );
  assert.equal(
    await read(root, 'src/app/api/rpc/[...path]/route.ts'),
    `import { fetchHandler } from '@bitakit/core/server';
import { server } from '@/bitakit.gen.server';

// Every BitaKit server operation the browser calls: POST /api/rpc/<operation id>.
export const POST = fetchHandler(server);
`,
  );
  const testSource = await read(root, 'tests/todos.add.server.test.ts');
  assert.match(testSource, /const server = await mountServer\('src\/plugins\/todos'\);/);
  assert.match(testSource, /identity\(\{ organization: 'org-1' \}\)/);
  assert.match(testSource, /identity\(\{ user: 'user-2', organization: 'org-2' \}\)/);
  assert.match(testSource, /identity\(\{ user: null \}\)/);

  // The second operation reuses the route and keeps an existing button in any spelling.
  await addContribution('action', 'todos/archive', { cwd: root });
  const second = await addContribution('action', 'todos/archive', { cwd: root, server: true });
  assert.deepEqual(relative(root, second.created), [
    'src/plugins/todos/server/actions/archive.ts',
    'tests/todos.archive.server.test.ts',
  ]);
  assert.deepEqual(second.route, { file: 'src/app/api/rpc/[...path]/route.ts', created: false });
  assert.deepEqual(relative(root, second.kept), ['src/plugins/todos/actions/archive.ts']);
  await assert.rejects(
    addContribution('action', 'todos/add', { cwd: root, server: true }),
    /already exists\. Nothing was changed\./,
  );

  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = await promisify(execFile)(
    process.execPath,
    ['--test', 'tests/todos.add.server.test.ts'],
    { cwd: root, env },
  ).catch((error) => error);
  assert.equal(run.code ?? 0, 0, `${run.stdout}${run.stderr}`);
  assert.match(run.stdout, /pass 3/);
  assert.match(run.stdout, /fail 0/);

  // Doctor sees the route and no leak; the provider is the app's to write.
  const { results } = await doctor({ cwd: root });
  assert.equal(boundary(results).status, 'ok');
  assert.equal(status(results, /answers \/api\/rpc\/<operation id>/), 'ok');
  assert.equal(status(results, /No service provides requestContext/), 'warn');
});

test('add --server: services, interceptors, nested names, TanStack routes and refusals', async (t) => {
  const root = await project(nextApp(), t);
  const service = await addContribution('service', 'todos/store', { cwd: root, server: true });
  assert.deepEqual(relative(root, service.created), ['src/plugins/todos/server/services/store.ts']);
  assert.match(
    await read(root, 'src/plugins/todos/server/services/store.ts'),
    /import \{ defineService \} from '@bitakit\/core\/server';[\s\S]*services\.todos\.store/,
  );
  const interceptor = await addContribution('interceptor', 'todos/audit', {
    cwd: root,
    server: true,
  });
  assert.deepEqual(relative(root, interceptor.created), [
    'src/plugins/todos/server/interceptors/audit.ts',
  ]);
  assert.match(
    await read(root, 'src/plugins/todos/server/interceptors/audit.ts'),
    /action: 'todos\.\*',\n {2}before: \(\{ id, ctx \}\) =>/,
  );
  const nested = await addContribution('action', 'user-notes/team/invite', {
    cwd: root,
    server: true,
  });
  assert.equal(nested.id, 'user-notes.team.invite');
  assert.deepEqual(relative(root, nested.created), [
    'src/app/api/rpc/[...path]/route.ts',
    'src/plugins/user-notes/actions/team/invite.ts',
    'src/plugins/user-notes/server/actions/team/invite.ts',
    'tests/user-notes.team.invite.server.test.ts',
  ]);
  assert.match(
    await read(root, 'src/plugins/user-notes/actions/team/invite.ts'),
    /remote\["user-notes"\]\.team\.invite\(input\)/,
  );
  assert.match(
    await read(root, 'tests/user-notes.team.invite.server.test.ts'),
    /await member\["user-notes"\]\.team\.invite\(\{ title: 'First' \}\)/,
  );

  await assert.rejects(
    addContribution('action', 'todos/then', { cwd: root, server: true }),
    /"then" cannot name a server operation/,
  );
  await assert.rejects(
    addContribution('page', 'todos/stats', { cwd: root, server: true }),
    /--server applies to action, service, interceptor, installer, not to page\./,
  );
  // An installer: the file name is the kind; --server puts it under server/installers.
  await addContribution('installer', 'todos/media.storage', { cwd: root, server: true });
  assert.match(
    await read(root, 'src/plugins/todos/server/installers/media/storage.ts'),
    /import \{ defineInstaller \} from '@bitakit\/core\/server';[\s\S]*defineInstaller<'media\.storage'>/,
  );
  await addContribution('installer', 'todos/topics', { cwd: root });
  assert.match(
    await read(root, 'src/plugins/todos/installers/topics.ts'),
    /import \{ defineInstaller \} from '@bitakit\/core';[\s\S]*defineInstaller<'topics'>/,
  );
  const plugin = await project(
    { 'package.json': { name: '@acme/notes', bitakit: { plugin: './plugin' } } },
    t,
  );
  await assert.rejects(
    addContribution('action', 'add', { cwd: plugin, server: true }),
    /Plugin packages have no server half yet/,
  );

  const start = await project(
    {
      'package.json': {
        name: 'start',
        dependencies: { '@tanstack/react-start': '1.168.59', '@bitakit/core': '^0.3.0' },
      },
      'bitakit.config.ts': "export default { server: { endpoint: '/rpc' } };\n",
    },
    t,
  );
  const route = await addContribution('action', 'todos/add', { cwd: start, server: true });
  assert.deepEqual(route.route, { file: 'src/routes/rpc.$.ts', created: true });
  assert.equal(
    await read(start, 'src/routes/rpc.$.ts'),
    `import { createFileRoute } from '@tanstack/react-router';
// Types the server option even when tsr generate wrote routeTree.gen.ts without Start's types.
import type {} from '@tanstack/react-start';
import { fetchHandler } from '@bitakit/core/server';
import { server } from '../bitakit.gen.server';

const handle = fetchHandler(server);

// Every BitaKit server operation the browser calls: POST /rpc/<operation id>.
export const Route = createFileRoute('/rpc/$')({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
`,
  );
  // The TanStack route counts as answering the endpoint because it has server handlers.
  const again = await addContribution('action', 'todos/remove', { cwd: start, server: true });
  assert.deepEqual(again.route, { file: 'src/routes/rpc.$.ts', created: false });
});

test('bitakit add action --server prints the files, the remote call and the setup', async (t) => {
  const root = await project(nextApp({ ...catchAll }), t);
  const { code, stdout } = await bitakit(root, 'add', 'action', 'todos/add', '--server');
  assert.equal(code, 0);
  assert.match(stdout, /Created server action "server:todos\.add":/);
  assert.match(stdout, /\+ src\/plugins\/todos\/server\/actions\/add\.ts/);
  assert.match(stdout, /\+ tests\/todos\.add\.server\.test\.ts/);
  assert.match(stdout, /\+ src\/app\/api\/rpc\/\[\.\.\.path\]\/route\.ts/);
  assert.match(stdout, /the browser calls it with remote\.todos\.add\(input\)/);
  // The stubbed Core predates @bitakit/core/server.
  assert.match(
    stdout,
    /Before the first run:\n {2}npm install zod\n {2}npm install @bitakit\/core@latest @bitakit\/discovery@latest\n/,
  );
  const help = await bitakit(root, 'add', 'action', '--help');
  assert.match(help.stdout, /--server/);
  const rejected = await bitakit(root, 'add', 'page', 'todos/stats', '--server');
  assert.notEqual(rejected.code, 0);
});

test('a broader API catch-all that does not call BitaKit is not the RPC route', async (t) => {
  const hono =
    "import { Hono } from 'hono';\nimport { handle } from 'hono/vercel';\nconst app = new Hono().basePath('/api');\nexport const GET = handle(app);\nexport const POST = handle(app);\n";
  const root = await project(
    nextApp({ ...tsconfig, ...catchAll, 'src/app/api/[[...route]]/route.ts': hono }),
    t,
  );
  const result = await addContribution('action', 'todos/add', { cwd: root, server: true });
  assert.deepEqual(result.route, { file: 'src/app/api/rpc/[...path]/route.ts', created: true });
  assert.ok(relative(root, result.created).includes('src/app/api/rpc/[...path]/route.ts'));
  assert.equal(
    status((await doctor({ cwd: root })).results, /answers \/api\/rpc\/<operation id>/),
    'ok',
  );

  // Without the RPC route, doctor names the catch-all that would answer instead.
  await rm(path.join(root, 'src/app/api/rpc'), { recursive: true });
  const route = find((await doctor({ cwd: root })).results, /No route answers the exposed/);
  assert.equal(route.status, 'warn');
  assert.match(
    route.details[1],
    /^src\/app\/api\/\[\[\.\.\.route\]\]\/route\.ts catches \/api\/rpc\/<operation id> but does not call fetchHandler/,
  );
  assert.match(route.fix, /^Create src\/app\/api\/rpc\/\[\.\.\.path\]\/route\.ts:/);

  // A TanStack route with handlers of its own does not count either.
  const start = await project(
    {
      'package.json': {
        name: 'start',
        dependencies: { '@tanstack/react-start': '1.168.59', '@bitakit/core': '^0.3.0' },
      },
      'src/routes/api/$.ts':
        "import { createFileRoute } from '@tanstack/react-router';\nexport const Route = createFileRoute('/api/$')({ server: { handlers: { POST: () => new Response('no') } } });\n",
    },
    t,
  );
  const written = await addContribution('action', 'todos/add', { cwd: start, server: true });
  assert.deepEqual(written.route, { file: 'src/routes/api/rpc.$.ts', created: true });
});

test('add --server writes no route where the framework has no server host, and doctor says how to serve it', async (t) => {
  const vite = await project(
    {
      'package.json': {
        name: 'spa',
        dependencies: { vite: '7.0.0', react: '19.0.0', '@bitakit/core': '^0.3.0' },
      },
    },
    t,
  );
  const result = await addContribution('action', 'todos/add', { cwd: vite, server: true });
  assert.equal(result.route, undefined);
  assert.deepEqual(relative(vite, result.created), [
    'src/plugins/todos/actions/add.ts',
    'src/plugins/todos/server/actions/add.ts',
    'tests/todos.add.server.test.ts',
  ]);
  assert.equal(
    result.noHost,
    "Serve POST /api/rpc/<operation id> in your HTTP server with fetchHandler(server) from '@bitakit/core/server' and server from src/bitakit.gen.server.ts.",
  );
  const missing = find((await doctor({ cwd: vite })).results, /No server answers the exposed/);
  assert.equal(missing.status, 'warn');
  assert.equal(missing.fix, result.noHost);
  // A server of the app's own that calls fetchHandler with the generated server answers it.
  await write(vite, {
    'server.ts':
      "import { fetchHandler } from '@bitakit/core/server';\nimport { server } from './src/bitakit.gen.server';\nexport default { fetch: fetchHandler(server) };\n",
  });
  assert.equal(
    status((await doctor({ cwd: vite })).results, /^server\.ts serves \/api\/rpc\/<operation id>/),
    'ok',
  );

  // TanStack Router without Start renders in the browser only: no Start route.
  const router = await project(
    {
      'package.json': {
        name: 'router',
        dependencies: { '@tanstack/react-router': '1.168.59', '@bitakit/core': '^0.3.0' },
      },
    },
    t,
  );
  const routerResult = await addContribution('action', 'todos/add', { cwd: router, server: true });
  assert.equal(routerResult.route, undefined);
  assert.ok(!relative(router, routerResult.created).some((file) => file.startsWith('src/routes')));
  const { stdout } = await bitakit(router, 'add', 'action', 'todos/remove', '--server');
  assert.match(stdout, /This app's framework has no server route BitaKit writes\. Serve POST/);
});

test('add --server says when no service provides requestContext yet, and names a kept button', async (t) => {
  const root = await project(
    nextApp({
      ...catchAll,
      // A record file declares the button todos.add.
      'src/plugins/todos/actions.ts':
        "import { defineAction } from '@bitakit/core';\nexport default { add: defineAction({ title: 'Add', execute: () => null }) };\n",
    }),
    t,
  );
  const result = await addContribution('action', 'todos/add', { cwd: root, server: true });
  assert.equal(result.needsProvider, true);
  assert.deepEqual(relative(root, result.kept), ['src/plugins/todos/actions.ts']);
  assert.match(
    await read(root, 'src/plugins/todos/server/actions/add.ts'),
    /^\/\/ The operation todos\.add\. It runs only on the server; the button add in actions\.ts calls it\n/,
  );
  const { stdout } = await bitakit(root, 'add', 'action', 'todos/archive', '--server');
  assert.match(
    stdout,
    /Before the browser can call it: add src\/server\/services\/request-context\.ts with defineService\(\(\) => \(\{ resolve: \(request\) => \(\{ user, organization \}\) \}\), \{ provides: requestContext \}\) from '@bitakit\/core\/server'/,
  );
  assert.match(stdout, /The test passes without it because mountServer brings its own\./);

  await write(root, {
    'src/server/services/request-context.ts':
      "import { defineService, requestContext } from '@bitakit/core/server';\nexport default defineService(() => ({ resolve: () => ({ user: null }) }), { provides: requestContext });\n",
  });
  const provided = await addContribution('action', 'todos/remove', { cwd: root, server: true });
  assert.equal(provided.needsProvider, false);
  assert.doesNotMatch(
    (await bitakit(root, 'add', 'action', 'todos/rename', '--server')).stdout,
    /Before the browser can call it/,
  );
});

test('doctor reports code that imports the generated server file once no module has a server half', async (t) => {
  const root = await project(
    nextApp({
      ...tsconfig,
      ...catchAll,
      'src/app/api/rpc/[...path]/route.ts':
        "import { fetchHandler } from '@bitakit/core/server';\nimport { server } from '@/bitakit.gen.server';\nexport const POST = fetchHandler(server);\n",
      'src/plugins/todos/server/actions/add.ts': operation(),
    }),
    t,
  );
  assert.equal(
    find((await doctor({ cwd: root })).results, /no module has a server half/),
    undefined,
  );
  await write(root, {
    'bitakit.config.ts':
      'export default { plugins: { overrides: { todos: { enabled: false } } } };\n',
  });
  const problem = find((await doctor({ cwd: root })).results, /no module has a server half/);
  assert.equal(problem.status, 'error');
  assert.deepEqual(problem.details, [
    'src/app/api/rpc/[...path]/route.ts imports src/bitakit.gen.server.ts, which discovery writes only while a server half exists.',
  ]);
  assert.match(problem.fix, /Delete the route/);
});

test('with a discovery that predates server/ folders, add --server asks for the update and doctor says so', async (t) => {
  // A copy of the CLI next to a discovery that reports no server/ folders, as 0.3.0 did.
  const repo = path.resolve(import.meta.dirname, '../../..');
  const copy = await project({}, t);
  await cp(path.join(import.meta.dirname, '../src'), path.join(copy, 'cli/src'), {
    recursive: true,
  });
  await write(copy, {
    'cli/package.json': { name: '@bitakit/cli', type: 'module' },
    'cli/node_modules/@bitakit/discovery/package.json': {
      name: '@bitakit/discovery',
      type: 'module',
      exports: { '.': './index.mjs' },
    },
    'cli/node_modules/@bitakit/discovery/index.mjs': `export * from ${JSON.stringify(path.join(repo, 'packages/discovery/src/index.mjs'))};
import { describeModule as describe, describeBitaKit as describeAll } from ${JSON.stringify(path.join(repo, 'packages/discovery/src/index.mjs'))};
const old = (module) => { delete module.server; return module; };
export const describeModule = async (...args) => old(await describe(...args));
export const describeBitaKit = async (...args) => {
  const description = await describeAll(...args);
  [description.app, ...description.plugins].forEach(old);
  return description;
};
`,
  });
  for (const name of [
    'typescript',
    'commander',
    'semver',
    'npm-check-updates',
    'package-manager-detector',
  ])
    await symlink(
      path.join(repo, 'node_modules', name),
      path.join(copy, 'cli/node_modules', name),
      'dir',
    );
  await symlink(
    path.join(repo, 'packages/core'),
    path.join(copy, 'cli/node_modules/@bitakit/core'),
    'dir',
  );
  const old = await import(path.join(copy, 'cli/src/index.mjs'));
  const root = await project(nextApp({ ...catchAll }), t);
  // Core's stub has no /server entry either: both packages.
  const result = await old.addContribution('action', 'todos/add', { cwd: root, server: true });
  assert.ok(result.setup.includes('npm install @bitakit/core@latest @bitakit/discovery@latest'));
  // With a Core that has /server, only discovery.
  await rm(path.join(root, 'node_modules/@bitakit/core'), { recursive: true });
  await link(root, '@bitakit/core', 'packages/core');
  const second = await old.addContribution('action', 'todos/remove', { cwd: root, server: true });
  assert.ok(
    second.setup.includes('npm install @bitakit/discovery@latest'),
    second.setup.join('\n'),
  );
  const warning = find((await old.doctor({ cwd: root })).results, /does not read server\/ folders/);
  assert.equal(warning.status, 'warn');
  assert.match(warning.details[0], /^src\/plugins\/todos\/server holds server Actions/);
  assert.match(warning.fix, /npm install @bitakit\/discovery@latest/);
});

test('info lists server Actions, services and interceptors as their own kinds, printed as server:<id>', async (t) => {
  const root = await project(
    nextApp({
      'src/plugins/todos/actions/add.ts': button,
      'src/plugins/todos/server/actions/add.ts': operation(),
      'src/plugins/todos/server/actions.ts': `import { defineAction } from '@bitakit/core/server';
export default { list: defineAction({ access: 'user', execute: () => [] }), team: { invite: defineAction({ access: 'user', execute: () => 1 }) } };
`,
      'src/plugins/todos/server/services/store.ts':
        "import { defineService } from '@bitakit/core/server';\nexport default defineService(() => ({}));\n",
      'src/plugins/todos/server/interceptors/audit.ts':
        "import { defineInterceptor } from '@bitakit/core/server';\nexport default defineInterceptor({ before: () => {} });\n",
      'src/server/actions/health.ts': operation("'public'"),
    }),
    t,
  );
  const inventory = await inspectionFromDescription(await describeBitaKit(root));
  const ids = (id) =>
    inventory.static.plugins
      .find((plugin) => plugin.id === id)
      .declarations.map((entry) => `${entry.kind} ${entry.id ?? entry.source}`)
      .sort();
  assert.deepEqual(ids('todos'), [
    'action todos.add',
    'server-action todos.add',
    'server-action todos.list',
    'server-action todos.team.invite',
    'server-interceptor src/plugins/todos/server/interceptors/audit.ts',
    'server-service todos.store',
  ]);
  // App operations are unprefixed, as on the client.
  assert.deepEqual(ids('app'), ['server-action health']);
  const { stdout } = await bitakit(root, 'info');
  assert.match(stdout, /\n {2}action: todos\.add\n/);
  assert.match(
    stdout,
    /\n {2}server-action: server:todos\.add, server:todos\.list, server:todos\.team\.invite\n/,
  );
  assert.match(stdout, /\n {2}server-service: server:todos\.store\n/);
  assert.match(stdout, /\n {2}server-action: server:health\n/);
});

test('the agent rules name the server and stay within one screen with Shell', () => {
  for (const routes of ['src/app', 'app', 'src/routes'])
    for (const shell of [false, true]) {
      const rules = agentRules({ routes, shell });
      assert.ok(rules.length <= 3200, `${routes}, shell ${shell}: ${rules.length} characters`);
      assert.ok(rules.split('\n').length <= 40, `${routes}, shell ${shell}: too many lines`);
      assert.match(
        rules,
        /\| Server data or secrets \| `server\/actions\/<file>\.ts` \(`access`, `expose: true`\); buttons call `remote\.<name>\.<file>\(\)` \|/,
      );
      assert.match(rules, /\(`--server` for\n {2}`server\/`;/);
    }
});
