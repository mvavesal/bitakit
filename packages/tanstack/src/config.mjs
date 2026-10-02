import { generateFoundation, watchFoundation } from '@bitakit/core/discovery';

/**
 * Vite integration: runs discovery before the config is resolved and keeps regenerating in
 * development. The generated file lives in `src/bitakit.gen.tsx`; no alias is needed.
 */
export function bitakit() {
  let stop;
  return {
    name: 'bitakit',
    enforce: 'pre',
    async config(config) {
      const root = config.root ?? process.cwd();
      await generateFoundation(root);
      return { ssr: { noExternal: [/^@bitakit\//] } };
    },
    configureServer(server) {
      stop = watchFoundation(server.config.root, (error) =>
        server.config.logger.error(error?.stack ?? String(error)),
      );
      server.httpServer?.once('close', () => stop?.());
    },
    closeBundle() {
      stop?.();
    },
  };
}
/** @deprecated Use bitakit(). */
export const foundation = bitakit;
export { generateFoundation };
/** Typed identity for `bitakit.config.ts`. */
export const defineBitaKit = (config) => config;
/** @deprecated Use defineBitaKit. */
export const defineFoundation = defineBitaKit;
