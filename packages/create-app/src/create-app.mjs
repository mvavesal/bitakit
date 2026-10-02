import { mkdir, readdir, readFile, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import validateName from 'validate-npm-package-name';
import { pluginFiles } from '@bitakit/cli';
import { resolveFeatures, defaultFeatures } from './features.mjs';
import { next } from './adapters/next.mjs';
import { tanstack } from './adapters/tanstack.mjs';
import { createPluginPackage } from './plugin-package.mjs';
import { writeProjectFiles } from './project-files.mjs';

export const adapters = { next, tanstack };

/** Refuse existing paths, including symlinks; a starter never edits an existing project. */
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
  const type = options.type ?? 'app';
  if (!['app', 'plugin'].includes(type)) throw new Error(`Unknown project type: ${type}. Use app or plugin.`);
  const framework = options.framework ?? 'next';
  if (!Object.hasOwn(adapters, framework))
    throw new Error(
      `Unsupported framework: ${framework}. Available: ${Object.keys(adapters).join(', ')}.`,
    );
  // A plugin package's playground is a full app with the App Shell.
  const features = resolveFeatures(type === 'plugin' ? defaultFeatures : (options.features ?? defaultFeatures));
  return {
    type,
    target,
    name,
    framework,
    features,
    sample: type === 'app' && !!options.sample,
    install: options.install !== false,
  };
}

/** Creates an app or a standalone plugin package with its playground. */
export async function createProject(plan, options = {}) {
  const run =
    options.run ??
    ((command, args, cwd) =>
      execa(command, args, {
        cwd,
        stdio: 'inherit',
        env: { TANSTACK_CLI_TELEMETRY_DISABLED: '1' },
      }));
  // Repeat the destination check immediately before anything is written.
  await planProject(plan.target, plan);
  await mkdir(path.dirname(plan.target), { recursive: true });
  if (plan.type === 'plugin') return createPluginPackage(plan, { ...options, run, createApp });
  return createApp(plan, { ...options, run });
}

/** Native framework files first, then only the selected BitaKit composition. */
export async function createApp(plan, { run, packagesDir, install = plan.install } = {}) {
  const adapter = adapters[plan.framework];
  await adapter.scaffold(plan, run);
  await adapter.configure(plan);
  if (plan.sample) await writeProjectFiles(path.join(plan.target, 'src/plugins/todos'), pluginFiles('todos'));
  if (packagesDir) await useLocalPackages(plan.target, packagesDir);
  if (install) await run('npm', ['install'], plan.target);
  return plan.target;
}

/**
 * npm tarballs allow isolated verification before packages are published. Every @bitakit
 * dependency, including transitive ones, resolves to the matching archive.
 */
export async function useLocalPackages(target, directory) {
  const source = path.resolve(directory);
  const files = await readdir(source);
  const manifestPath = path.join(target, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const overrides = {};
  for (const file of files.filter((file) => file.startsWith('bitakit-') && file.endsWith('.tgz'))) {
    const match = /^bitakit-(.+)-(\d+\.\d+\.\d+(?:-[\w.-]+)?)\.tgz$/.exec(file);
    if (match) {
      const name = `@bitakit/${match[1]}`;
      if (overrides[name])
        throw new Error(`Multiple tarballs for ${name}; keep one version in ${source}.`);
      overrides[name] = `file:${path.join(source, file)}`;
    }
  }
  for (const field of ['dependencies', 'devDependencies'])
    for (const name of Object.keys(manifest[field] ?? {}).filter((name) => name.startsWith('@bitakit/'))) {
      if (!overrides[name])
        throw new Error(
          `Missing npm tarball for ${name} in ${source}. Files were generated; installation has not started.`,
        );
      manifest[field][name] = overrides[name];
    }
  manifest.overrides = { ...manifest.overrides, ...overrides };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
