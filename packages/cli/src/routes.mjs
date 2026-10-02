import { readdir } from 'node:fs/promises';
import path from 'node:path';
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
  new RegExp(`^${parts.length ? parts.map((part) => `/${part}`).join('') : catchAll ? '' : '/'}${catchAll ? '(?:/.*)?' : '/?'}$`);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function nextRoutes(root) {
  const appDirectory = (await exists(path.join(root, 'src/app')))
    ? path.join(root, 'src/app')
    : path.join(root, 'app');
  const routes = [];
  for (const file of await walk(appDirectory)) {
    if (!/^(page|route)\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(file))) continue;
    const segments = path.relative(appDirectory, path.dirname(file)).split(path.sep).filter(Boolean);
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
