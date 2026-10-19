import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Set by `@bitakit/ui`'s provider (runtime-state-attribute.ts): `starting`, `ready`, `failed`. */
const runtimeAttribute = 'data-bitakit-runtime';
/** After network idle, a page that has not set the attribute within this time has no provider. */
const runtimeAppearMs = 5000;
const excerptLength = 500;
const messageLength = 2000;

export const playwrightInstall = [
  'npm install --save-dev playwright',
  'npx playwright install chromium',
];
// Linux hosts (containers, CI) also need Chromium's system libraries.
const browserInstall =
  process.platform === 'linux'
    ? 'npx playwright install --with-deps chromium'
    : playwrightInstall[1];

/** The check could not run in this environment; `commands` fix it. The CLI exits with 2. */
export class CheckPageSetupError extends Error {
  constructor(message, commands) {
    super(message);
    this.name = 'CheckPageSetupError';
    this.commands = commands;
  }
}

/**
 * Playwright's Chromium as the project resolves it. The CLI never depends on or installs
 * Playwright, so a project opts in by installing `playwright` or `@playwright/test` itself.
 */
export function loadChromium(cwd = process.cwd()) {
  const require = createRequire(path.join(path.resolve(cwd), 'package.json'));
  for (const name of ['playwright', '@playwright/test']) {
    let chromium;
    try {
      ({ chromium } = require(name));
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') continue;
      throw error;
    }
    let executable;
    try {
      executable = chromium.executablePath();
    } catch {}
    if (!executable || !existsSync(executable))
      throw new CheckPageSetupError(
        `Playwright is installed (${name}), but its Chromium browser is not.`,
        [browserInstall],
      );
    return chromium;
  }
  throw new CheckPageSetupError(
    'check-page needs Playwright, and this project does not install it.',
    playwrightInstall,
  );
}

