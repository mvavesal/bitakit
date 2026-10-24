// Starts a built or development app and drives it in Chromium; shared by the generated-project
// and example verification scripts. A smoke test fails on any console or page error.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

let port = 4100;

/** Starts `next start`/`next dev` or `vite preview` and resolves once it answers. */
export async function serve(framework, cwd, { development = false, auth = false } = {}) {
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

/**
 * Visits `[route, text, act?]` in order, waiting for the text and running `act(page)`, then
 * `extra(page)`. Fails on console or page errors, except messages matching `expected` (a page
 * that throws on purpose), and when Tailwind did not compile the styles.
 */
export async function smoke(url, visits, extra, { expected } = {}) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const report = (text) => !expected?.test(text) && errors.push(text);
  page.on('console', (message) => message.type() === 'error' && report(message.text()));
  page.on('pageerror', (error) => report(error.message));
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
