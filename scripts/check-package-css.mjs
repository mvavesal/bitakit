#!/usr/bin/env node
// Verifies package stylesheets the way apps consume them: packed archives installed into an
// isolated project (no monorepo hoisting), compiled with Tailwind exactly like a generated app.
// Needs the registry for third-party dependencies. Usage: node scripts/check-package-css.mjs
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dir = await mkdtemp(path.join(tmpdir(), 'bitakit-css-consumer-'));
const packs = path.join(dir, 'packs');
try {
  execFileSync(
    process.execPath,
    [path.join(root, 'scripts/pack-packages.mjs'), packs, 'core', 'ui', 'app-preferences', 'shell'],
    { stdio: 'inherit' },
  );
  const archives = Object.fromEntries(
    (await readdir(packs)).map((file) => [
      `@bitakit/${/^bitakit-(.+)-\d/.exec(file)[1]}`,
      `file:${path.join(packs, file)}`,
    ]),
  );
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      dependencies: { ...archives, react: '^19.2.0', 'react-dom': '^19.2.0' },
      devDependencies: {
        tailwindcss: '^4.1.0',
        '@tailwindcss/postcss': '^4.1.0',
        postcss: '^8.5.0',
      },
      overrides: archives,
    }),
  );
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
    cwd: dir,
    stdio: 'inherit',
  });
  const require = createRequire(path.join(dir, 'package.json'));
  const postcss = require('postcss');
  const tailwind = require('@tailwindcss/postcss');
  const compile = async (imports) =>
    (
      await postcss([tailwind({ base: dir })]).process(
        // One dark: utility makes the variant observable even when no package source uses it.
        `@import 'tailwindcss';\n@source inline("dark:bg-muted");\n${imports.map((name) => `@import '${name}';`).join('\n')}\n`,
        { from: path.join(dir, 'app.css') },
      )
    ).css;
  // The leak fixed in Shell: HeroUI's dark variant also styled ::before/::after.
  const leaks = (css) => /\.dark\\:[^{\s]+[^{]*\{[^{}]*&::before/.test(css);

  const lean = await compile(['@bitakit/ui/styles.css', '@bitakit/ui/theme.css']);
  if (!lean.includes('.size-10') || !lean.includes('.gap-6'))
    throw Error('UI utility classes are missing.');
  if (leaks(lean)) throw Error('The UI dark variant styles pseudo-elements.');
  console.log('UI styles compile on their own:', lean.length, 'bytes');

  const full = await compile([
    '@bitakit/ui/styles.css',
    '@bitakit/app-preferences/styles.css',
    '@bitakit/shell/styles.css',
    '@bitakit/ui/theme.css',
  ]);
  if (full.length <= lean.length) throw Error('Optional package styles are missing.');
  if (leaks(full))
    throw Error('A package dark variant styles pseudo-elements (see Shell styles.css).');
  if (
    !full.includes("[data-slot='radio-group-item']") &&
    !full.includes('[data-slot="radio-group-item"]')
  )
    throw Error('The central radio rule is missing.');
  console.log(
    'App Preferences and Shell styles add',
    full.length - lean.length,
    'bytes without pseudo-element leaks',
  );
  // Control: HeroUI's stylesheet imported last brings its variant back, so the check must notice.
  const control = await compile([
    '@bitakit/ui/styles.css',
    '@bitakit/shell/styles.css',
    '@heroui/styles',
  ]);
  if (!leaks(control)) throw Error('The leak check did not detect its control case.');
  console.log("Control: the leak check detects HeroUI's variant when it wins");
} finally {
  await rm(dir, { recursive: true, force: true });
}
