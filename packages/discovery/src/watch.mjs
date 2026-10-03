import { watch } from 'node:fs';
import { generateFoundation } from './generate.mjs';

const ignored =
  /(^|[\\/])(node_modules|\.next|\.foundation|\.git|\.tanstack|\.output|dist|coverage)([\\/]|$)|bitakit\.gen\./;

/**
 * Framework-independent development discovery. The bundler observes the generated imports.
 * Plugins included from outside the project (`plugins.include`) are watched as well.
 */
export function watchFoundation(root, onError = console.error) {
  let timer;
  let stopped = false;
  let chain = Promise.resolve();
  const extra = new Map();
  const regenerate = () => {
    chain = chain
      .then(async () => {
        if (stopped) return;
        const result = await generateFoundation(root);
        sync(result?.included ?? []);
      })
      .catch(onError);
  };
  const listener = (event, file) => {
    if (!file || ignored.test(file)) return;
    // Directory creation may be the only event before recursive watching attaches.
    if (event !== 'rename' && !/\.(ts|tsx|json)$/.test(file)) return;
    clearTimeout(timer);
    timer = setTimeout(regenerate, 80);
  };
  const sync = (directories) => {
    if (stopped) return;
    for (const directory of directories)
      if (!extra.has(directory)) {
        try {
          const watcher = watch(directory, { recursive: true }, listener);
          watcher.unref();
          extra.set(directory, watcher);
        } catch (error) {
          if (error.code !== 'ENOENT') onError(error);
        }
      }
    for (const [directory, watcher] of extra)
      if (!directories.includes(directory)) {
        watcher.close();
        extra.delete(directory);
      }
  };
  const watcher = watch(root, { recursive: true }, listener);
  watcher.unref();
  regenerate();
  return () => {
    stopped = true;
    clearTimeout(timer);
    watcher.close();
    for (const extraWatcher of extra.values()) extraWatcher.close();
    extra.clear();
  };
}
