import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { planProject, createApp } from '../src/create-app.mjs';

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'foundation-create-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// The real official scaffold/install/build path is also verified against packed packages.
async function scaffoldOnly(command, args) {
  assert.equal(command, process.execPath);
  assert.ok(args.includes('--skip-install'));
  assert.ok(args.includes('--disable-git'));
  const target = args[1];
  await mkdir(path.join(target, 'src/app'), { recursive: true });
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({ dependencies: { next: '16.3.5' }, devDependencies: {}, scripts: {} }),
  );
  await writeFile(path.join(target, '.gitignore'), 'node_modules/\n');
}

test('rejects existing directories and symlinks without touching user files', async (t) => {
  const root = await workspace(t);
  const existing = path.join(root, 'existing');
  await mkdir(existing);
  await writeFile(path.join(existing, 'keep.txt'), 'user content');
  await symlink(existing, path.join(root, 'linked'));
  await assert.rejects(planProject(existing), /already exists/);
  await assert.rejects(planProject(path.join(root, 'linked')), /already exists/);
  assert.equal(await readFile(path.join(existing, 'keep.txt'), 'utf8'), 'user content');
});

test('resolves feature prerequisites and refuses unsupported selections before writing', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'app');
  const plan = await planProject(target, { features: ['quick-search', 'shell'] });
  assert.deepEqual(plan.features, ['preferences', 'shell', 'quick-search']);
  await assert.rejects(planProject(target, { framework: 'unsupported' }), /Unsupported framework/);
  await assert.rejects(planProject(target, { features: ['unknown'] }), /Unknown feature/);
  await assert.rejects(access(target));
});

test('minimal output has one root provider, no demo, no backend or optional packages', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), { install: false });
  await createApp(plan, { run: scaffoldOnly });
  const manifest = JSON.parse(await readFile(path.join(plan.target, 'package.json')));
  assert.equal(manifest.dependencies['@bitakit/shell'], undefined);
  assert.equal(manifest.dependencies['@bitakit/better-auth'], undefined);
  assert.equal(manifest.dependencies.nuqs, undefined);
  assert.equal(manifest.dependencies['@bitakit/next'], '0.1.0');
  const layout = await readFile(path.join(plan.target, 'src/app/layout.tsx'), 'utf8');
  assert.equal(layout.match(/<FoundationProvider>/g).length, 1);
  await assert.rejects(access(path.join(plan.target, 'src/components')));
  await assert.rejects(access(path.join(plan.target, 'src/app/settings')));
  assert.match(
    await readFile(path.join(plan.target, 'src/app/globals.css'), 'utf8'),
    /ui\/theme.css/,
  );
});

test('shell output delegates URL adapter to Next and native settings routes without copied plugin code', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), {
    features: ['quick-search'],
    install: false,
  });
  await createApp(plan, { run: scaffoldOnly });
  const manifest = JSON.parse(await readFile(path.join(plan.target, 'package.json')));
  assert.equal(manifest.dependencies['@bitakit/app-preferences'], '0.1.0');
  assert.equal(manifest.dependencies['@bitakit/quick-search'], '0.1.0');
  assert.doesNotMatch(await readFile(path.join(plan.target, 'src/app/layout.tsx'), 'utf8'), /NuqsAdapter/);
  await access(path.join(plan.target, 'src/app/settings/[section]/page.tsx'));
  await access(path.join(plan.target, 'src/app/(workspace)/page.tsx'));
  await assert.rejects(access(path.join(plan.target, 'src/plugins')));
  await assert.rejects(access(path.join(plan.target, 'src/app/page.tsx')));
});

test('CLI dry-run does not create files and unsupported framework exits with an error', async (t) => {
  const root = await workspace(t);
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const target = path.join(root, 'app');
  const result = await execa(process.execPath, [
    cli,
    target,
    '--features',
    'quick-search',
    '--dry-run',
    '--yes',
  ]);
  assert.match(result.stdout, /preferences, shell, quick-search/);
  await assert.rejects(access(target));
  const rejected = await execa(
    process.execPath,
    [cli, target, '--framework', 'unsupported', '--yes'],
    { reject: false },
  );
  assert.notEqual(rejected.exitCode, 0);
  await assert.rejects(access(target));
});

test('installation failures propagate and leave generated files available for inspection', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'));
  await assert.rejects(
    createApp(plan, {
      run: async (command, args) => {
        if (command === 'npm') throw new Error('Registry unavailable');
        await scaffoldOnly(command, args);
      },
    }),
    /Registry unavailable/,
  );
  await access(path.join(plan.target, 'package.json'));
});


test('TanStack selection installs only its host adapter and generates native settings routes', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'start'), { framework: 'tanstack', features: ['shell'], install: false });
  await createApp(plan, { run: async (_command, args) => {
    assert.ok(args.includes('--blank'));
    assert.ok(args.includes('--no-install'));
    assert.ok(args.includes('--no-git'));
    await mkdir(plan.target, { recursive: true });
    await writeFile(path.join(plan.target, 'package.json'), JSON.stringify({ dependencies: {}, scripts: {} }));
  } });
  const manifest = JSON.parse(await readFile(path.join(plan.target, 'package.json')));
  assert.equal(manifest.dependencies['@bitakit/tanstack'], '0.1.0');
  assert.equal(manifest.dependencies['@bitakit/next'], undefined);
  await access(path.join(plan.target, 'src/routes/settings.$section.tsx'));
  assert.match(await readFile(path.join(plan.target, 'src/routes/__root.tsx'), 'utf8'), /FoundationProvider/);
});
