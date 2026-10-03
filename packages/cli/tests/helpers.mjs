import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));

/** A temporary project from a map of files; objects are written as JSON. Removed after the test. */
export async function project(files, t) {
  const root = await mkdtemp(path.join(tmpdir(), 'bitakit-cli-'));
  if (t) t.after(() => rm(root, { recursive: true, force: true }));
  await write(root, files);
  return root;
}
export async function write(root, files) {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(
      target,
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    );
  }
}
/** Links a workspace package into the fixture so imports such as `@bitakit/discovery` resolve. */
export async function link(root, name, from) {
  const target = path.join(root, 'node_modules', name);
  await mkdir(path.dirname(target), { recursive: true });
  await symlink(path.join(repo, from), target, 'dir');
}

/** A Next.js app with every wiring check satisfied; installed packages are stubbed by their manifests. */
export const nextApp = (extra = {}) => ({
  'package.json': {
    name: 'demo',
    dependencies: { next: '16.0.0', '@bitakit/core': '^0.2.0', '@bitakit/shell': '^0.2.0' },
    scripts: { dev: 'next dev', build: 'next build' },
  },
  'node_modules/@bitakit/core/package.json': { name: '@bitakit/core', version: '0.2.0' },
  'node_modules/@bitakit/shell/package.json': {
    name: '@bitakit/shell',
    version: '0.2.0',
    bitakit: { plugin: './plugin', styles: './styles.css' },
  },
  'next.config.ts':
    "import { withBitaKit } from '@bitakit/next/config';\n\nexport default withBitaKit({});\n",
  'src/app/layout.tsx':
    "import { BitaKitProvider } from '@/bitakit.gen';\nexport default function Layout({ children }) { return <BitaKitProvider>{children}</BitaKitProvider>; }\n",
  'src/app/(app)/layout.tsx': "import { AppShell } from '@bitakit/shell';\n",
  'src/app/(app)/page.tsx': 'export default function Page() {}\n',
  'src/app/globals.css': "@import 'tailwindcss';\n@import '../bitakit.gen.css';\n",
  '.gitignore': 'node_modules/\nsrc/bitakit.gen.*\n',
  ...extra,
});
/** The route that renders plugin pages inside the App Shell group. */
export const catchAll = {
  'src/app/(app)/[...path]/page.tsx': 'export default function Page() {}\n',
};

export const find = (results, title) => results.find((result) => result.title.match(title));
export const status = (results, title) => find(results, title)?.status;

const exec = promisify(execFile);
/** Runs the bitakit CLI inside a fixture. Never throws: `{ code, stdout, stderr }`. */
export async function bitakit(cwd, ...args) {
  try {
    const { stdout, stderr } = await exec(process.execPath, [cli, ...args], {
      cwd,
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}
