import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createPackageInstaller, createPackageJournal } from '../dist/server/index.js';
const run = promisify(execFile);
const temporary = async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bitakit-installer-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
};
async function fixture(root, version = '1.0.0') {
  const dir = path.join(root, 'source');
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'bitakit-runtime-test',
      version,
      type: 'module',
      bitakit: { plugin: './plugin', id: 'remote', styles: ['./style.css'] },
      exports: { './plugin': './plugin.js', './style.css': './style.css' },
      dependencies: { picocolors: '1.1.1' },
      optionalDependencies: { '@esbuild/win32-x64': '0.28.2' },
      peerDependencies: { '@bitakit/core': '^0.2.6' },
      scripts: {
        postinstall:
          'node -e ' +
          JSON.stringify(
            `require('node:fs').writeFileSync(${JSON.stringify(path.join(root, 'SCRIPT-RAN'))},'bad')`,
          ),
      },
    }),
  );
  await writeFile(
    path.join(dir, 'plugin.js'),
    `import {definePlugin,defineService} from '@bitakit/core'; import colors from 'picocolors'; export default ()=>definePlugin({id:'remote',services:{value:defineService(()=>({text:colors.red('${version}')}))}});`,
  );
  await writeFile(path.join(dir, 'style.css'), '.runtime-example { color: rgb(19, 94, 40); }');
  return dir;
}
test(
  'npm pack and Git sources install through npm with bundled dependencies, static IDs, CSS, provenance and retained bytes',
  { timeout: 120000 },
  async (t) => {
    const dir = await temporary(t);
    const source = await fixture(dir);
    const packed = JSON.parse(
      (await run('npm', ['pack', '--ignore-scripts', '--json'], { cwd: source })).stdout,
    )[0].filename;
    const installer = createPackageInstaller({
      directory: path.join(dir, 'store'),
      shared: { '@bitakit/core': '0.2.7' },
    });
    const tar = await installer.install(path.join(source, packed));
    await assert.rejects(readFile(path.join(dir, 'SCRIPT-RAN')), { code: 'ENOENT' });
    assert.equal(tar.name, 'bitakit-runtime-test');
    assert.deepEqual(tar.pluginIds, ['remote']);
    assert.equal(tar.styles.length, 1);
    assert.deepEqual(tar.imports, ['@bitakit/core']);
    assert.match(
      await readFile(path.join(installer.directory, tar.id, 'plugin.js'), 'utf8'),
      /System.register/,
    );
    const evidence = JSON.parse(
      await readFile(path.join(dir, 'store/evidence', `${tar.id}.json`), 'utf8'),
    );
    assert.equal(evidence.resolved.version, '1.0.0');
    assert.ok(evidence.lock.packages['node_modules/picocolors']);
    await run('git', ['init', '--quiet'], { cwd: source });
    await run('git', ['add', 'package.json', 'plugin.js', 'style.css'], { cwd: source });
    await run(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        'commit',
        '--quiet',
        '-m',
        'fixture',
      ],
      { cwd: source },
    );
    const commit = (await run('git', ['rev-parse', 'HEAD'], { cwd: source })).stdout.trim();
    const git = await installer.install(`git+file://${source}#${commit}`);
    const gitEvidence = JSON.parse(
      await readFile(path.join(dir, 'store/evidence', `${git.id}.json`), 'utf8'),
    );
    assert.match(gitEvidence.resolved.resolved, new RegExp(commit));
    assert.equal((await installer.read(tar.id)).id, tar.id);
    assert.equal((await installer.read(git.id)).id, git.id);
    await writeFile(path.join(installer.directory, tar.id, 'plugin.js'), 'tampered');
    await assert.rejects(installer.read(tar.id), /integrity mismatch/);
  },
);
test('peer incompatibility fails before producing an artifact', { timeout: 120000 }, async (t) => {
  const dir = await temporary(t);
  const source = await fixture(dir);
  const installer = createPackageInstaller({
    directory: path.join(dir, 'store'),
    shared: { '@bitakit/core': '9.0.0' },
  });
  await assert.rejects(installer.install(source), /host has 9.0.0/);
});
test('SQLite journal persists intent and rejects competing coordinators', async (t) => {
  const dir = await temporary(t);
  const file = path.join(dir, 'journal.sqlite');
  const a = createPackageJournal(file, 'session'),
    b = createPackageJournal(file, 'session');
  t.after(() => {
    a.close();
    b.close();
  });
  const record = {
    active: { scope: 'A', packages: [] },
    pending: {
      before: { scope: 'A', packages: [] },
      after: { scope: 'A', packages: [{ name: 'notes', version: '2', artifact: 'digest' }] },
    },
  };
  assert.equal(await a.write(0, record), 1);
  await assert.rejects(b.write(0, { active: { scope: 'B', packages: [] } }), /another coordinator/);
  assert.deepEqual((await b.read()).record, record);
});

test(
  'framework modules cannot silently become a second bundled singleton',
  { timeout: 120000 },
  async (t) => {
    const dir = await temporary(t);
    const source = await fixture(dir);
    const installer = createPackageInstaller({ directory: path.join(dir, 'store'), shared: {} });
    await assert.rejects(installer.install(source), /Unbound external import: @bitakit\/core/);
  },
);
