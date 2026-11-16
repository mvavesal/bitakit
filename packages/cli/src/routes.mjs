import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { exists } from './project.mjs';

/**
 * URL patterns of the routes the app's framework owns, approximated from file-based routing.
 * Each route: `{ file, pattern, catchAll }`. Used for diagnostics only.
 */
export async function appRoutes(project) {
  if (project.framework === 'next') return nextRoutes(project.root);
  if (project.framework === 'tanstack') return tanstackRoutes(project.root);
  return [];
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const result = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') result.push(...(await walk(file)));
    } else result.push(file);
  }
  return result;
}

const toPattern = (parts, catchAll) =>
  new RegExp(
    `^${parts.length ? parts.map((part) => `/${part}`).join('') : catchAll ? '' : '/'}${catchAll ? '(?:/.*)?' : '/?'}$`,
  );
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function nextRoutes(root) {
  const appDirectory = (await exists(path.join(root, 'src/app')))
    ? path.join(root, 'src/app')
    : path.join(root, 'app');
  const routes = [];
  for (const file of await walk(appDirectory)) {
    if (!/^(page|route)\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(file))) continue;
    const segments = path
      .relative(appDirectory, path.dirname(file))
      .split(path.sep)
      .filter(Boolean);
    // Parallel slots and intercepting routes mirror other routes.
    if (segments.some((segment) => segment.startsWith('@') || /^\(\.+\)/.test(segment))) continue;
    const parts = [];
    let catchAll = false;
    for (const segment of segments) {
      if (/^\(.+\)$/.test(segment)) continue;
      if (/^\[\[?\.\.\..+\]\]?$/.test(segment)) {
        catchAll = true;
        break;
      }
      parts.push(/^\[.+\]$/.test(segment) ? '[^/]+' : escape(segment));
    }
    routes.push({ file: path.relative(root, file), pattern: toPattern(parts, catchAll), catchAll });
  }
  return routes;
}

async function tanstackRoutes(root) {
  const directory = path.join(root, 'src/routes');
  const routes = [];
  for (const file of await walk(directory)) {
    if (!/\.(tsx|ts|jsx|js)$/.test(file) || /\.d\.ts$/.test(file)) continue;
    const relative = path.relative(directory, file).replace(/\.(tsx|ts|jsx|js)$/, '');
    const tokens = relative.split(/[\\/.]/).filter(Boolean);
    if (tokens[0] === '__root' || tokens.some((token) => token.startsWith('-'))) continue;
    const parts = [];
    let catchAll = false;
    for (const token of tokens) {
      if (token === 'index' || token === 'route' || token.startsWith('_') || /^\(.+\)$/.test(token))
        continue;
      if (token === '$') {
        catchAll = true;
        break;
      }
      parts.push(token.startsWith('$') ? '[^/]+' : escape(token.replace(/^\[(.*)\]$/, '$1')));
    }
    routes.push({ file: path.relative(root, file), pattern: toPattern(parts, catchAll), catchAll });
  }
  return routes;
}

/** The route file a framework adapter needs so plugin pages render, with its content. */
export function catchAllRoute(project, { shell, group = '(app)' }) {
  if (project.framework === 'tanstack')
    return {
      file: shell ? 'src/routes/_app/$.tsx' : 'src/routes/$.tsx',
      content: `import { createFileRoute } from '@tanstack/react-router';
import { PluginPage } from '@bitakit/ui';

export const Route = createFileRoute('${shell ? '/_app/$' : '/$'}')({ component: () => <PluginPage /> });
`,
    };
  return {
    file: shell ? `src/app/${group}/[...path]/page.tsx` : 'src/app/[...path]/page.tsx',
    content: `'use client';
import { PluginPage } from '@bitakit/ui';

export default function Page() {
  return <PluginPage />;
}
`,
  };
}

/**
 * Whether the app's framework runs the route `serverRoute` writes: Next route handlers, or the
 * server handlers of TanStack Start. TanStack Router alone, Vite and other setups have no server
 * host BitaKit writes a route for.
 */
export const hostsServerRoute = (project) =>
  project.framework === 'next' || (project.framework === 'tanstack' && Boolean(project.start));

/** A route that hands requests to BitaKit: it calls `fetchHandler` or imports the generated server. */
const callsBitaKit = /\bfetchHandler\b|bitakit\.gen\.server/;

/**
 * The app routes that catch POST requests under `endpoint` (`/api/rpc/x`): Next route handlers
 * (`route.ts`, never a page) or TanStack routes with server `handlers` whose path matches. Each
 * `{ file, pattern, catchAll, bitakit }`, where `bitakit` tells whether the route hands the call
 * to BitaKit. A broader API catch-all (Hono's `api/[[...route]]`) catches it too but answers on
 * its own; the more specific RPC route wins over it in both frameworks.
 */
