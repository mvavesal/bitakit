import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { describeModule } from '@bitakit/discovery';
import {
  createRuntime,
  discoverActions,
  discoverConfig,
  discoverEvents,
  discoverSettings,
  discoverInterceptors,
  discoverServices,
  discoverSlots,
  discoveredFile,
  configureAuthPaths,
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

/** The folder's `plugin.config.ts` (id, dependencies, metadata), loaded the way discovery loads it. */
async function manifestOf(directory) {
  const file = path.join(directory, 'plugin.config.ts');
  const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
  return readFile(file, 'utf8')
    .then(() => jiti.import(file, { default: true }))
    .catch((error) => {
      if (error.code === 'ENOENT' && error.path === file) return {};
      throw error;
    })
    .then((manifest) => manifest ?? {});
}

/**
 * Builds the headless plugin of one folder: services, actions, events, settings, configs,
 * interceptors, slot definitions and `setup.ts`, discovered with the same conventions as apps.
 * Files under `ui/` are skipped. The ID is `id`, then `plugin.config.ts`, the folder under
 * `plugins/`, or the package name.
 */
async function loadPlugin(directory, id) {
  const module = await describeModule(path.resolve(directory));
  const manifest = await manifestOf(module.directory);
  id =
    id ??
    manifest.id ??
    (path.basename(path.dirname(module.directory)) === 'plugins'
      ? path.basename(module.directory)
      : await packageId(module.directory));
  if (!id)
    throw new Error(
      `No plugin ID for ${directory}: pass { id }, set one in plugin.config.ts, or run inside a package with a name.`,
    );
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
    dependencies: manifest.dependencies,
    metadata: manifest.metadata,
    services: discoverServices(await load(module.services), id),
    slots: discoverSlots(await load(module.slotDefinitions), id),
    actions: discoverActions(await load(module.actions), id),
    events: discoverEvents(await load(module.events)),
    settings: discoverSettings(await load(module.settings)),
    config: discoverConfig(await load(module.configs)),
    interceptors: discoverInterceptors(await load(module.interceptors)),
    setup: module.setup ? await importDefault(module.setup) : undefined,
  };
  return plugin;
}

/**
 * Mounts one plugin folder headlessly for tests (see `loadPlugin` for what is discovered).
 * Files load through Node's TypeScript type stripping, so keep them free of JSX.
 * `options.plugins` adds further plugins: `Plugin` objects or other plugin folders, so an
 * integration test mounts two real folders without a hand-built `definePlugin`.
 * The returned `events.recorded` lists every event emitted while mounted.
 */
export async function mountPlugin(directory = 'src', options = {}) {
  const plugin = await loadPlugin(directory, options.id);
  const { id } = plugin;
  const others = await Promise.all(
    (options.plugins ?? []).map((other) => (typeof other === 'string' ? loadPlugin(other) : other)),
  );
  const runtime = createRuntime(
    { plugins: [plugin, ...others], configOverrides: options.configOverrides },
    { services: options.services },
  );
  const recorded = [];
  const unobserve = runtime.events.observe((event) =>
    recorded.push({ type: event.type, data: event.data }),
  );
  const { actions } = runtime;
  let completion;
  const release = () => {
    if (!completion) {
      unobserve();
      completion = runtime.stop();
    }
    return completion;
  };
  try {
    runtime.mount();
    await runtime.ready;
  } catch (error) {
    try {
      await release();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Plugin startup and cleanup failed.');
    }
    throw error;
  }
  return {
    id,
    runtime,
    app: runtime.app,
    actions,
    /** Services as the plugin's contributions see them: `services.notes.list`. */
    services: runtime.services,
    events: Object.assign(runtime.events, { recorded }),
    /** Executes `<plugin>.<name>` (or a full action ID) and returns the execution outcome. */
    execute: (name, input) => actions.execute(name.includes('.') ? name : `${id}.${name}`, input),
    stop: release,
    [Symbol.asyncDispose]: release,
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Waits until `ready()` holds, failing with `message` after `timeout` milliseconds. */
async function until(ready, message, timeout) {
  const deadline = Date.now() + timeout;
  while (!ready()) {
    if (Date.now() > deadline) throw new Error(`auth contract: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * Checks an `auth` provider against the AuthService contract, for the provider's own tests:
 * a stable snapshot, working subscribe/unsubscribe, a string `user.id` after `signIn`, an
 * awaited `signOut` that clears the user, and valid optional `paths`/`signIn`. `signIn` drives
 * the provider's own login. Rejects with the first broken rule.
 */
export async function assertAuthContract(service, { signIn, timeout = 2000 }) {
  const fail = (rule) => {
    throw new Error(`auth contract: ${rule}`);
  };
  for (const method of ['getSnapshot', 'subscribe', 'signOut'])
    if (typeof service?.[method] !== 'function') fail(`${method}() is missing.`);
  if (service.signIn !== undefined && typeof service.signIn !== 'function')
    fail('signIn must be a function when present.');
  if (service.paths !== undefined) {
    try {
      configureAuthPaths(service.paths);
    } catch (error) {
      fail(`paths are invalid: ${error.message}`);
    }
  }
  await until(() => !service.getSnapshot().pending, 'the snapshot stays pending.', timeout);
  const initial = service.getSnapshot();
  for (const key of ['user', 'pending', 'error'])
    if (!(key in initial)) fail(`the snapshot has no "${key}".`);
  if (service.getSnapshot() !== initial)
    fail('getSnapshot() must return the same object until it changes.');
  if (initial.user !== null && !initial.error) await service.signOut();

  let notified = 0;
  const unsubscribe = service.subscribe(() => notified++);
  if (typeof unsubscribe !== 'function') fail('subscribe() must return an unsubscribe function.');
  await signIn();
  await until(() => service.getSnapshot().user !== null, 'no user after signIn.', timeout);
  const signedIn = service.getSnapshot();
  if (typeof signedIn.user.id !== 'string' || !signedIn.user.id)
    fail('user.id must be a non-empty string.');
  if (signedIn.pending) fail('pending must be false once the user is known.');
  if (signedIn.error) fail('a signed-in snapshot must not carry an error.');
  if (signedIn === initial) fail('the snapshot must be a new object after a change.');
  if (service.getSnapshot() !== signedIn) fail('the signed-in snapshot must be stable.');
  if (notified === 0) fail('subscribe() listeners must be called when the session changes.');

  const result = service.signOut();
  if (typeof result?.then !== 'function') fail('signOut() must return a promise.');
  await result;
  const signedOut = service.getSnapshot();
  if (signedOut.user !== null) fail('signOut() must resolve after the user is cleared.');
  if (signedOut.pending) fail('pending must be false after signOut().');

  unsubscribe();
  const after = notified;
  await signIn();
  await settle();
  if (notified !== after) fail('listeners must not be called after unsubscribe.');
  await service.signOut();
}
