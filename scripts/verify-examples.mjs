#!/usr/bin/env node
// Verifies every app in examples/ the way a reader uses it: a copy installs freshly packed
// packages, then type check, doctor, production build and a browser walk through what its
// README promises. Needs the npm registry and Playwright's Chromium.
// Usage: node scripts/verify-examples.mjs [--only counter,todo] [--keep] [--skip-build]
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { useLocalPackages } from '../packages/create-app/src/create-app.mjs';
import { serve, smoke } from './fixtures/browser.mjs';
import { checks } from './fixtures/example-checks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const examples = path.join(root, 'examples');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : undefined;
const keep = argv.includes('--keep');
const work = await mkdtemp(path.join(tmpdir(), 'bitakit-examples-'));
const packs = path.join(work, 'packs');
// Local state a reader would not copy: installs, builds, agent skills installed per machine.
const skipped = new Set(['node_modules', '.next', '.agents', '.claude', 'next-env.d.ts']);

const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

async function verify(name) {
  const target = path.join(work, name);
  const step = async (label, fn) => {
    process.stdout.write(`  ${label}… `);
    const started = Date.now();
    const value = await fn();
    console.log(`ok (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    return value;
  };
  await cp(path.join(examples, name), target, {
    recursive: true,
    filter: (source) =>
      !skipped.has(path.basename(source)) && !path.basename(source).startsWith('bitakit.gen.'),
  });
  await useLocalPackages(target, packs);
  await step('install', () => run('npm', ['install', '--no-audit', '--no-fund'], target));
  await step('type check', () => run('npm', ['run', 'typecheck'], target));
  await step('doctor', () => run('npx', ['bitakit', 'doctor'], target));
  await step('build', () => run('npm', ['run', 'build'], target));
  const server = await step('start', () => serve('next', target));
  try {
    const { visits, expected } = checks[name];
    await step('browser', () => smoke(server.url, visits, undefined, { expected }));
  } finally {
    server.stop();
  }
}

const names = (await readdir(examples, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !only || only.includes(name));
const missing = names.filter((name) => !checks[name]);
if (missing.length) throw new Error(`No browser checks for: ${missing.join(', ')}.`);
const failures = [];
try {
  console.log(`Packing packages into ${packs}`);
  run(
    process.execPath,
    [
      path.join(root, 'scripts/pack-packages.mjs'),
      packs,
      ...(argv.includes('--skip-build') ? ['--skip-build'] : []),
    ],
    root,
  );
  for (const name of names) {
    console.log(name);
    try {
      await verify(name);
    } catch (error) {
      console.log('failed');
      failures.push(
        `${name}: ${String(error.stdout || error.stderr || error.message)
          .trim()
          .slice(-2000)}`,
      );
    }
  }
} finally {
  if (!keep) await rm(work, { recursive: true, force: true });
  else console.log(`\nKept ${work}`);
}
if (failures.length) {
  console.error(`\n${failures.length} example(s) failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('\nAll examples work.');
