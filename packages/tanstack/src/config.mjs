import { generateBitaKit, watchBitaKit } from '@bitakit/discovery';

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
      await generateBitaKit(root);
      return { ssr: { noExternal: [/^@bitakit\//] } };
    },
    configureServer(server) {
      stop = watchBitaKit(server.config.root, (error) =>
        server.config.logger.error(error?.stack ?? String(error)),
      );
      server.httpServer?.once('close', () => stop?.());
    },
    closeBundle() {
      stop?.();
    },
  };
}
export { generateBitaKit };
/** Typed identity for `bitakit.config.ts`. */
export const defineBitaKit = (config) => config;
