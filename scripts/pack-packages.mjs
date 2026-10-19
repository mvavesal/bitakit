#!/usr/bin/env node
// Builds and packs @bitakit packages into one directory, so generated projects can install the
// workspace state exactly as npm would deliver it: `create-app --packages-dir <directory>`.
// Usage: node scripts/pack-packages.mjs <directory> [package ...]
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const build = !process.argv.includes('--skip-build');
const [target = path.join(root, '.packs'), ...selected] = process.argv
  .slice(2)
  .filter((value) => value !== '--skip-build');
const destination = path.resolve(target);
// Dependency order: each package builds after the packages it imports.
const order = [
  'core',
  'packages',
  'discovery',
  'ui',
  'app-preferences',
  'next',
  'tanstack',
  'organizations',
  'email',
  'next-intl',
  'nodemailer',
  'shell',
  'quick-search',
  'devtools',
  'cli',
  'create-app',
];
const names = selected.length ? order.filter((name) => selected.includes(name)) : order;
await mkdir(destination, { recursive: true });
for (const file of await readdir(destination))
  if (/^bitakit-.+\.tgz$/.test(file)) await rm(path.join(destination, file));
for (const name of names) {
  const directory = path.join(root, 'packages', name);
  const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  if (build && manifest.scripts?.build) {
    // tsc never deletes output, so files from removed sources would otherwise ship.
    await rm(path.join(directory, 'dist'), { recursive: true, force: true });
    execFileSync('npm', ['run', 'build'], { cwd: directory, stdio: 'ignore' });
  }
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: directory,
    stdio: 'ignore',
  });
  console.log(`packed ${manifest.name}@${manifest.version}`);
}
