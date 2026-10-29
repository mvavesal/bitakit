import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
  realpath,
} from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import npa from 'npm-package-arg';
import { build, version as esbuildVersion } from 'esbuild';
import { rollup, VERSION as rollupVersion } from 'rollup';
import { satisfies } from 'semver';
import { resolvePluginEntry, resolveStylesheet, staticPluginId } from '@bitakit/discovery';
import type { PackageArtifact } from '../artifacts.js';

const run = promisify(execFile);
const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const integrity = (value: Buffer) =>
  `sha384-${createHash('sha384').update(value).digest('base64')}`;
const list = (value?: string | string[]) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * Trusted npm/Git acquisition using npm's resolver/installer, esbuild and Rollup. No package
 * lifecycle scripts run. The host authorizes sources and serves returned immutable artifacts.
 */
export function createPackageInstaller(options: {
  directory: string;
  /** Exact shared host package versions. Their modules must also be supplied to the browser loader. */
  shared: Readonly<Record<string, string>>;
  /** Standard npm registry override; credentials remain in the host npm configuration. */
  registry?: string;
}) {
  const root = path.resolve(options.directory);
  const artifacts = path.join(root, 'artifacts');
  async function read(id: string): Promise<PackageArtifact> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid artifact digest.');
    const descriptor = (await json(path.join(artifacts, id, 'artifact.json'))) as PackageArtifact;
    const { id: storedId, ...content } = descriptor;
    if (storedId !== id || digest(JSON.stringify(content)) !== id)
      throw new Error('Artifact identity mismatch.');
    for (const [file, expected] of Object.entries(descriptor.files)) {
      if (path.basename(file) !== file) throw new Error('Artifact files must be flat.');
      if (integrity(await readFile(path.join(artifacts, id, file))) !== expected)
        throw new Error(`Artifact integrity mismatch: ${file}.`);
    }
    return descriptor;
  }
  async function install(
    spec: string,
    input: {
      signal?: AbortSignal;
      /** Explicit source entry for an unbuilt Git package; ordinary built packages resolve bitakit.plugin. */
      entry?: string;
      /** Complete IDs for a multi-plugin factory. Otherwise the existing manifest/sidecar binding is required. */
      pluginIds?: readonly string[];
    } = {},
  ): Promise<PackageArtifact> {
    const parsed = npa(spec);
    if (!['git', 'version', 'range', 'tag', 'file', 'directory', 'remote'].includes(parsed.type))
      throw new Error(`Unsupported package source: ${parsed.type}.`);
    // Preserve case-sensitive Git refs and filesystem paths. Only npm identities are folded.
    const requested =
      parsed.registry && parsed.name ? `${parsed.name.toLowerCase()}@${parsed.rawSpec}` : spec;
    await mkdir(root, { recursive: true });
    const staging = await mkdtemp(path.join(root, 'staging-'));
    try {
      await writeFile(
        path.join(staging, 'package.json'),
        JSON.stringify({ name: 'bitakit-runtime-staging', private: true, version: '0.0.0' }),
      );
      const registryArgs = options.registry ? ['--registry', options.registry] : [];
      const registry = (
        await run('npm', ['config', 'get', 'registry', ...registryArgs], { cwd: staging })
      ).stdout.trim();
      await run(
        'npm',
        [
          'install',
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          '--save-exact',
          '--install-links',
          ...registryArgs,
          requested,
        ],
        {
          cwd: staging,
          signal: input.signal,
          maxBuffer: 8 * 1024 * 1024,
          env: { ...process.env, npm_config_ignore_scripts: 'true' },
        },
      );
      input.signal?.throwIfAborted();
      const lock = await json(path.join(staging, 'package-lock.json'));
      const names = Object.keys(lock.packages[''].dependencies ?? {});
      if (names.length !== 1) throw new Error('Expected one root package installation.');
      const name = names[0].toLowerCase();
      const packageRoot = await realpath(path.join(staging, 'node_modules', names[0]));
      const manifest = await json(path.join(packageRoot, 'package.json'));
      if (manifest.name.toLowerCase() !== name)
        throw new Error('Installed package name differs from the requested identity.');
      const metadata = manifest.bitakit ?? manifest.foundation ?? {};
      const entry = input.entry
        ? await realpath(path.resolve(packageRoot, input.entry))
        : resolvePluginEntry(
            `${manifest.name}/${String(metadata.plugin ?? '').replace(/^\.\//, '')}`,
            path.join(staging, 'package.json'),
          );
      if (!entry.startsWith(`${packageRoot}${path.sep}`))
        throw new Error('Plugin entry must be inside the installed package.');
      const sidecar = await json(entry.replace(/\.[cm]?[jt]sx?$/, '.slots.json')).catch((error) => {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      });
      const single = staticPluginId(name, metadata, sidecar);
      const ids = input.pluginIds ? [...input.pluginIds] : single ? [single] : [];
      if (
        !ids.length ||
        ids.some((id) => typeof id !== 'string' || !id) ||
        new Set(ids).size !== ids.length
      )
        throw new Error(
          'Complete static plugin IDs are required before building a runtime artifact.',
        );
      if (single && (ids.length !== 1 || ids[0] !== single))
        throw new Error('Explicit plugin IDs contradict the manifest/sidecar binding.');
      const peers: Record<string, string> = {};
      const external = [
        ...new Set([
          'react',
          'react-dom',
          '@bitakit/core',
          '@bitakit/ui',
          ...Object.keys(options.shared),
        ]),
      ].flatMap((name) => [name, `${name}/*`]);
      const output = path.join(staging, 'output');
      await mkdir(output);
      const styles = [...list(metadata.theme), ...list(metadata.styles)].map((style) =>
        resolveStylesheet(
          `${manifest.name}/${style.replace(/^\.\//, '')}`,
          path.join(staging, 'package.json'),
        ),
      );
      const source = [
        ...styles.map((style) => `import ${JSON.stringify(style)};`),
        `export { default } from ${JSON.stringify(entry)};`,
      ].join('\n');
      const built = await build({
        stdin: { contents: source, resolveDir: packageRoot, sourcefile: 'runtime-package.js' },
        outfile: path.join(output, 'intermediate.js'),
        bundle: true,
        platform: 'browser',
        format: 'esm',
        jsx: 'automatic',
        target: 'es2022',
        external,
        metafile: true,
        loader: {
          '.svg': 'dataurl',
          '.png': 'dataurl',
          '.jpg': 'dataurl',
          '.woff': 'dataurl',
          '.woff2': 'dataurl',
        },
        define: { 'process.env.NODE_ENV': '"production"' },
        logLevel: 'silent',
      });
      // Validate packages actually included in the artifact. Dependencies of an external host
      // module are already supplied by the host and must not impose a second installed version.
      for (const location of Object.keys(lock.packages).filter((name) =>
        name.includes('node_modules/'),
      )) {
        const folder = await realpath(path.join(staging, location)).catch((error) => {
          if (error.code === 'ENOENT') return undefined; // npm can omit platform-specific optional dependencies.
          throw error;
        });
        if (!folder) continue;
        if (
          !Object.keys(built.metafile!.inputs).some((file) =>
            path.resolve(file).startsWith(`${folder}${path.sep}`),
          )
        )
          continue;
        const dependency = await json(path.join(staging, location, 'package.json'));
        for (const [peer, range] of Object.entries({
          ...dependency.dependencies,
          ...dependency.peerDependencies,
        })) {
          if (!(peer in options.shared)) continue;
          if (!satisfies(options.shared[peer], String(range)))
            throw new Error(
              `${dependency.name} requires ${peer}@${range}; host has ${options.shared[peer]}.`,
            );
          // The browser verifies the exact host line used for preparation as well.
          peers[peer] = options.shared[peer];
        }
      }
      input.signal?.throwIfAborted();
      const imports = [
        ...new Set(
          Object.values(built.metafile!.outputs).flatMap((item) =>
            item.imports.filter((i) => i.external).map((i) => i.path),
          ),
        ),
      ];
      for (const specifier of imports) {
        const owner = Object.keys(options.shared).find(
          (name) => specifier === name || specifier.startsWith(`${name}/`),
        );
        if (!owner) throw new Error(`Unbound external import: ${specifier}.`);
        peers[owner] = options.shared[owner];
      }
      const bundle = await rollup({
        input: path.join(output, 'intermediate.js'),
        external: imports,
      });
      try {
        await bundle.write({
          file: path.join(output, 'plugin.js'),
          format: 'system',
          inlineDynamicImports: true,
        });
      } finally {
        await bundle.close();
      }
      await rm(path.join(output, 'intermediate.js'));
      const css = (await readdir(output)).filter((file) => file.endsWith('.css'));
      const files: Record<string, string> = {};
      for (const file of (await readdir(output)).sort())
        files[file] = integrity(await readFile(path.join(output, file)));
      const evidence = {
        requested,
        resolved: lock.packages[`node_modules/${names[0]}`],
        lock,
        toolchain: {
          node: process.version,
          npm: (await run('npm', ['--version'])).stdout.trim(),
          esbuild: esbuildVersion,
          rollup: rollupVersion,
        },
      };

      const descriptor = {
        name,
        version: manifest.version,
        source: parsed.registry
          ? `npm:${registry.replace(/(https?:\/\/)[^/@]+@/, '$1')}${name}`
          : String(parsed.fetchSpec ?? spec).replace(/(https?:\/\/)[^/@]+@/, '$1'),
        pluginIds: ids,
        entry: 'plugin.js',
        styles: css,
        files,
        imports,
        peers,
      };
      const id = digest(JSON.stringify(descriptor));
      const artifact: PackageArtifact = { id, ...descriptor };
      await mkdir(path.join(root, 'evidence'), { recursive: true });
      await writeFile(path.join(root, 'evidence', `${id}.json`), JSON.stringify(evidence));
      await writeFile(path.join(output, 'artifact.json'), JSON.stringify(artifact));
      await mkdir(artifacts, { recursive: true });
      try {
        await rename(output, path.join(artifacts, id));
      } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? ''))
          throw error;
        await read(id);
      }
      return artifact;
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }
  // Retention is deliberately explicit: there is no automatic GC of active or recovery artifacts.
  return Object.freeze({ install, read, directory: artifacts });
}
