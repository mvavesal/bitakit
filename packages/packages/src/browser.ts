import { satisfies } from 'semver';
import { z } from 'zod';
import type { Plugin } from '@bitakit/core';
import type { PackageSelection } from './index.js';
import type { PackageArtifact, PackageProvider } from './artifacts.js';

/** The standard SystemJS API, supplied by the host; this adapter does not inject a script or globals. */
export type SystemModuleLoader = {
  set(url: string, module: object): unknown;
  get(url: string): object | undefined;
  delete(url: string): unknown;
  addImportMap(map: {
    scopes: Record<string, Record<string, string>>;
    integrity: Record<string, string>;
  }): void;
  import(url: string): Promise<{ default: unknown }>;
};
const artifactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  source: z.string(),
  pluginIds: z.array(z.string().min(1)).min(1),
  entry: z.string().min(1),
  styles: z.array(z.string()),
  files: z.record(z.string(), z.string().min(1)),
  imports: z.array(z.string()),
  peers: z.record(z.string(), z.string()),
});

/** Bind actual host namespaces through SystemJS's standard registry. No second React/Core/UI copy. */
export function createBrowserPackageProvider(options: {
  system: SystemModuleLoader;
  shared: Readonly<Record<string, { module: object; version: string }>>;
  /** Resolve an authorized immutable descriptor and its serving directory. No code is evaluated here. */
  resolve(
    selection: PackageSelection,
    signal: AbortSignal,
  ): Promise<{ artifact: PackageArtifact; baseURL: string }>;
  document?: Document;
}): PackageProvider {
  const system = options.system;
  const shared: Record<string, string> = {};
  for (const [specifier, binding] of Object.entries(options.shared)) {
    const url = `bitakit:shared/${specifier}`;
    const existing = system.get(url);
    if (
      existing &&
      !Object.entries(binding.module).every(
        ([key, value]) => (existing as Record<string, unknown>)[key] === value,
      )
    )
      throw new Error(`Shared module ${specifier} already belongs to another host.`);
    if (!existing) system.set(url, binding.module);
    shared[specifier] = url;
  }
  return {
    async resolve(selection, signal) {
      const resolved = await options.resolve(selection, signal);
      const artifact = artifactSchema.parse(resolved.artifact);
      const base = new URL(resolved.baseURL);
      if (!base.pathname.endsWith('/')) throw new Error('Artifact baseURL must end with a slash.');
      const url = (file: string) => {
        if (
          !Object.hasOwn(artifact.files, file) ||
          file.includes('/') ||
          file.includes('\\') ||
          file === '..'
        )
          throw new Error(`Undeclared artifact file: ${file}.`);
        return new URL(file, base).href;
      };
      for (const [name, range] of Object.entries(artifact.peers))
        if (!options.shared[name] || !satisfies(options.shared[name].version, range))
          throw new Error(`Incompatible shared peer ${name}@${range}.`);
      for (const specifier of artifact.imports)
        if (!Object.hasOwn(shared, specifier))
          throw new Error(`Host must bind shared module ${specifier}.`);
      const entry = url(artifact.entry);
      const styles = artifact.styles.map(url);
      const integrity = Object.fromEntries(
        Object.keys(artifact.files).map((file) => [url(file), artifact.files[file]]),
      );
      system.addImportMap({ scopes: { [base.href]: shared }, integrity });
      return {
        artifact,
        async load(incoming) {
          const loading = new AbortController();
          const signal = AbortSignal.any([incoming, loading.signal]);
          const document = options.document ?? globalThis.document;
          const links: HTMLLinkElement[] = [];
          const dispose = () => {
            for (const link of links) link.remove();
          };
          try {
            await Promise.all(
              styles.map(
                (href) =>
                  new Promise<void>((resolve, reject) => {
                    signal.throwIfAborted();
                    const link = document.createElement('link');
                    links.push(link);
                    link.rel = 'stylesheet';
                    link.href = href;
                    link.integrity = integrity[href];
                    link.crossOrigin = 'anonymous';
                    link.media = 'not all';
                    const finish = (error?: Error) => {
                      clearTimeout(timer);
                      signal.removeEventListener('abort', abort);
                      link.onload = link.onerror = null;
                      error ? reject(error) : resolve();
                    };
                    const abort = () => finish(new Error('Stylesheet loading cancelled.'));
                    const timer = setTimeout(
                      () => finish(new Error(`Stylesheet timed out: ${href}.`)),
                      15000,
                    );
                    signal.addEventListener('abort', abort, { once: true });
                    link.onload = () => finish();
                    link.onerror = () => finish(new Error(`Stylesheet failed: ${href}.`));
                    document.head.append(link);
                  }),
              ),
            );
            signal.throwIfAborted();
            const imported = await system.import(entry);
            signal.throwIfAborted();
            const value =
              typeof imported.default === 'function' ? await imported.default() : imported.default;
            const plugins = (Array.isArray(value) ? value : [value]) as Plugin[];
            return {
              plugins,
              activate: () => {
                for (const link of links) link.media = 'all';
              },
              deactivate: () => {
                for (const link of links) link.media = 'not all';
              },
              dispose,
            };
          } catch (error) {
            loading.abort();
            dispose();
            system.delete(entry);
            throw error;
          }
        },
      };
    },
  };
}
