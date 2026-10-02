import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { addContribution, addPlugin, doctor } from '../src/index.mjs';

async function project(files) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-cli-'));
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return root;
}
const app = (extra = {}) =>
  project({
    'package.json': { name: 'demo', dependencies: { next: '16.0.0', '@bitakit/core': '^0.2.0', '@bitakit/shell': '^0.2.0' } },
    'node_modules/@bitakit/core/package.json': { name: '@bitakit/core', version: '0.2.0' },
    'node_modules/@bitakit/shell/package.json': { name: '@bitakit/shell', version: '0.2.0' },
    'src/app/layout.tsx': 'export default function Layout() {}',
    'src/app/(app)/layout.tsx': "import { AppShell } from '@bitakit/shell';",
    'src/app/(app)/page.tsx': 'export default function Page() {}',
    ...extra,
  });
const status = (results, title) => results.find((result) => result.title.match(title))?.status;

test('add plugin writes a complete feature folder and never overwrites', async () => {
  const root = await app();
  try {
    const result = await addPlugin('user-notes', { cwd: root });
    assert.equal(result.path, '/user-notes');
    assert.deepEqual(
      result.created.map((file) => path.relative(root, file)).sort(),
      [
        'src/plugins/user-notes/actions/add.ts',
        'src/plugins/user-notes/actions/clear.ts',
        'src/plugins/user-notes/actions/open.ts',
        'src/plugins/user-notes/actions/remove.ts',
        'src/plugins/user-notes/pages/user-notes.tsx',
        'src/plugins/user-notes/services/user-notes.ts',
      ],
    );
    const add = await readFile(path.join(root, 'src/plugins/user-notes/actions/add.ts'), 'utf8');
    // A plugin's own service needs no requires entry.
    assert.doesNotMatch(add, /requires/);
    assert.match(add, /services\["user-notes"\]\.add\(input\)/);
    const page = await readFile(path.join(root, 'src/plugins/user-notes/pages/user-notes.tsx'), 'utf8');
    assert.match(page, /function UserNotesPage\(\)/);
    assert.match(page, /definePage\(\{ path: '\/user-notes', component: UserNotesPage \}\)/);
    await assert.rejects(addPlugin('user-notes', { cwd: root }), /already exists/);
    await assert.rejects(addPlugin('Bad Name', { cwd: root }), /Invalid plugin name/);
    await assert.rejects(addPlugin('settings', { cwd: root }), /reserved/);
    const minimal = await addPlugin('stats', { cwd: root, minimal: true });
    assert.equal(minimal.created.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('add action, service and page target an existing plugin', async () => {
  const root = await app();
  try {
    await addPlugin('notes', { cwd: root, minimal: true });
    const action = await addContribution('action', 'notes/archive', { cwd: root });
    assert.equal(action.id, 'notes.archive');
    const page = await addContribution('page', 'notes/stats', { cwd: root });
    assert.equal(page.path, '/notes/stats');
    assert.match(
      await readFile(path.join(root, 'src/plugins/notes/pages/stats.tsx'), 'utf8'),
      /definePage\(\{ path: '\/notes\/stats', component: NotesStatsPage \}\)/,
    );
    await assert.rejects(addContribution('action', 'archive', { cwd: root }), /Name the plugin too/);
    await assert.rejects(addContribution('service', 'missing/x', { cwd: root }), /does not exist/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('doctor reports unreachable plugin pages with the exact route to add', async () => {
  const root = await app();
  try {
    await addPlugin('notes', { cwd: root });
    let { results } = await doctor({ cwd: root });
    assert.equal(status(results, /versions|packages are/), 'ok');
    const pages = results.find((result) => result.title.match(/plugin pages/));
    assert.equal(pages.status, 'error');
    assert.match(pages.fix, /src\/app\/\(app\)\/\[\.\.\.path\]\/page\.tsx/);
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'demo', dependencies: { next: '16.0.0', '@bitakit/shell': '^0.2.0' } }));
    await mkdir(path.join(root, 'src/app/(app)/[...path]'), { recursive: true });
    await writeFile(path.join(root, 'src/app/(app)/[...path]/page.tsx'), 'export default function Page() {}');
    ({ results } = await doctor({ cwd: root }));
    assert.equal(status(results, /plugin page/), 'ok');
    assert.equal(status(results, /navigation link/), 'ok');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('doctor finds dead links, service collisions and mixed versions', async () => {
  const root = await app({
    'node_modules/@bitakit/ui/package.json': { name: '@bitakit/ui', version: '0.1.0' },
    'src/plugins/a/services/store.ts': "export default defineService({ create: () => ({}) });",
    'src/plugins/b/services/store.ts': "export default defineService({ create: () => ({}) });",
    'src/plugins/b/actions/open.ts': "export default defineURLAction({ title: 'B', href: '/missing', groups: ['navigation'] });",
  });
  try {
    const { results } = await doctor({ cwd: root });
    assert.equal(status(results, /Mixed @bitakit versions/), 'error');
    assert.equal(status(results, /Service names collide/), 'error');
    const links = results.find((result) => result.title.match(/links lead nowhere/));
    assert.equal(links.status, 'warn');
    assert.match(links.details[0], /plugin "b" links to \/missing/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