/** `/todos` against the base URL; an absolute http(s) URL stays as it is. */
export function pageUrl(target, baseUrl = 'http://localhost:3000') {
  if (/^https?:\/\//i.test(target)) return new URL(target).href;
  if (!target.startsWith('/') || target.startsWith('//'))
    throw new Error(`Pass a path that starts with one "/" (/todos) or a full http:// URL.`);
  let base;
  try {
    base = new URL(baseUrl);
  } catch {}
  if (!base || !/^https?:$/.test(base.protocol))
    throw new Error(
      `--base-url takes a full URL such as http://localhost:3000 (got "${baseUrl}").`,
    );
  return new URL(target, base).href;
}

/**
 * Loads one page in headless Chromium and reports what HTTP alone cannot show: the rendered
 * headings and text, the BitaKit runtime state, `[bitakit]` errors, console and page errors and
 * failed same-origin requests. `ok` is false when any error was seen; warnings do not count.
 */
export async function checkPage(
  target,
  { baseUrl, timeout = 30000, screenshot, cwd = process.cwd() } = {},
) {
  const url = pageUrl(target, baseUrl);
  const chromium = loadChromium(cwd);
  const origin = new URL(url).origin;
  const deadline = Date.now() + timeout;
  // Playwright treats a timeout of 0 as "no timeout"; an exhausted budget must still end.
  const remaining = () => Math.max(1, deadline - Date.now());
  const logged = [];
  const pageErrors = [];
  const failedRequests = [];
  const sameOrigin = (address) => {
    try {
      return new URL(address).origin === origin;
    } catch {
      return false;
    }
  };

  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    throw new CheckPageSetupError(`Chromium did not start: ${error.message.split('\n')[0]}`, [
      browserInstall,
    ]);
  }
  try {
    const page = await browser.newPage();
    // Record every runtime state the page passes through: a failed production startup can hand
    // the document to Next's error page, which drops the attribute from <html> again.
    await page.addInitScript((name) => {
      const seen = (window.__bitakitRuntimeSeen = []);
      new MutationObserver((records) => {
        for (const record of records) {
          const value = record.target.getAttribute?.(name);
          if (record.oldValue) seen.push(record.oldValue);
          if (value) seen.push(value);
        }
      }).observe(document, {
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: [name],
      });
    }, runtimeAttribute);
    page.on('console', (message) => {
      const type = message.type();
      if (type !== 'error' && type !== 'warning') return;
      const { url: source, lineNumber } = message.location();
      logged.push({
        type,
        text: consoleText(message.text()),
        source: source ? `${source}:${lineNumber + 1}` : undefined,
        url: source,
      });
    });
    page.on('pageerror', (error) =>
      pageErrors.push({ message: clip(`${error.name}: ${error.message}`) }),
    );
    // The document itself is reported as `status` or `loadError`.
    const isDocument = (request) =>
      request.isNavigationRequest() && request.frame() === page.mainFrame();
    page.on('response', (response) => {
      const request = response.request();
      if (isDocument(request)) return;
      if (response.status() >= 400 && sameOrigin(response.url()))
        failedRequests.push({
          method: request.method(),
          url: response.url(),
          status: response.status(),
        });
    });
    page.on('requestfailed', (request) => {
      const error = request.failure()?.errorText ?? 'failed';
      // Aborts are navigation and prefetch cancellations, not broken resources.
      if (!isDocument(request) && sameOrigin(request.url()) && !error.includes('ERR_ABORTED'))
        failedRequests.push({ method: request.method(), url: request.url(), error });
    });

    let response = null;
    let loadError = null;
    let networkIdle = false;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: remaining() });
      networkIdle = await page.waitForLoadState('networkidle', { timeout: remaining() }).then(
        () => true,
        () => false,
      );
    } catch (error) {
      loadError = clip(error.message.split('\n')[0].replace(/^page\.goto: /, ''));
    }

    let runtime = null;
    if (!loadError) {
      runtime = await waitForRuntime(page, Math.min(runtimeAppearMs, remaining()), remaining);
      // Let React commit what readiness unlocked (plugin pages and slots) before reading the DOM.
      await page
        .evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        )
        .catch(() => {});
    }
    const content = loadError
      ? { title: '', headings: [], text: '', textSource: 'body' }
      : await page.evaluate(readContent, excerptLength).catch(() => ({
          title: '',
          headings: [],
          text: '',
          textSource: 'body',
        }));
    let screenshotFile = null;
    if (screenshot && !loadError) {
      screenshotFile = path.resolve(cwd, screenshot);
      await page.screenshot({ path: screenshotFile, fullPage: true });
    }

    const status = response?.status() ?? null;
    // Chromium also logs each failed load as a console error; report it once, as a request.
    const reported = new Set(failedRequests.map((request) => request.url));
    if (status !== null && status >= 400) reported.add(response.url());
    const errors = logged.filter(
      (entry) =>
        entry.type === 'error' &&
        !(entry.text.startsWith('Failed to load resource:') && reported.has(entry.url)),
    );
    const bitakitErrors = errors
      .filter((entry) => entry.text.startsWith('[bitakit] '))
      .map((entry) => entry.text.slice('[bitakit] '.length));
    const report = {
      version: 1,
      url,
      finalUrl: loadError ? null : page.url(),
      status,
      title: content.title,
      headings: content.headings,
      text: content.text,
      textSource: content.textSource,
      runtime,
      networkIdle,
      loadError,
      bitakitErrors: unique(bitakitErrors),
      consoleErrors: messages(errors.filter((entry) => !entry.text.startsWith('[bitakit] '))),
      consoleWarnings: messages(logged.filter((entry) => entry.type === 'warning')),
      pageErrors,
      failedRequests,
      screenshot: screenshotFile,
    };
    const problems =
      (loadError ? 1 : 0) +
      (status !== null && status >= 400 ? 1 : 0) +
      (runtime === 'failed' || runtime === 'starting' ? 1 : 0) +
      report.bitakitErrors.length +
      report.consoleErrors.length +
      report.pageErrors.length +
      report.failedRequests.length;
    return { ...report, errors: problems, ok: problems === 0 };
  } finally {
    await browser.close();
  }
}

/**
 * `null` without a BitaKit provider; `failed` when startup failed at any point; otherwise the
 * current state, or the last one seen when the attribute is gone.
 */
async function waitForRuntime(page, appearMs, remaining) {
  const states = (name) => ({
    current: document.documentElement?.getAttribute(name) ?? null,
    seen: window.__bitakitRuntimeSeen ?? [],
  });
  const appeared = await page
    .waitForFunction(
      (name) =>
        document.documentElement?.hasAttribute(name) || window.__bitakitRuntimeSeen?.length > 0,
      runtimeAttribute,
      { timeout: appearMs },
    )
    .then(
      () => true,
      () => false,
    );
  if (!appeared) return null;
  await page
    .waitForFunction(
      (name) =>
        ['ready', 'failed'].includes(document.documentElement?.getAttribute(name)) ||
        window.__bitakitRuntimeSeen?.includes('failed'),
      runtimeAttribute,
      { timeout: remaining() },
    )
    .catch(() => {});
  const { current, seen } = await page
    .evaluate(states, runtimeAttribute)
    .catch(() => ({ current: null, seen: [] }));
  if (seen.includes('failed')) return 'failed';
  return current ?? seen.at(-1) ?? null;
}

