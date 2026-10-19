import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, realpath } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { bitakit, link, project } from './helpers.mjs';
import { playwrightInstall } from '../src/check-page.mjs';

// The repository's @playwright/test (used by scripts/verify-generated.mjs) drives these checks.
const browserMissing = (() => {
  try {
    const { chromium } = createRequire(new URL('../../../package.json', import.meta.url))(
      '@playwright/test',
    );
    return existsSync(chromium.executablePath())
      ? false
      : 'Chromium is not installed: npx playwright install chromium';
  } catch {
    return '@playwright/test is not installed in the repository';
  }
})();

const html = (title, body, script = '') =>
  `<!doctype html><html><head><title>${title}</title></head><body>${body}<script>${script}</script></body></html>`;
/** Startup as a BitaKit host shows it: `starting`, then `final` after `render` (or never). */
const startup = (final, render = '') =>
  `const root = document.documentElement; root.setAttribute('data-bitakit-runtime', 'starting');` +
  (final
    ? `setTimeout(() => { ${render}; root.setAttribute('data-bitakit-runtime', '${final}'); }, 150);`
    : '');
const pages = {
  // Plugin pages render only after startup; the report must show them, not the loading state.
  '/todos': html(
    'Todos',
    '<main><p>Loading</p></main>',
    startup(
      'ready',
      `document.querySelector('main').innerHTML = '<h1>Todos</h1><h2>Recent activity</h2><p>Buy milk</p>'`,
    ),
  ),
  '/broken': html(
    'Broken',
    '<main><h1>Broken</h1></main>',
    `document.documentElement.setAttribute('data-bitakit-runtime', 'ready');
     console.error('[bitakit] Service "todos.list" in plugin "todos" failed to start: offline');
     console.error('Something broke');
     console.warn('Careful');
     fetch('/missing.json');
     setTimeout(() => { throw new Error('kaboom'); });`,
  ),
  '/stuck': html('Stuck', '<main><h1>Stuck</h1></main>', startup()),
  // A failed production startup: Next's error page replaces the document and drops the attribute.
  '/torn-down': html(
    'Torn down',
    '<main><h1>Torn down</h1></main>',
    startup('failed') +
      `setTimeout(() => { document.documentElement.removeAttribute('data-bitakit-runtime'); throw new Error('BitaKitStartupError'); }, 300);`,
  ),
  // React logs render errors with format specifiers and a long stack.
  '/react-error': html(
    'React error',
    '<main><h1>React error</h1></main>',
    `document.documentElement.setAttribute('data-bitakit-runtime', 'ready');
     console.error('%o\\n\\n%s\\n%s', new Error('slot render boom'), 'The above error occurred in <Widget>', ${JSON.stringify(Array.from({ length: 12 }, (_, i) => `    at frame${i}`).join('\n'))});`,
  ),
};

