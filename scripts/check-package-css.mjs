import { mkdtemp, readFile, writeFile, mkdir, symlink, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const dir = await mkdtemp(path.join(tmpdir(), 'foundation-css-consumer-'));
const names = ['ui', 'core', 'organizations', 'shell', 'better-auth-ui'];
const archives = {};
for (const name of names) {
  const result = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', dir], {
      cwd: path.join(root, 'packages', name),
      encoding: 'utf8',
    }),
  )[0];
  if (!result.files.some((f) => f.path === 'styles.css')) throw Error(name + ' CSS not packed');
  if (!result.files.some((f) => f.path.startsWith('dist/'))) throw Error(name + ' dist not packed');
  archives[name] = path.join(dir, result.filename);
  console.log('pack verified', name);
}
await mkdir(path.join(dir, 'node_modules/@bitakit'), { recursive: true });
await symlink(
  path.dirname(require.resolve('tailwindcss/package.json')),
  path.join(dir, 'node_modules/tailwindcss'),
);
async function install(name) {
  const dest = path.join(dir, 'node_modules/@bitakit', name);
  await mkdir(dest);
  execFileSync('tar', ['-xzf', archives[name], '-C', dest, '--strip-components=1']);
}
await install('ui');
await install('core');
async function compile(imports) {
  const css = `@import 'tailwindcss' source(none);\n${imports.map((n) => `@import '@bitakit/${n}/styles.css';`).join('\n')}\n@theme {--radius-card:1rem;--color-border:#ccc;}`;
  return (
    await postcss([tailwind({ base: dir })]).process(css, { from: path.join(dir, 'input.css') })
  ).css;
}
const lean = await compile(['ui', 'core']);
if (!lean.includes('.size-10') || !lean.includes('.gap-6'))
  throw Error('packed utility classes missing');
try {
  await access(path.join(dir, 'node_modules/@bitakit/organizations'));
  throw Error('unexpected organizations dependency');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
console.log(
  'isolated UI+Core consumer compiles with NO organizations/shell/better-auth-ui installed',
);
await install('organizations');
await install('shell');
const expanded = await compile(['organizations', 'shell']);
if (!expanded.includes('.size-10') || expanded.length <= lean.length)
  throw Error('transitive or optional styles missing');
console.log(
  'optional package imports compile transitively, CSS bytes',
  lean.length,
  expanded.length,
);
await rm(dir, { recursive: true, force: true });