/** Runs in the page: visible text only, so hidden dialogs and templates stay out. */
function readContent(limit) {
  const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main');
  const text = clean((main ?? document.body)?.innerText);
  return {
    title: document.title,
    // Component libraries also mark headings with role="heading" (Shell's page states do).
    headings: [...document.querySelectorAll('h1, h2, h3, [role="heading"][aria-level]')]
      .map((heading) => ({
        level: Number(heading.getAttribute('aria-level') ?? heading.tagName[1]),
        text: clean(heading.innerText),
      }))
      .filter((heading) => heading.level <= 3 && heading.text),
    text: text.length > limit ? `${text.slice(0, limit)}…` : text,
    textSource: main ? 'main' : 'body',
  };
}

const clip = (text) => (text.length > messageLength ? `${text.slice(0, messageLength)}…` : text);
/**
 * React logs errors with format specifiers (`%o`, `%s`) and a long component stack; agents need
 * the message, so drop the specifiers and keep the first lines.
 */
function consoleText(text) {
  if (!/%[sdifoOc]/.test(text)) return text;
  const lines = text
    .replace(/%[sdifoOc]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, 6).join('\n');
}
const unique = (texts) => [...new Set(texts)];
/** StrictMode and retries repeat messages; each text is listed once with how often it appeared. */
function messages(entries) {
  const byText = new Map();
  for (const entry of entries) {
    const existing = byText.get(entry.text);
    if (existing) existing.count++;
    else byText.set(entry.text, { text: clip(entry.text), source: entry.source, count: 1 });
  }
  return [...byText.values()];
}

/** The human-readable report: what rendered first, then every error with its source. */
export function formatPageReport(report) {
  const lines = [`\nBitaKit check-page · ${report.url}\n`];
  if (report.loadError) {
    lines.push(`✖ The page did not load: ${report.loadError}`);
    if (/ERR_CONNECTION_REFUSED|ECONNREFUSED/.test(report.loadError))
      lines.push('    Is the dev server running? Start it with "npm run dev", or pass --base-url.');
  } else {
    const redirected = report.finalUrl !== report.url ? ` (${report.finalUrl})` : '';
    const headings = report.headings.map((heading) => `h${heading.level} ${heading.text}`);
    lines.push(
      `  Status    ${report.status ?? 'none'}${redirected}`,
      `  Title     ${report.title || '(none)'}`,
      `  Runtime   ${describeRuntime(report)}`,
      `  Headings  ${headings.join(' · ') || '(none)'}`,
      `  ${report.textSource === 'main' ? 'Main' : 'Body'}      ${report.text || '(empty)'}`,
    );
    if (!report.networkIdle) lines.push('  Network   still busy when the timeout ended');
  }
  const section = (title, items, format) => {
    if (!items.length) return;
    lines.push(`\n${title} (${items.length})`);
    for (const item of items) lines.push(`  ${format(item).replaceAll('\n', '\n  ')}`);
  };
  const counted = (entry) =>
    entry.text +
    (entry.count > 1 ? ` (×${entry.count})` : '') +
    (entry.source ? `\n  at ${entry.source}` : '');
  section('BitaKit errors', report.bitakitErrors, (text) => text);
  section('Page errors', report.pageErrors, (error) => error.message);
  section('Console errors', report.consoleErrors, counted);
  section(
    'Failed requests',
    report.failedRequests,
    (request) => `${request.status ?? request.error} ${request.method} ${request.url}`,
  );
  section('Console warnings', report.consoleWarnings, counted);
  if (report.screenshot) lines.push(`\nScreenshot: ${report.screenshot}`);
  const warnings = report.consoleWarnings.length;
  lines.push(
    `\n${report.ok ? '✔ No errors' : `✖ ${plural(report.errors, 'error')}`}` +
      `${warnings ? `, ${plural(warnings, 'warning')}` : ''}.\n`,
  );
  return lines.join('\n');
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function describeRuntime({ runtime, pageErrors }) {
  if (runtime === null)
    return pageErrors.length
      ? 'not found (the app may have crashed before startup; see page errors)'
      : 'not found (no <html data-bitakit-runtime>: no provider, or an older @bitakit/ui)';
  if (runtime === 'starting') return 'starting: did not become ready before the timeout';
  return runtime;
}