async function serve(t) {
  const server = createServer((request, response) => {
    const page = pages[new URL(request.url, 'http://localhost').pathname];
    response.writeHead(page ? 200 : 404, { 'content-type': 'text/html' });
    response.end(page ?? html('Not found', '<h1>Not found</h1>'));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test(
  'check-page reports what rendered and every error, with exit 1 only for errors',
  { skip: browserMissing },
  async (t) => {
    const base = await serve(t);
    // A project that resolves Playwright through @playwright/test, as the repository does.
    const root = await project({ 'package.json': { name: 'demo' } }, t);
    await link(root, '@playwright/test', 'node_modules/@playwright/test');

    const clean = await bitakit(
      root,
      'check-page',
      '/todos',
      '--base-url',
      base,
      '--json',
      '--screenshot',
      'shots/todos.png',
    );
    assert.equal(clean.code, 0, clean.stdout + clean.stderr);
    const report = JSON.parse(clean.stdout);
    assert.equal(report.version, 1);
    assert.equal(report.ok, true);
    assert.equal(report.errors, 0);
    assert.equal(report.url, `${base}/todos`);
    assert.equal(report.status, 200);
    assert.equal(report.title, 'Todos');
    assert.equal(report.runtime, 'ready');
    assert.deepEqual(report.headings, [
      { level: 1, text: 'Todos' },
      { level: 2, text: 'Recent activity' },
    ]);
    assert.equal(report.textSource, 'main');
    assert.match(report.text, /Buy milk/);
    assert.equal(report.screenshot, path.join(await realpath(root), 'shots/todos.png'));
    const png = await readFile(report.screenshot);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');

    const broken = await bitakit(root, 'check-page', `${base}/broken`);
    assert.equal(broken.code, 1, broken.stderr);
    assert.match(broken.stdout, /Runtime\s+ready/);
    assert.match(
      broken.stdout,
      /BitaKit errors \(1\)\n {2}Service "todos\.list" in plugin "todos" failed to start: offline/,
    );
    assert.match(broken.stdout, /Page errors \(1\)\n {2}Error: kaboom/);
    assert.match(broken.stdout, /Console errors \(1\)\n {2}Something broke/);
    assert.match(
      broken.stdout,
      /Failed requests \(1\)\n {2}404 GET http:\/\/127\.0\.0\.1:\d+\/missing\.json/,
    );
    assert.match(broken.stdout, /Console warnings \(1\)\n {2}Careful/);
    // Chromium's own "Failed to load resource" line is the failed request, not a second error.
    assert.doesNotMatch(broken.stdout, /Failed to load resource/);
    assert.match(broken.stdout, /✖ 4 errors, 1 warning\./);

    const stuck = await bitakit(
      root,
      'check-page',
      '/stuck',
      '--base-url',
      base,
      '--timeout',
      '3000',
      '--json',
    );
    assert.equal(stuck.code, 1);
    assert.equal(JSON.parse(stuck.stdout).runtime, 'starting');

    const missing = await bitakit(
      root,
      'check-page',
      '/missing-page',
      '--base-url',
      base,
      '--timeout',
      '3000',
    );
    assert.equal(missing.code, 1);
    assert.match(missing.stdout, /Status\s+404/);
    assert.match(missing.stdout, /Runtime\s+not found/);
    assert.match(missing.stdout, /Headings\s+h1 Not found/);
    assert.match(missing.stdout, /✖ 1 error\./);

    const tornDown = await bitakit(root, 'check-page', '/torn-down', '--base-url', base, '--json');
    assert.equal(tornDown.code, 1);
    assert.equal(JSON.parse(tornDown.stdout).runtime, 'failed');

    const reactError = JSON.parse(
      (await bitakit(root, 'check-page', '/react-error', '--base-url', base, '--json')).stdout,
    );
    const [logged] = reactError.consoleErrors;
    assert.doesNotMatch(logged.text, /%[os]/);
    assert.ok(logged.text.split('\n').length <= 6, logged.text);

    // Nothing listens on a port that was just released: the report says how to start the server.
    const closed = createServer();
    await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const port = closed.address().port;
    await new Promise((resolve) => closed.close(resolve));
    const offline = await bitakit(root, 'check-page', `http://127.0.0.1:${port}/todos`);
    assert.equal(offline.code, 1);
    assert.match(offline.stdout, /The page did not load: net::ERR_CONNECTION_REFUSED/);
    assert.match(offline.stdout, /Is the dev server running\?/);
  },
);

test('check-page names the install commands and exits 2 when the project cannot resolve Playwright', async (t) => {
  const root = await project({ 'package.json': { name: 'demo' } }, t);
  const text = await bitakit(root, 'check-page', '/todos');
  assert.equal(text.code, 2);
  assert.match(text.stderr, /check-page needs Playwright, and this project does not install it\./);
  for (const command of playwrightInstall) assert.ok(text.stderr.includes(`  ${command}`), command);

  const json = await bitakit(root, 'check-page', '/todos', '--json');
  assert.equal(json.code, 2);
  assert.deepEqual(JSON.parse(json.stdout), {
    version: 1,
    ok: false,
    setupError: {
      message: 'check-page needs Playwright, and this project does not install it.',
      commands: playwrightInstall,
    },
  });

  const relative = await bitakit(root, 'check-page', 'todos');
  assert.equal(relative.code, 1);
  assert.match(relative.stderr, /Pass a path that starts with one "\/" \(\/todos\)/);
  const external = await bitakit(root, 'check-page', '//example.com/x');
  assert.equal(external.code, 1);
  assert.match(external.stderr, /Pass a path that starts with one "\/"/);
  const schemeless = await bitakit(root, 'check-page', '/todos', '--base-url', 'localhost:3000');
  assert.equal(schemeless.code, 1);
  assert.match(schemeless.stderr, /--base-url takes a full URL such as http:\/\/localhost:3000/);
});

test('check-page reports a browser that cannot start as a setup problem (exit 2)', async (t) => {
  // A Playwright whose Chromium exists on disk but fails to launch (missing headless shell or
  // system libraries).
  const root = await project(
    {
      'package.json': { name: 'demo' },
      'node_modules/playwright/package.json': { name: 'playwright', main: 'index.js' },
      'node_modules/playwright/index.js': `exports.chromium = {
  executablePath: () => process.execPath,
  launch: () => Promise.reject(new Error('browserType.launch: Executable doesn\\'t exist\\nmore')),
};
`,
    },
    t,
  );
  const json = await bitakit(root, 'check-page', '/todos', '--json');
  assert.equal(json.code, 2, json.stderr);
  const { setupError } = JSON.parse(json.stdout);
  assert.match(setupError.message, /^Chromium did not start: browserType\.launch/);
  assert.equal(setupError.commands.length, 1);
});
