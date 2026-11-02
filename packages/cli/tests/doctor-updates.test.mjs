import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { checkUpdates, updateCommand, updatePackages } from '../src/doctor-updates.mjs';
import { writeAppDevelopmentSkills } from '../src/agent-skill.mjs';

async function fixture(t, dependencies = { '@bitakit/core': '^0.2.1', '@bitakit/cli': '^0.2.1' }) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-updates-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'test-app', packageManager: 'npm@11.0.0', dependencies }),
  );
  for (const name of Object.keys(dependencies)) {
    const folder = path.join(root, 'node_modules', name);
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, 'package.json'),
      JSON.stringify({ name, version: name === 'react' ? '18.0.0' : '0.2.1' }),
    );
  }
  return realpath(root);
}

async function registry(t, root, { peer = false, unavailable = false } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, authorization: req.headers.authorization });
    res.setHeader('Content-Type', 'application/json');
    if (unavailable) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'private registry unavailable' }));
      return;
    }
    const name = decodeURIComponent(req.url.slice(1)).split('?')[0];
    const versions = name === 'react' ? ['18.0.0', '19.0.0'] : ['0.2.1', '0.2.2', '0.3.0'];
    res.end(
      JSON.stringify({
        name,
        'dist-tags': { latest: versions.at(-1) },
        versions: Object.fromEntries(
          versions.map((version) => [
            version,
            {
              name,
              version,
              ...(peer && name === '@bitakit/core' && version !== '0.2.1'
                ? { peerDependencies: { react: '^19.0.0' } }
                : {}),
            },
          ]),
        ),
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = `127.0.0.1:${server.address().port}`;
  await writeFile(
    path.join(root, '.npmrc'),
    `registry=http://${address}/\n//${address}/:_authToken=test-private-token\n`,
  );
  return requests;
}

test('read-only registry check distinguishes latest from allowed update and preserves config/auth and files', async (t) => {
  const root = await fixture(t);
  const requests = await registry(t, root);
  await writeAppDevelopmentSkills(root);
  const before = await readFile(path.join(root, 'package.json'), 'utf8');
  const report = await checkUpdates({ cwd: root });
  const core = report.packages.find(({ name }) => name === '@bitakit/core');
  assert.equal(core.latest, '0.3.0');
  assert.equal(core.candidate, '0.2.2');
  assert.equal(core.status, 'update');
  assert.ok(requests.length > 0);
  assert.ok(requests.every(({ authorization }) => authorization === 'Bearer test-private-token'));
  assert.equal(await readFile(path.join(root, 'package.json'), 'utf8'), before);
  assert.ok(report.skills.every(({ state }) => state === 'current'));
  assert.ok(!JSON.stringify(report).includes('test-private-token'));
});

test('peer conflict outside the BitaKit namespace prevents a compatible candidate', async (t) => {
  const root = await fixture(t, {
    '@bitakit/core': '^0.2.1',
    '@bitakit/cli': '^0.2.1',
    react: '^18.0.0',
  });
  await registry(t, root, { peer: true });
  const report = await checkUpdates({ cwd: root });
  assert.equal(report.packages.find(({ name }) => name === '@bitakit/core').candidate, '0.2.1');
  assert.ok(!report.packages.some(({ name }) => name === 'react'));
});

test('inaccessible registry is unknown, not current; mutation is refused', async (t) => {
  const root = await fixture(t);
  await registry(t, root, { unavailable: true });
  const report = await checkUpdates({ cwd: root });
  assert.ok(report.packages.every(({ status }) => status === 'unknown'));
  await assert.rejects(
    updatePackages({ check: async () => report, execute: () => assert.fail('must not execute') }),
    /incomplete/,
  );
});

test('lookup failure does not leak registry credentials', async (t) => {
  const root = await fixture(t);
  const report = await checkUpdates({
    cwd: root,
    lookup: async () => {
      throw new Error('https://user:secret@registry.example');
    },
  });
  assert.ok(!JSON.stringify(report).includes('secret'));
  assert.ok(report.packages.every(({ status }) => status === 'unknown'));
});

for (const [agent, name, command, verb] of [
  ['npm', 'npm', 'npm', 'update'],
  ['pnpm', 'pnpm', 'pnpm', 'update'],
  ['yarn', 'yarn', 'yarn', 'upgrade'],
  ['yarn@berry', 'yarn', 'yarn', 'up'],
  ['bun', 'bun', 'bun', 'update'],
]) {
  test(`update uses ${agent} and limits explicit targets to BitaKit`, () => {
    const result = updateCommand({
      manager: { agent, name },
      packages: [{ name: '@bitakit/core', range: '^0.2.1', installed: '0.2.1', status: 'update' }],
    });
    assert.equal(result.command, command);
    assert.equal(result.args[0], verb);
    assert.equal(result.args[1], agent === 'yarn@berry' ? '@bitakit/core@^0.2.1' : '@bitakit/core');
    assert.ok(!result.args.includes('--latest'));
  });
}

test('broad constraints require a migration decision before mutation', () => {
  assert.throws(
    () =>
      updateCommand({
        manager: { agent: 'npm', name: 'npm' },
        packages: [{ name: '@bitakit/core', range: '*', installed: '0.2.1', status: 'update' }],
      }),
    /another release line/,
  );
});

test('failed install never refreshes skills; successful update delegates to the local CLI init', async (t) => {
  const root = await fixture(t);
  const report = {
    root,
    manager: { agent: 'npm', name: 'npm' },
    supportedManager: true,
    packages: [{ name: '@bitakit/cli', range: '^0.2.1', installed: '0.2.1', status: 'update' }],
    notes: [],
  };
  let calls = [];
  await assert.rejects(
    updatePackages({
      check: async () => report,
      execute: async (...args) => {
        calls.push(args);
        throw new Error('install failed');
      },
    }),
    /install failed/,
  );
  assert.equal(calls.length, 1);
  calls = [];
  await updatePackages({
    check: async () => report,
    execute: async (...args) => {
      calls.push(args);
    },
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1][1].slice(1), ['init', '--update-agent-files']);
  assert.equal(calls[1][1][0], path.join(root, 'node_modules/@bitakit/cli/src/cli.mjs'));
});

test('unsupported manager never mutates even without declared BitaKit packages', async () => {
  await assert.rejects(
    updatePackages({
      check: async () => ({
        manager: { name: 'deno', agent: 'deno' },
        supportedManager: false,
        packages: [],
      }),
      execute: () => assert.fail('must not execute'),
    }),
    /incomplete/,
  );
});

test('native range upgrades refuse a higher peer-incompatible version', () => {
  assert.throws(
    () =>
      updateCommand({
        manager: { name: 'npm', agent: 'npm' },
        packages: [
          {
            name: '@bitakit/core',
            status: 'update',
            range: '^0.2.1',
            installed: '0.2.1',
            candidate: '0.2.2',
            rangeLatest: '0.2.3',
          },
        ],
      }),
    /peer-incompatible/,
  );
});
