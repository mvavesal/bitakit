import { mkdir, readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import validateName from 'validate-npm-package-name';
import { resolveFeatures } from './features.mjs';
import { next } from './adapters/next.mjs';
import { tanstack } from './adapters/tanstack.mjs';

export const adapters = { next, tanstack };

/** Refuse existing paths, including symlinks; a starter never edits an existing application. */
export async function planProject(directory, options = {}) {
  const target = path.resolve(directory);
  const name = path.basename(target);
  const validation = validateName(name);
  if (!validation.validForNewPackages) {
    throw new Error(
      `Invalid project name: ${[...(validation.errors ?? []), ...(validation.warnings ?? [])].join(' ')}`,
    );
  }
  const existing = await lstat(target).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (existing) throw new Error(`Destination already exists: ${target}. Choose a new directory.`);
  const framework = options.framework ?? 'next';
  if (!Object.hasOwn(adapters, framework))
    throw new Error(
      `Unsupported framework: ${framework}. Available: ${Object.keys(adapters).join(', ')}.`,
    );
  const selected = resolveFeatures(options.features ?? []);
  return { target, name, framework, features: selected, install: options.install !== false };
}

/** Create native framework files, then add only selected Foundation composition. */
export async function createApp(plan, options = {}) {
  const adapter = adapters[plan.framework];
  const run =
    options.run ??
    ((command, args, cwd) =>
      execa(command, args, {
        cwd,
        stdio: 'inherit',
        env: { TANSTACK_CLI_TELEMETRY_DISABLED: '1' },
      }));
  // Repeat the destination check immediately before the framework writes anything.
  await planProject(plan.target, plan);
  await mkdir(path.dirname(plan.target), { recursive: true });
  await adapter.scaffold(plan, run);
  await adapter.configure(plan);
  if (options.packagesDir) await useLocalPackages(plan.target, options.packagesDir);
  if (plan.install) await run('npm', ['install'], plan.target);
  return plan.target;
}

/** npm tarballs allow isolated verification before the Foundation packages are published. */
async function useLocalPackages(target, directory) {
  const source = path.resolve(directory);
  const files = await readdir(source);
  const manifestPath = path.join(target, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const overrides = {};
  for (const file of files.filter(
    (file) => file.startsWith('bitakit-') && file.endsWith('.tgz'),
  )) {
    const match = /^bitakit-(.+)-(\d+\.\d+\.\d+(?:-[\w.-]+)?)\.tgz$/.exec(file);
    if (match) {
      const name = `@bitakit/${match[1]}`;
      if (overrides[name])
        throw new Error(`Multiple tarballs for ${name}; keep one version in ${source}.`);
      overrides[name] = `file:${path.join(source, file)}`;
    }
  }
  for (const name of Object.keys(manifest.dependencies).filter((name) =>
    name.startsWith('@bitakit/'),
  )) {
    if (!overrides[name])
      throw new Error(
        `Missing npm tarball for ${name} in ${source}. Files were generated; installation has not started.`,
      );
    manifest.dependencies[name] = overrides[name];
  }
  manifest.overrides = overrides;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
