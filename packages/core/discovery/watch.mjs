import { watch } from 'node:fs';
import { generateFoundation } from './generate.mjs';
/** Framework-independent development discovery. The bundler observes generated imports. */
export function watchFoundation(root, onError = console.error) {
  let timer;
  let stopped = false;
  let chain = Promise.resolve();
  const watcher = watch(root, { recursive: true }, (event, file) => {
    if (!file || /(^|\/)(node_modules|\.next|\.foundation|\.git)(?:\/|$)/.test(file)) return;
    // Directory creation may be the only event before recursive watching attaches.
    if (event !== 'rename' && !/\.(ts|tsx|json)$/.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      chain = chain.then(() => (stopped ? undefined : generateFoundation(root))).catch(onError);
    }, 80);
  });
  watcher.unref();
  return () => {
    stopped = true;
    clearTimeout(timer);
    watcher.close();
  };
}
