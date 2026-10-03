import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describeModule } from '../discovery/describe.mjs';
import {
  createRuntime,
  discoverActions,
  discoverConfig,
  discoverEvents,
  discoverSettings,
  discoverInterceptors,
  discoverServices,
  discoveredFile,
} from '../dist/core.js';

/** The plugin ID a package declares (`bitakit.id`), or one derived from its name. */
async function packageId(directory) {
  for (let folder = directory; ; folder = path.dirname(folder)) {
    const manifest = await readFile(path.join(folder, 'package.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => undefined);
    if (manifest)
      return (
        manifest.bitakit?.id ??
        manifest.foundation?.id ??
        (manifest.name ?? '')
          .replace(/^@[^/]+\//, '')
          .replace(/^bitakit-(plugin-)?/, '')
          .replace(/-plugin$/, '')
      );
    if (path.dirname(folder) === folder) return undefined;
  }
}

/**
 * Mounts one plugin folder headlessly for tests: services, actions, events, configs,
 * interceptors and `setup.ts`, discovered with the same conventions as apps. Files under `ui/`
 * are skipped. Files load through Node's TypeScript type stripping, so keep them free of JSX.
 * The returned `events.recorded` lists every event emitted while mounted.
 */
export async function mountPlugin(directory = 'src', options = {}) {
  const module = await describeModule(path.resolve(directory));
  const id =
    options.id ??
    (path.basename(path.dirname(module.directory)) === 'plugins'
      ? path.basename(module.directory)
      : await packageId(module.directory));
  if (!id) throw new Error('Pass { id } or run inside a package with a name.');
  const importDefault = async (file) => (await import(pathToFileURL(file).href)).default;
  const load = (entries) =>
    Promise.all(
      entries.map(async (entry) =>
        discoveredFile(
          await importDefault(entry.file),
          entry.path,
          path.relative(process.cwd(), entry.file),
        ),
      ),
    );
  const plugin = {
    id,
    services: discoverServices(await load(module.services), id),
    actions: discoverActions(await load(module.actions), id),
    events: discoverEvents(await load(module.events)),
    settings: discoverSettings(await load(module.settings)),
    config: discoverConfig(await load(module.configs)),
    interceptors: discoverInterceptors(await load(module.interceptors)),
    setup: module.setup ? await importDefault(module.setup) : undefined,
  };
  const runtime = createRuntime(
    { plugins: [plugin, ...(options.plugins ?? [])], configOverrides: options.configOverrides },
    { services: options.services },
  );
  const recorded = [];
  const unobserve = runtime.events.observe((event) =>
    recorded.push({ type: event.type, data: event.data }),
  );
  const { actions } = runtime;
  const stop = runtime.mount();
  const release = () => {
    unobserve();
    stop();
  };
  try {
    await runtime.ready;
  } catch (error) {
    // A failed onStart leaves the runtime mounted; release what the start created before reporting.
    release();
    throw error;
  }
  return {
    id,
    runtime,
    app: runtime.app,
    actions,
    /** Services as the plugin's contributions see them: `services.notes.items`. */
    services: runtime.services,
    events: Object.assign(runtime.events, { recorded }),
    /** Executes `<plugin>.<name>` (or a full action ID) and returns the execution outcome. */
    execute: (name, input) => actions.execute(name.includes('.') ? name : `${id}.${name}`, input),
    stop: release,
    [Symbol.dispose]: release,
  };
}
