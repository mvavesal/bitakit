import { generateBitaKit, watchBitaKit } from '@bitakit/discovery';
export { generateBitaKit };
/** Typed identity for `bitakit.config.ts`. */
export const defineBitaKit = (config) => config;
const watchers = new Map();

/**
 * Runs discovery before Next reads its configuration and keeps regenerating in development.
 * The generated file lives in `src/bitakit.gen.tsx`, so no bundler alias is needed and
 * Turbopack and Webpack behave the same.
 */
export function withBitaKit(config = {}) {
  return async (phase, context) => {
    const root = process.cwd();
    const base = typeof config === 'function' ? await config(phase, context) : config;
    const { included = [] } = (await generateBitaKit(root)) ?? {};
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
    };
  };
}