export async function routesCatching(project, endpoint) {
  const probe = `${endpoint}/x`;
  const found = [];
  for (const route of await appRoutes(project)) {
    if (!route.pattern.test(probe)) continue;
    if (project.framework === 'next' && !/^route\./.test(path.basename(route.file))) continue;
    const source = await readFile(path.join(project.root, route.file), 'utf8').catch(() => '');
    if (project.framework === 'tanstack' && !/\bhandlers\b/.test(source)) continue;
    found.push({ ...route, bitakit: callsBitaKit.test(source) });
  }
  return found;
}

/** The app route that answers POST `<endpoint>/x` with BitaKit's `fetchHandler`, if any. */
export async function serverRouteFor(project, endpoint) {
  return (await routesCatching(project, endpoint)).find((route) => route.bitakit);
}

/** Whether the app's tsconfig.json maps `@/*` to its `src` folder, as create-next-app writes it. */
async function aliasesSource(project) {
  const file = path.join(project.root, 'tsconfig.json');
  const text = await readFile(file, 'utf8').catch(() => undefined);
  if (text === undefined) return false;
  const { config } = ts.parseConfigFileTextToJson(file, text);
  const target = config?.compilerOptions?.paths?.['@/*']?.[0];
  return (
    typeof target === 'string' &&
    path.resolve(project.root, target) ===
      path.join(project.appDirectory ?? path.join(project.root, 'src'), '*')
  );
}

/**
 * The RPC route `bitakit add action … --server` writes when no route answers `<endpoint>/x`:
 * every POST under the endpoint goes to the generated server's `fetchHandler`, which takes its
 * prefix from the same `server.endpoint`. `{ file, content }`, the file relative to the root;
 * `undefined` when the framework has no server host for it (see `hostsServerRoute`).
 */
export async function serverRoute(project, { endpoint = '/api/rpc' } = {}) {
  if (!hostsServerRoute(project)) return undefined;
  const segments = endpoint.split('/').filter(Boolean);
  const generated = path.join(
    project.appDirectory ?? path.join(project.root, 'src'),
    'bitakit.gen.server',
  );
  const from = (file) => {
    const relative = path
      .relative(path.dirname(path.join(project.root, file)), generated)
      .split(path.sep)
      .join('/');
    return relative.startsWith('.') ? relative : `./${relative}`;
  };
  if (project.framework === 'tanstack') {
    const file = `src/routes/${[...segments.slice(0, -1), `${segments.at(-1)}.$.ts`].join('/')}`;
    return {
      file,
      content: `import { createFileRoute } from '@tanstack/react-router';
// Types the server option even when tsr generate wrote routeTree.gen.ts without Start's types.
import type {} from '@tanstack/react-start';
import { fetchHandler } from '@bitakit/core/server';
import { server } from '${from(file)}';

const handle = fetchHandler(server);

// Every BitaKit server operation the browser calls: POST ${endpoint}/<operation id>.
export const Route = createFileRoute('/${segments.join('/')}/$')({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
`,
    };
  }
  const app = (await exists(path.join(project.root, 'src/app')))
    ? 'src/app'
    : (await exists(path.join(project.root, 'app')))
      ? 'app'
      : 'src/app';
  const file = `${app}/${segments.join('/')}/[...path]/route.ts`;
  const specifier = (await aliasesSource(project)) ? '@/bitakit.gen.server' : from(file);
  return {
    file,
    content: `import { fetchHandler } from '@bitakit/core/server';
import { server } from '${specifier}';

// Every BitaKit server operation the browser calls: POST ${endpoint}/<operation id>.
export const POST = fetchHandler(server);
`,
  };
}

/** The root layout files that mount the provider, per framework. */
export const rootLayouts = (project) =>
  project.framework === 'tanstack'
    ? ['src/routes/__root.tsx']
    : ['src/app/layout.tsx', 'app/layout.tsx'];

/** The Next route group whose layout renders `AppShell`, such as `(app)`; plugin pages belong in it. */
export async function shellGroup(project) {
  if (project.framework !== 'next') return undefined;
  const app = path.join(project.root, 'src/app');
  for (const entry of await readdir(app, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || !/^\(.+\)$/.test(entry.name)) continue;
    const layout = await readFile(path.join(app, entry.name, 'layout.tsx'), 'utf8').catch(() => '');
    if (layout.includes('AppShell')) return entry.name;
  }
  return undefined;
}

/**
 * What an app whose framework has no server host does instead of the route `serverRoute`
 * writes; `generated` is the generated server file relative to the project root.
 */
export const serverHostNote = (endpoint, generated) =>
  `Serve POST ${endpoint}/<operation id> in your HTTP server with fetchHandler(server) from '@bitakit/core/server' and server from ${generated}.`;
