#!/usr/bin/env node
// Generates every supported project shape from freshly packed packages and verifies it the way a
// developer uses it: install, type check, doctor, production build, then a browser smoke test
// that fails on any console or page error. Needs the npm registry and Playwright's Chromium.
// Usage: node scripts/verify-generated.mjs [--only next-sample,notes-plugin] [--keep]
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { configureAuthFixture, verifyAuthStyles } from './fixtures/generated-auth.mjs';
import { configureSearchFixture, verifySearch } from './fixtures/generated-search.mjs';
import { configureThemeFixture, verifyDeveloperTheme } from './fixtures/generated-theme.mjs';
import {
  bundledSkillFiles,
  readSkillFiles,
  readSkillStamp,
} from '../packages/cli/src/agent-skill.mjs';

const root = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : undefined;
const keep = argv.includes('--keep');
const work = await mkdtemp(path.join(tmpdir(), 'bitakit-verify-'));
const packs = path.join(work, 'packs');
const generator = path.join(root, 'packages/create-app/src/cli.mjs');
let port = 4100;

const addTodo = async (page) => {
  // Enter submits the form through the Action-bound Add button.
  await page.getByLabel('New todo').fill('Verify the generator');
  await page.getByLabel('New todo').press('Enter');
  await page
    .getByRole('listitem')
    .filter({ hasText: /^Verify the generator/ })
    .waitFor();
  // The activity plugin fills the todos.footer slot from the todos.changed event.
  await page.getByText('Added "Verify the generator"').waitFor();
  await page.getByRole('button', { name: 'Clear all' }).click();
  // The sample's clear action asks for confirmation first.
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('Cleared the list').waitFor();
  await page
    .getByRole('listitem')
    .filter({ hasText: /^Verify the generator/ })
    .waitFor({ state: 'detached' });
};
// A plugin package's playground uses the full plugin template, not the Todo sample.
const addPluginEntry = async (page) => {
  await page.getByLabel('New entry').fill('Verify the generator');
  await page.getByRole('button', { name: 'Add entry' }).click();
  await page.getByText('Verify the generator').waitFor();
  await page.getByRole('button', { name: 'Clear all' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('Verify the generator').waitFor({ state: 'detached' });
};
const app = (framework, sample) => ({
  args: ['--framework', framework, ...(sample ? ['--sample'] : ['--features', 'none'])],
  visits: sample
    ? [
        ['/', 'Welcome'],
        ['/todos', 'Todos', addTodo],
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
  'next-search': { ...app('next', true), search: true },
  'next-auth': { ...app('next', true), auth: true },
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

async function serve(framework, cwd, { development = false, auth = false } = {}) {
  const current = port++;
  const [command, args] =
    framework === 'next'
      ? ['npx', ['next', development ? 'dev' : 'start', '--port', String(current)]]
      : ['npx', ['vite', 'preview', '--port', String(current), '--strictPort']];
  const url = `http://localhost:${current}`;
  const log = createWriteStream(
    path.join(cwd, development ? 'verify-dev.log' : 'verify-server.log'),
  );
  const server = spawn(command, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    env: { ...process.env, ...(auth ? { BITAKIT_TEST_AUTH: '1', BITAKIT_TEST_ORIGIN: url } : {}) },
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (
      await fetch(url, { signal: AbortSignal.timeout(10000) }).then(
        (response) => response.ok,
        () => false,
      )
    )
      return { url, stop: () => process.kill(-server.pid) };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  process.kill(-server.pid);
  throw new Error(
    `The ${framework} server did not start. See ${cwd}/verify-${development ? 'dev' : 'server'}.log.`,
  );
}

async function smoke(url, visits, extra) {
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
    await extra?.(page);
    // Package styles need Tailwind; an app whose integration was lost renders browser defaults.
    const spacing = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--spacing').trim(),
    );
    if (!spacing) errors.push('Tailwind did not compile the app styles (--spacing is empty).');
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
  // Agent rules and the app-authoring skill must reach the agent through the project.
  await step('agent rules', async () => {
    const read = (file) => readFile(path.join(work, name, file), 'utf8');
    const rules = await read('AGENTS.md');
    if (!rules.includes('BEGIN:bitakit-agent-rules'))
      throw new Error('AGENTS.md has no BitaKit rules block.');
    if (!/^@AGENTS\.md$/m.test(await read('CLAUDE.md')))
      throw new Error('CLAUDE.md does not import AGENTS.md.');
    // Plugin packages get package rules; the app-authoring skill is for apps.
    if (scenario.plugin) return;
    if (!rules.includes('bitakit-app-development` skill'))
      throw new Error('AGENTS.md does not name the app-authoring skill.');
    const skill = await read('.agents/skills/bitakit-app-development/SKILL.md');
    if (!/^name: bitakit-app-development$/m.test(skill))
      throw new Error('The project is missing the bitakit-app-development skill.');
    if ((await read('.claude/skills/bitakit-app-development/SKILL.md')) !== skill)
      throw new Error('Codex and Claude Code do not have the same project skill.');
    if (!readSkillStamp(skill)) throw new Error('The project skill has no install stamp.');
    // The installed @bitakit/cli is the packed tarball, so this also proves the package ships the
    // skill with its references. The comparison ignores the install stamp.
    const packed = JSON.stringify(
      await bundledSkillFiles(
        path.join(target, 'node_modules/@bitakit/cli/skills/bitakit-app-development'),
      ),
    );
    if (!packed.includes('"references/slots.md"'))
      throw new Error('The packed skill has no references.');
    for (const folder of ['.agents', '.claude'])
      if (
        JSON.stringify(
          await readSkillFiles(path.join(target, folder, 'skills/bitakit-app-development')),
        ) !== packed
      )
        throw new Error(`${folder}/skills/bitakit-app-development differs from the package.`);
  });
  if (scenario.search) await configureSearchFixture(target);
  if (scenario.auth) {
    const archives = Object.fromEntries(
      (await readdir(packs)).map((file) => [
        `@bitakit/${/^bitakit-(.+)-\d/.exec(file)[1]}`,
        `file:${path.join(packs, file)}`,
      ]),
    );
    await configureAuthFixture(target, archives);
    await configureThemeFixture(target);
    await step('install native auth fixture', () =>
      run('npm', ['install', '--no-audit', '--no-fund'], target),
    );
  }
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
          ['/', 'Add entry'],
          [`/${scenario.plugin}`, 'Add and remove entries', addPluginEntry],
        ]),
      );
    } finally {
      server.stop();
    }
    return;
  }
  await step('type check', () => run('npm', ['run', 'typecheck'], target));
  await step('doctor', () => run('npx', ['bitakit', 'doctor'], target));
  if (scenario.auth || scenario.search) {
    const server = await step('start development', () =>
      serve(scenario.framework, target, { development: true, auth: true }),
    );
    const artifacts = path.join(target, 'verification-development');
    await mkdir(artifacts);
    try {
      await step(scenario.search ? 'development search' : 'development auth styles', () =>
        smoke(server.url, [], async (page) => {
          if (scenario.search) await verifySearch(page, server.url, artifacts);
          else {
            await verifyAuthStyles(page, server.url, artifacts, target);
            await verifyDeveloperTheme(page, server.url, artifacts);
          }
        }),
      );
    } finally {
      server.stop();
    }
  }
  await step('build', () => run('npm', ['run', 'build'], target));
  const server = await step('start', () =>
    serve(scenario.framework, target, { auth: scenario.auth }),
  );
  try {
    const artifacts = path.join(target, 'verification-production');
    await mkdir(artifacts);
    await step('browser', () =>
      smoke(
        server.url,
        scenario.visits,
        scenario.search
          ? async (page) => verifySearch(page, server.url, artifacts)
          : scenario.auth
            ? async (page) => {
                await verifyAuthStyles(page, server.url, artifacts);
                await verifyDeveloperTheme(page, server.url, artifacts);
              }
            : undefined,
      ),
    );
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
      ...(argv.includes('--skip-build') ? ['--skip-build'] : []),
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
