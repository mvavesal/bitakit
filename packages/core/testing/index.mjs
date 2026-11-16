import { existsSync } from 'node:fs';
import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import { describeModule, loadDiscoveryConfig, packagePluginId } from '@bitakit/discovery';
import {
  createRuntime,
  discoverActions,
  discoverConfig,
  discoverEvents,
  discoverPermissions,
  discoverSettings,
  discoverInterceptors,
  discoverServices,
  discoverSlots,
  discoveredFile,
  configureAuthPaths,
} from '../dist/core.js';
import { createServer, requestContext } from '../dist/server/index.js';

/** The plugin ID a package declares (`bitakit.id`), or one derived from its name. */
async function packageId(directory) {
  for (let folder = directory; ; folder = path.dirname(folder)) {
    const manifest = await readFile(path.join(folder, 'package.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => undefined);
    if (manifest)
      return (manifest.bitakit ?? manifest.foundation)?.id ?? packagePluginId(manifest.name);
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

/** The ID of a mounted folder: `id`, then `plugin.config.ts`, the folder under `plugins/`, or the package name. */
async function pluginIdOf(directory, folder, manifest, id) {
  id =
    id ??
    manifest.id ??
    (path.basename(path.dirname(folder)) === 'plugins'
      ? path.basename(folder)
      : await packageId(folder));
  if (!id)
    throw new Error(
      `No plugin ID for ${directory}: pass { id }, set one in plugin.config.ts, or run inside a package with a name.`,
    );
  return id;
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
  id = await pluginIdOf(directory, module.directory, manifest, id);
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
 * The returned `events.recorded` lists every event emitted while mounted. `options.remote`
 * replaces the client `remote`: a stub, or `mountServer(...).as(identity(...))` so the client half
 * calls its real server half in-process.
 */
export async function mountPlugin(directory = 'src', options = {}) {
  const plugin = await loadPlugin(directory, options.id);
  const { id } = plugin;
  const others = await Promise.all(
    (options.plugins ?? []).map((other) => (typeof other === 'string' ? loadPlugin(other) : other)),
  );
  const runtime = createRuntime(
    { plugins: [plugin, ...others], configOverrides: options.configOverrides },
    { services: options.services, remote: options.remote },
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

/**
 * The first `@bitakit/discovery` release whose `describeModule` reports a module's `server/`
 * folder; `mountServer` reads it from there.
 */
const serverDiscoveryVersion = '0.3.1';

/** The nearest `tsconfig.json` at or above `directory`, whose `paths` server files may import through. */
async function tsconfigOf(directory) {
  for (let folder = directory; ; folder = path.dirname(folder)) {
    const file = path.join(folder, 'tsconfig.json');
    if (
      await access(file).then(
        () => true,
        () => false,
      )
    )
      return file;
    if (path.dirname(folder) === folder) return undefined;
  }
}

/**
 * The project around a mounted folder: the nearest folder with a package.json, its manifest and
 * its `bitakit.config.ts` (`{}` without one). `undefined` outside every package.
 */
async function projectOf(directory) {
  for (let folder = directory; ; folder = path.dirname(folder)) {
    const manifest = await readFile(path.join(folder, 'package.json'), 'utf8').then(
      JSON.parse,
      () => undefined,
    );
    if (manifest)
      return { root: folder, manifest, config: (await loadDiscoveryConfig(folder)).config };
    if (path.dirname(folder) === folder) return undefined;
  }
}

/** Frameworks that make a package an app, as the CLI detects them. */
const frameworks = ['next', '@tanstack/react-start', '@tanstack/react-router'];

/**
 * The app module's folder (`directory` of bitakit.config.ts, `./src` by default), or `undefined`
 * in a plugin package, whose `src` is the plugin.
 */
function appDirectoryOf(project) {
  if (!project) return undefined;
  const { manifest, config, root } = project;
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  if (
    (manifest.bitakit ?? manifest.foundation)?.plugin &&
    !frameworks.some((name) => dependencies[name])
  )
    return undefined;
  return path.resolve(root, config.directory ?? './src');
}

const realOrSelf = (file) => realpath(file).catch(() => path.resolve(file));

/**
 * A loader for server files. Unlike `mountPlugin` (Node's own type stripping), it goes through
 * jiti, so `@/server/db` (any `compilerOptions.paths` alias of the nearest tsconfig.json) and
 * extensionless `./helpers` resolve as they do in the app. jiti caches modules for the process
 * apart from Node's own ESM cache: an Action and a service share one helper module, but a test
 * that imports that module natively gets a second copy. Tests therefore reach server modules
 * through `module` (`mounted.import()`). Packages such as `@bitakit/core/server` load natively,
 * as the same instances the test uses.
 */
async function serverLoader(directory) {
  const tsconfig = await tsconfigOf(directory);
  const jiti = createJiti(path.join(directory, 'index.ts'), {
    fsCache: false,
    tsconfigPaths: tsconfig ?? false,
  });
  // A path relative to the working directory, as mountServer takes folders, or an alias or a
  // package, resolved as the app resolves them.
  const target = (specifier) =>
    path.isAbsolute(specifier) ||
    /^\.\.?(?:[\\/]|$)/.test(specifier) ||
    existsSync(path.resolve(specifier.split(/[\\/]/)[0]))
      ? path.resolve(specifier)
      : specifier;
  return {
    definition: (file) => jiti.import(file, { default: true }),
    module: (specifier) => jiti.import(target(specifier)),
  };
}

/** A service that answers the `requestContext` contract; the test provider takes its place. */
const providesRequestContext = (service) =>
  [service.id, service.provides, service.exposeAs].includes(requestContext);

/**
 * The server half of one folder, as discovery writes it into `src/bitakit.gen.server.ts`: the
 * shared `events.ts`, `settings.ts`, `permissions.ts` and `configs/`, plus `server/services`,
 * `server/actions`, `server/interceptors` and the files of the server-only contribution `kinds`
 * (`server/contributions/<dir>`), normalized by each kind's `from` module (a relative `from`
 * resolves against `kindBase`, the app folder the generated file lives in). Client files, `ui/`,
 * `setup.ts` and the rest of `server/` (the module's own code) are not mounted; files they import
 * load on demand. The app module (`app`) has the ID `id ?? plugin.config.ts id ?? 'app'` and
 * unprefixed Actions and services, as in the generated file.
 */
async function loadServerModule(directory, { id, app = false, load, kinds, kindBase }) {
  const module = await describeModule(path.resolve(directory), { kinds });
  if (!module.server)
    throw new Error(
      `mountServer needs @bitakit/discovery ${serverDiscoveryVersion} or newer: the installed version does not report server/ folders. Update @bitakit/discovery to ${serverDiscoveryVersion} or newer.`,
    );
  const manifest = await manifestOf(module.directory);
  id = app
    ? (id ?? manifest.id ?? 'app')
    : await pluginIdOf(directory, module.directory, manifest, id);
  const prefix = app ? '' : id;
  const files = (entries) =>
    Promise.all(
      entries.map(async (entry) =>
        discoveredFile(
          await load.definition(entry.file),
          entry.path,
          path.relative(process.cwd(), entry.file),
        ),
      ),
    );
  const permissionsFile = path.join(module.directory, 'permissions.ts');
  const permissions = await access(permissionsFile).then(
    () => files([{ file: permissionsFile, path: '' }]),
    () => [],
  );
  const contributions = {};
  for (const kind of kinds) {
    const entries = module.server.contributions?.[kind.name] ?? [];
    if (kind.runtime !== 'server' || !entries.length) continue;
    const from = /^\.\.?[\\/]/.test(kind.from) ? path.resolve(kindBase, kind.from) : kind.from;
    const normalize = (await load.module(from))[kind.normalize];
    if (typeof normalize !== 'function')
      throw new Error(
        `Contribution kind "${kind.name}": ${kind.from} has no export ${kind.normalize}.`,
      );
    contributions[kind.name] = normalize(await files(entries), id);
  }
  return {
    id,
    dependencies: manifest.dependencies,
    metadata: manifest.metadata,
    events: discoverEvents(await files(module.events)),
    settings: discoverSettings(await files(module.settings)),
    permissions: discoverPermissions(permissions),
    config: discoverConfig(await files(module.configs)),
    services: discoverServices(await files(module.server.services), prefix).filter(
      (service) => !providesRequestContext(service),
    ),
    actions: discoverActions(await files(module.server.actions), prefix),
    interceptors: discoverInterceptors(await files(module.server.interceptors)),
    contributions,
  };
}

/**
 * Mounts the server half of one folder for tests (see `loadServerModule`) and boots it. The
 * project's app folder (`directory` of bitakit.config.ts, `src` by default; `options.app`
 * decides explicitly) mounts as the app module, with unprefixed operations; any other folder
 * mounts as a plugin. `as(identity)` calls every operation, also private ones, with the same
 * access checks, input validation and interceptors as over HTTP. A test `requestContext`
 * provider answers each `as()` caller with its identity; it replaces any provider the mounted
 * folders declare (their file is still imported, but the service is left out), so tests never
 * need a real session. `options.plugins` adds plugin folders (their server halves) or `Plugin`
 * objects. As in the generated server file, a folder keeps only its dependencies on mounted
 * modules: package plugins such as `shell` have no server half. Server-only contribution kinds
 * come from bitakit.config.ts `kinds` and `options.kinds` (kinds a package declares through its
 * discovery hook). `import()` loads a server module as the mounted Actions see it. Rejects with
 * the attributed startup error after releasing what started.
 */
export async function mountServer(directory = 'src', options = {}) {
  if (options.services && Object.hasOwn(options.services, requestContext))
    throw new Error(
      'mountServer provides requestContext itself: pass identities to as(identity({ ... })) instead of a requestContext service.',
    );
  const target = path.resolve(directory);
  const project = await projectOf(target);
  const appDirectory = appDirectoryOf(project);
  const app =
    options.app ??
    (appDirectory !== undefined && (await realOrSelf(target)) === (await realOrSelf(appDirectory)));
  const configured = project?.config.kinds ?? [];
  if (!Array.isArray(configured)) throw new Error('Discovery "kinds" must be an array.');
  // bitakit.config.ts `kinds`, then `options.kinds`; the later one wins by name, as in discovery.
  const kinds = [
    ...new Map(
      [...configured, ...(options.kinds ?? [])].map((kind) => [kind?.name, kind]),
    ).values(),
  ];
  const load = await serverLoader(target);
  const context = { load, kinds, kindBase: appDirectory ?? target };
  const main = await loadServerModule(directory, { ...context, id: options.id, app });
  const others = await Promise.all(
    (options.plugins ?? []).map(async (other) => {
      if (typeof other === 'string')
        return { folder: true, plugin: await loadServerModule(other, context) };
      if (!other?.services) return { folder: false, plugin: other };
      const services = Array.isArray(other.services)
        ? other.services.filter((service) => !providesRequestContext(service))
        : Object.fromEntries(
            Object.entries(other.services).filter(
              ([name, service]) => !providesRequestContext({ id: name, ...service }),
            ),
          );
      return { folder: false, plugin: { ...other, services } };
    }),
  );
  const mounted = new Set(
    [main, ...others.map(({ plugin }) => plugin)].map((item) => item?.id?.toLowerCase()),
  );
  const kept = (module) => ({
    ...module,
    dependencies: module.dependencies?.filter((id) => mounted.has(String(id).toLowerCase())),
  });
  const plugins = others.map(({ folder, plugin }) => (folder ? kept(plugin) : plugin));
  const own = kept(main);
  // The app module is the configuration's top level, as in the generated server file.
  const config = app
    ? {
        appId: own.id,
        dependencies: own.dependencies,
        events: own.events,
        settings: own.settings,
        permissions: own.permissions,
        config: own.config,
        services: own.services,
        actions: own.actions,
        interceptors: own.interceptors,
        contributions: own.contributions,
        plugins,
        configOverrides: options.configOverrides,
      }
    : { plugins: [own, ...plugins], configOverrides: options.configOverrides };
  const identities = new WeakMap();
  const provider = { resolve: (request) => identities.get(request) ?? { user: null } };
  const server = createServer(config, {
    services: { ...options.services, [requestContext]: provider },
  });
  let completion;
  const release = () => (completion ??= server.stop());
  try {
    await server.ready;
  } catch (error) {
    try {
      await release();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Server startup and cleanup failed.');
    }
    throw error;
  }
  return {
    id: main.id,
    server,
    /** An in-process caller with this identity: `as(identity({ organization: 'org-1' })).todos.add(input)`. */
    as(who) {
      if (!who || typeof who !== 'object')
        throw new TypeError(
          'as() takes an identity: as(identity({ organization: "org-1" })), or identity({ user: null }) for a signed-out caller.',
        );
      const request = new Request('http://bitakit.test/');
      identities.set(request, who);
      return server.as(request);
    },
    /** A server module as the mounted Actions and services see it (the same instance). */
    import: (specifier) => load.module(specifier),
    stop: release,
    [Symbol.asyncDispose]: release,
  };
}

/** `'*'` or a list of operations, as `permissions` takes them per resource. */
function grants(listed, operations) {
  if (listed === '*') return true;
  return Array.isArray(listed) && operations.every((operation) => listed.includes(operation));
}

/**
 * A test identity for `mountServer(...).as()`. `user` is a user ID or object (`null` signs out;
 * default `{ id: 'user-1' }`); `organization` an organization ID or `{ id }` (a membership the
 * provider verified); `member` the membership record. `can` grants exactly the listed
 * `permissions` (`{ todos: ['create'] }`; `'*'` grants every resource, a resource's `'*'` every
 * operation) and nothing else. `reason` explains a missing organization.
 */
export function identity({ user, organization, member, permissions, reason } = {}) {
  if (
    permissions !== undefined &&
    permissions !== '*' &&
    (!permissions ||
      typeof permissions !== 'object' ||
      Array.isArray(permissions) ||
      Object.values(permissions).some((listed) => listed !== '*' && !Array.isArray(listed)))
  )
    throw new TypeError(
      "identity(): permissions is '*' or { <resource>: ['<operation>', ...] | '*' }.",
    );
  const can = (request) => {
    if (permissions === '*') return true;
    const entries = Object.entries(request ?? {});
    return (
      entries.length > 0 &&
      entries.every(
        ([resource, operations]) =>
          Object.hasOwn(permissions ?? {}, resource) &&
          Array.isArray(operations) &&
          grants(permissions[resource], operations),
      )
    );
  };
  return {
    user:
      user === null ? null : typeof user === 'string' ? { id: user } : (user ?? { id: 'user-1' }),
    organization:
      organization === undefined || organization === null
        ? null
        : typeof organization === 'string'
          ? { id: organization }
          : organization,
    member: member ?? null,
    ...(reason === undefined ? {} : { reason }),
    can,
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
