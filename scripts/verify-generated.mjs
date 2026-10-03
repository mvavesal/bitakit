#!/usr/bin/env node
// Generates every supported project shape from freshly packed packages and verifies it the way a
// developer uses it: install, type check, doctor, production build, then a browser smoke test
// that fails on any console or page error. Needs the npm registry and Playwright's Chromium.
// Usage: node scripts/verify-generated.mjs [--only next-sample,notes-plugin] [--keep]
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : undefined;
const keep = argv.includes('--keep');
const work = await mkdtemp(path.join(tmpdir(), 'bitakit-verify-'));
const packs = path.join(work, 'packs');
const generator = path.join(root, 'packages/create-app/src/cli.mjs');
let port = 4100;

const addItem = async (page) => {
  await page.getByLabel('New item').fill('Verify the generator');
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByText('Verify the generator').waitFor();
  await page.getByRole('button', { name: 'Clear all' }).click();
  // The sample's clear action asks for confirmation first.
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('Verify the generator').waitFor({ state: 'detached' });
};
const app = (framework, sample) => ({
  args: ['--framework', framework, ...(sample ? ['--sample'] : ['--features', 'none'])],
  visits: sample
    ? [
        ['/', 'Welcome'],
        ['/todos', 'Todos', addItem],
        ['/settings', 'Appearance'],
        ['/missing', 'Page not found'],
      ]
    : [
        ['/', 'Welcome'],
        ['/missing', 'Page not found'],
      ],
  framework,
});
const scenarios = {
  'next-bare': app('next', false),
  'next-sample': app('next', true),
  'tanstack-bare': app('tanstack', false),
  'tanstack-sample': app('tanstack', true),
  // Plugin IDs come from the package name: notes-plugin → "notes".
  'notes-plugin': { args: ['--plugin', '--framework', 'next'], plugin: 'notes', framework: 'next' },
  'tasks-plugin': {
    args: ['--plugin', '--framework', 'tanstack'],
    plugin: 'tasks',
    framework: 'tanstack',
  },
};

const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

async function serve(framework, cwd) {
  const current = port++;
  const [command, args] =
    framework === 'next'
      ? ['npx', ['next', 'start', '--port', String(current)]]
      : ['npx', ['vite', 'preview', '--port', String(current), '--strictPort']];
  const server = spawn(command, args, { cwd, stdio: 'ignore', detached: true });
  const url = `http://localhost:${current}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (
      await fetch(url).then(
        (response) => response.ok,
        () => false,
      )
    )
      return { url, stop: () => process.kill(-server.pid) };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  process.kill(-server.pid);
  throw new Error(`The ${framework} server did not start.`);
}

async function smoke(url, visits) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    for (const [route, text, act] of visits) {
      await page.goto(url + route);
      await page.getByText(text).first().waitFor({ timeout: 15000 });
      await act?.(page);
    }
  } finally {
    await browser.close();
  }
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
}

async function verify(name, scenario) {
  const target = path.join(work, name);
  const step = (label, fn) => {
    process.stdout.write(`  ${label}… `);
    const started = Date.now();
    return Promise.resolve(fn()).then((value) => {
      console.log(`ok (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      return value;
    });
  };
  await step('generate and install', () =>
    run(
      process.execPath,
      [generator, name, ...scenario.args, '--yes', '--packages-dir', packs],
      work,
    ),
  );
  if (scenario.plugin) {
    await step('npm test', () => run('npm', ['test'], target));
    await step('type check', () => run('npm', ['run', 'typecheck'], target));
    await step('doctor', () => run('npx', ['bitakit', 'doctor'], target));
    await step('build package', () => run('npm', ['run', 'build'], target));
    await step('pack package', () => run('npm', ['pack', '--silent'], target));
    const playground = path.join(target, 'playground');
    await step('build playground', () => run('npm', ['run', 'build'], playground));
    const server = await step('start playground', () => serve(scenario.framework, playground));
    try {
      await step('browser', () =>
        smoke(server.url, [
          ['/', 'Add item'],
          [`/${scenario.plugin}`, 'Add and remove items', addItem],
        ]),
      );
    } finally {
      server.stop();
    }
    return;
  }
  await step('type check', () => run('npm', ['run', 'typecheck'], target));
  await step('doctor', () => run('npx', ['bitakit', 'doctor'], target));
  await step('build', () => run('npm', ['run', 'build'], target));
  const server = await step('start', () => serve(scenario.framework, target));
  try {
    await step('browser', () => smoke(server.url, scenario.visits));
  } finally {
    server.stop();
  }
}

const failures = [];
try {
  console.log(`Packing packages into ${packs}`);
  run(
    process.execPath,
    [
      path.join(root, 'scripts/pack-packages.mjs'),
      packs,
      'core',
      'ui',
      'app-preferences',
      'next',
      'tanstack',
      'shell',
      'quick-search',
      'devtools',
      'cli',
      'create-app',
    ],
    root,
  );
  console.log(`Packed ${(await readdir(packs)).length} packages.\n`);
  for (const [name, scenario] of Object.entries(scenarios)) {
    if (only && !only.includes(name)) continue;
    console.log(name);
    try {
      await verify(name, scenario);
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
  console.error(`\n${failures.length} scenario(s) failed:\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('\nAll generated projects work.');
