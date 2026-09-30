import path from 'node:path';
import { generateFoundationHost, watchFoundation } from '@bitakit/core/discovery';

/** Vite integration reuses Core discovery and lets Vite watch its generated import graph. */
export function foundation() {
  let stop;
  return {
    name: 'saas-foundation',
    enforce: 'pre',
    async config(config) {
      const root = path.resolve(config.root ?? process.cwd());
      await generateFoundationHost(root);
      return {
        resolve: {
          alias: { '@bitakit/tanstack/generated': path.join(root, '.foundation/app.ts') },
        },
        ssr: { noExternal: [/^@bitakit\//] },
      };
    },
    configureServer(server) {
      stop = watchFoundation(server.config.root, (error) =>
        server.config.logger.error(String(error)),
      );
      server.httpServer?.once('close', () => stop?.());
    },
    closeBundle() {
      stop?.();
    },
  };
}
