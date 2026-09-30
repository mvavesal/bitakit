import { watchFoundation } from '@bitakit/core/discovery';
import { generateFoundation } from './generate.mjs';
import path from 'node:path';
export { generateFoundation };
export const defineFoundation = (config) => config;
const watchers = new Map();
export function withFoundation(config = {}) {
  return async (phase) => {
    const root = process.cwd();
    await generateFoundation(root);
    const generated = path.join(root, '.foundation/app.ts');
    if (phase === 'phase-development-server' && !watchers.has(root)) {
      watchers.set(
        root,
        watchFoundation(root, (error) => console.error('[foundation]', error)),
      );
    }
    return {
      ...config,
      turbopack: {
        ...config.turbopack,
        resolveAlias: {
          ...config.turbopack?.resolveAlias,
          '@bitakit/next/generated': generated,
        },
      },
      webpack(webpackConfig, context) {
        const resolved = config.webpack?.(webpackConfig, context) ?? webpackConfig;
        resolved.resolve ??= {};
        resolved.resolve.alias = {
          ...resolved.resolve.alias,
          '@bitakit/next/generated$': generated,
        };
        return resolved;
      },
      transpilePackages: [
        ...new Set([...(config.transpilePackages ?? []), '@bitakit/core']),
      ],
    };
  };
}
