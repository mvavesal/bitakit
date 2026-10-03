#!/usr/bin/env node
// Builds and packs @bitakit packages into one directory, so generated projects can install the
// workspace state exactly as npm would deliver it: `create-app --packages-dir <directory>`.
// Usage: node scripts/pack-packages.mjs <directory> [package ...]
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const [target = path.join(root, '.packs'), ...selected] = process.argv.slice(2);
const destination = path.resolve(target);
// Dependency order: each package builds after the packages it imports.
const order = [
  'core',
  'discovery',
  'ui',
  'app-preferences',
  'next',
  'tanstack',
  'organizations',
  'email',
  'better-auth',
  'next-intl',
  'nodemailer',
  'shell',
  'better-auth-ui',
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
  if (manifest.scripts?.build)
    execFileSync('npm', ['run', 'build'], { cwd: directory, stdio: 'ignore' });
  execFileSync('npm', ['pack', '--pack-destination', destination], {
    cwd: directory,
    stdio: 'ignore',
  });
  console.log(`packed ${manifest.name}@${manifest.version}`);
}
