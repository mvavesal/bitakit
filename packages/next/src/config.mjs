import { generateBitaKit, watchBitaKit } from '@bitakit/discovery';
export { generateBitaKit };
/** Typed identity for `bitakit.config.ts`. */
export const defineBitaKit = (config) => config;
const watchers = new Map();

/**
 * Runs discovery before Next reads its configuration and keeps regenerating in development.
 * The generated file lives in `src/bitakit.gen.tsx`, so the provider needs no bundler alias;
 * only package CSS imports that rely on the "style" export condition get a Turbopack alias.
 */
export function withBitaKit(config = {}) {
  return async (phase, context) => {
    const root = process.cwd();
    const base = typeof config === 'function' ? await config(phase, context) : config;
    const { included = [], styleAliases = {} } = (await generateBitaKit(root)) ?? {};
    if (phase === 'phase-development-server' && !watchers.has(root))
      watchers.set(
        root,
        watchBitaKit(root, (error) => console.error('[bitakit]', error)),
      );
    return {
      ...base,
      // Plugins included from outside the app (a plugin package's playground) are compiled too.
      ...(included.length ? { experimental: { ...base.experimental, externalDir: true } } : {}),
      transpilePackages: [...new Set([...(base.transpilePackages ?? []), '@bitakit/core'])],
      // Turbopack resolves CSS imports without the "style" condition that packages such as
      // tw-animate-css rely on; discovery hands it the resolved files. The app's aliases win.
      ...(Object.keys(styleAliases).length
        ? {
            turbopack: {
              ...base.turbopack,
              resolveAlias: { ...styleAliases, ...base.turbopack?.resolveAlias },
            },
          }
        : {}),
    };
  };
}