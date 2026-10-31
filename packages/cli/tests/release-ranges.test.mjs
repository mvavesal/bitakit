import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

for (const mode of ['source archive', 'shallow detached PR'])
  test(`peer minima require a supplying release in a ${mode}`, async () => {
    const repo = path.resolve(import.meta.dirname, '../../..');
    const temporary = await mkdtemp(path.join(tmpdir(), 'bitakit-peer-minimum-'));
    let root = path.join(temporary, 'source');
    try {
      await mkdir(path.join(root, 'scripts'), { recursive: true });
      await cp(
        path.join(repo, 'scripts/check-versions.mjs'),
        path.join(root, 'scripts/check-versions.mjs'),
      );
      await cp(path.join(repo, 'package.json'), path.join(root, 'package.json'));
      await cp(path.join(repo, 'package-lock.json'), path.join(root, 'package-lock.json'));
      await cp(path.join(repo, '.changeset'), path.join(root, '.changeset'), { recursive: true });
      await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'));
      for (const folder of await readdir(path.join(repo, 'packages'))) {
        const file = path.join(repo, 'packages', folder, 'package.json');
        const value = await readFile(file, 'utf8').catch(() => null);
        if (!value) continue;
        await mkdir(path.join(root, 'packages', folder), { recursive: true });
        await writeFile(path.join(root, 'packages', folder, 'package.json'), value);
      }
      const discovery = JSON.parse(
        await readFile(path.join(root, 'packages/discovery/package.json'), 'utf8'),
      );
      const [major, minor, patch] = discovery.version.split('.').map(Number);
      const nextVersion = `${major}.${minor}.${patch + 1}`;
      let file = path.join(root, 'packages/core/package.json');
      const manifest = JSON.parse(await readFile(file, 'utf8'));
      manifest.peerDependencies['@bitakit/discovery'] = `^${nextVersion}`;
      await writeFile(file, JSON.stringify(manifest));
      await writeFile(
        path.join(root, '.changeset/fixture-peer.md'),
        "---\n'@bitakit/discovery': patch\n---\n\nFixture export.\n",
      );
      if (mode === 'shallow detached PR') {
        execFileSync('git', ['init', '-q', '-b', 'review'], { cwd: root });
        execFileSync(
          'git',
          ['add', 'package.json', 'package-lock.json', 'packages', '.changeset', 'scripts'],
          {
            cwd: root,
          },
        );
        execFileSync(
          'git',
          [
            '-c',
            'user.name=Fixture',
            '-c',
            'user.email=fixture@example.test',
            '-c',
            'core.hooksPath=/dev/null',
            'commit',
            '-qm',
            'Fixture baseline',
          ],
          { cwd: root },
        );
        const checkout = path.join(temporary, 'checkout');
        execFileSync('git', [
          'clone',
          '-q',
          '--depth=1',
          '--single-branch',
          pathToFileURL(root).href,
          checkout,
        ]);
        root = checkout;
        file = path.join(root, 'packages/core/package.json');
        await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'));
        execFileSync('git', ['checkout', '-q', '--detach'], { cwd: root });
        execFileSync('git', ['branch', '-D', 'review'], { cwd: root });
        assert.equal(
          execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
            cwd: root,
            encoding: 'utf8',
          }).trim(),
          'true',
        );
        assert.equal(
          execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/heads'], {
            cwd: root,
            encoding: 'utf8',
          }).trim(),
          '',
        );
      }
      const run = () =>
        execFileSync(process.execPath, ['scripts/check-versions.mjs'], {
          cwd: root,
          stdio: 'pipe',
          encoding: 'utf8',
        });
      assert.match(run(), /All .*packages/);
      manifest.peerDependencies['@bitakit/discovery'] = `^${major}.${minor}.${patch + 100}`;
      await writeFile(file, JSON.stringify(manifest));
      assert.throws(run, (error) =>
        String(error.stderr).includes('peerDependencies.@bitakit/discovery'),
      );
      manifest.peerDependencies['@bitakit/discovery'] = `^${nextVersion}`;
      await writeFile(file, JSON.stringify(manifest));
      for (const file of await readdir(path.join(root, '.changeset')))
        if (file.endsWith('.md') && file !== 'README.md')
          await rm(path.join(root, '.changeset', file));
      assert.throws(run, (error) =>
        String(error.stderr).includes('peerDependencies.@bitakit/discovery'),
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
