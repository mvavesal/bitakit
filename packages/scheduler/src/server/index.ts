import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { dirname, basename, extname } from 'node:path';
import { parseScheduleDocument } from '../sources.js';
import type { ScheduleSource } from '../types.js';

/** Node-only runtime file source. Watches the directory so atomic file replacement is observed. */
export function fileSource(options: {
  id: string;
  path: string;
  priority?: number;
  format?: 'json' | 'yaml';
  watch?: boolean;
}): ScheduleSource {
  let watcherError: Error | undefined;
  return {
    id: options.id,
    priority: options.priority,
    async load() {
      if (watcherError) throw watcherError;
      return parseScheduleDocument(
        await readFile(options.path, 'utf8'),
        options.format ?? (extname(options.path).toLowerCase() === '.json' ? 'json' : 'yaml'),
      );
    },
    ...(options.watch === false
      ? {}
      : {
          subscribe(onChange: () => void) {
            const watcher = watch(dirname(options.path), (_event, name) => {
              if (name === null || name.toString() === basename(options.path)) onChange();
            });
            // A watcher error requests a reload; the source reports any read failure normally.
            watcher.on('error', (error) => {
              watcherError = error;
              onChange();
            });
            return () => watcher.close();
          },
        }),
  };
}
