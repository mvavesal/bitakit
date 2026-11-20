import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createEmitter, generatedHeader } from './emitter.mjs';
import { serverActionsOf } from './server-rules.mjs';

const quote = JSON.stringify;
/** The first `@bitakit/core` release with the `./server` entry the server file imports. */
export const serverCoreVersion = '0.3.2';
export const defaultEndpoint = '/api/rpc';

/** `server.endpoint` of bitakit.config.ts as a URL path without a trailing slash. */
export function serverEndpoint(config) {
  const endpoint = config.server?.endpoint ?? defaultEndpoint;
  if (
    typeof endpoint !== 'string' ||
    !/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*\/?$/.test(endpoint) ||
    endpoint.split('/').some((segment) => segment === '.' || segment === '..')
  )
    throw new Error(
      `server.endpoint in bitakit.config.ts must be a URL path such as "${defaultEndpoint}", got ${JSON.stringify(endpoint)}.`,
    );
  return endpoint.replace(/\/$/, '');
}

/**
 * `server.publish` in bitakit.config.ts: which package plugins' exposed operations the app serves
 * over HTTP – operation IDs or `<plugin>.*`. Installing a package never adds endpoints by itself.
 */
export function serverPublish(config) {
  const publish = config.server?.publish ?? [];
  if (
    !Array.isArray(publish) ||
    publish.some(
      (item) =>
        typeof item !== 'string' || !/^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*(?:\.\*)?$/.test(item),
    )
  )
    throw new Error(
      `server.publish in bitakit.config.ts lists operation IDs or "<plugin>.*", got ${JSON.stringify(publish)}.`,
    );
  return publish;
}
/** Whether `id` is published by one of the `server.publish` patterns. */
export const isPublished = (publish, id) =>
  publish.some((item) => item === id || (item.endsWith('.*') && id.startsWith(item.slice(0, -1))));

/**
 * `server.rateLimit` of bitakit.config.ts: `undefined` (the defaults), `false` (off) or the numbers
 * `{ limit?, windowMs? }`. The client key and a shared store are code: a server service provides
 * `rateLimit`.
 */
export function serverRateLimit(config) {
  const value = config.server?.rateLimit;
  if (value === undefined || value === false) return value;
  const fields = ['limit', 'windowMs'];
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((name) => !fields.includes(name)) ||
    fields.some(
      (name) =>
        value[name] !== undefined && (!Number.isSafeInteger(value[name]) || value[name] < 1),
    )
  )
    throw new Error(
      `server.rateLimit in bitakit.config.ts is false or { limit?, windowMs? } with whole numbers of 1 or more, got ${JSON.stringify(value)}. The client key and a shared store come from a server service that provides rateLimit.`,
    );
  return Object.fromEntries(
    fields.filter((name) => value[name] !== undefined).map((name) => [name, value[name]]),
  );
}

/**
 * The installed `@bitakit/core` must have the `./server` entry the server file imports. Looks it
 * up from the project root the way Node would, without running it.
 */
async function assertServerCore(root, reason) {
  const lookup = createRequire(path.join(root, 'package.json')).resolve.paths('@bitakit/core');
  for (const directory of lookup ?? []) {
    const manifest = await readFile(
      path.join(directory, '@bitakit', 'core', 'package.json'),
      'utf8',
    )
      .then(JSON.parse)
      .catch((error) => {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined;
        throw error;
      });
    if (!manifest) continue;
    if (manifest.exports?.['./server']) return;
    throw new Error(
      `${reason} needs @bitakit/core ${serverCoreVersion} or newer (the @bitakit/core/server entry), but the installed @bitakit/core ${manifest.version ?? '(unknown version)'} does not have it. Update @bitakit/core to ${serverCoreVersion} or newer.`,
    );
  }
  throw new Error(
    `${reason} needs @bitakit/core ${serverCoreVersion} or newer (the @bitakit/core/server entry), but @bitakit/core is not installed. Install @bitakit/core ${serverCoreVersion} or newer.`,
  );
}

/**
 * The server half of the app, `src/bitakit.gen.server.ts`, or `null` when no enabled module has
 * server content (server Actions, services, interceptors or server-kind files).
 *
 * `modules` lists the app first, then every enabled local plugin in the client file's order:
 * `{ id, prefix, parent?, dependencies, origin?, events?, settings?, permissions?, configs,
 * actions, services, interceptors, kinds, code }`, where `actions`, `services` and
 * `interceptors` are the `server/` entries, `kinds[index]` the files of `kinds[index]` this file
 * imports and `code` every other source file under the module's `server/` folder.
 * `localPlugins` names every local plugin, also disabled ones. `switchedOff` lists the disabled
 * local plugins' server services (`{ prefix, services }`): they stay typed in the service map
 * through type-only references (never imported), so their own files and optional references from
 * other plugins compile; a name an enabled module holds wins.
 *
 * Package plugins have no server entries yet and stay out, so a dependency or parent naming one
 * is dropped, and so is a `configOverrides` entry for any module outside the file (the kernel
 * would refuse to boot on it; the client file still checks the whole object). A dependency or
 * parent naming a disabled local plugin stays, so the kernel refuses to start exactly as the
 * client runtime does. The server Actions are checked statically first (see
 * `serverActionsOf`); duplicates, also ones that differ only in case, are an error.
 *
 * The `stamp` hashes the file without itself plus the content of every file it imports and of
 * every source file under each module's `server/` folder, so editing a server Action, service or
 * helper there changes it and a development reload boots the new code. Code imported from
 * elsewhere (a shared `src/lib/` helper) does not move it; restart the dev server after such an
 * edit.
 *
 * Returns `{ content, exposed }`: `exposed` lists the exposed operation IDs read statically,
 * which the client file's `remote` and the kernel's missing-from-remote warning use.
 */
export async function serverHalf({
  modules,
  kinds,
  appId,
  configOverrides,
  localPlugins,
  switchedOff = [],
  endpoint,
  rateLimit,
  root,
  output,
  relativeTo,
  packageServers = [],
  publish = [],
}) {
  const hasContent =
    packageServers.length > 0 ||
    modules.some(
      (module) =>
        module.actions.length ||
        module.services.length ||
        module.interceptors.length ||
        module.installers.length ||
        kinds.some((kind, index) => kind.runtime === 'server' && module.kinds[index].length),
    );
  if (!hasContent) return null;
  const operations = [];
  const seen = new Map();
  for (const module of modules)
    for (const operation of await serverActionsOf(module.actions, {
      moduleId: module.prefix,
      relativeTo: root,
    })) {
      const key = operation.id.toLowerCase();
      if (seen.has(key))
        throw new Error(
          `Two server Actions are named "${operation.id}"${seen.get(key).id === operation.id ? '' : ` ("${seen.get(key).id}" differs only in case)`}: ${relativeTo(seen.get(key).file)} and ${relativeTo(operation.file)}. Rename one file (or record key).`,
        );
      seen.set(key, operation);
      operations.push({ ...operation, module });
    }
  const firstFile = modules
    .flatMap((module) => [
      ...module.actions,
      ...module.services,
      ...module.interceptors,
      ...module.installers,
      ...module.kinds.filter((_, index) => kinds[index].runtime === 'server').flat(),
    ])
    .map((entry) => entry.file)[0];
  await assertServerCore(
    root,
    firstFile ? relativeTo(firstFile) : `the server entry of ${packageServers[0].specifier}`,
  );

  const emitter = createEmitter(output, relativeTo, {
    typedKind: (kind) => kind.runtime === 'server',
  });
  const ids = new Set(modules.map((module) => module.id));
  const local = new Set(localPlugins.map((id) => id.toLowerCase()));
  // Package plugins are absent by design; a disabled local plugin must still fail the boot.
  const kept = (id) => ids.has(id) || local.has(id.toLowerCase());
  const lowerIds = new Set([...ids].map((id) => id.toLowerCase()));
  // Core matches override keys case-insensitively and rejects one naming a missing module.
  const serverOverrides = Object.fromEntries(
    Object.entries(configOverrides).filter(([id]) => lowerIds.has(id.toLowerCase())),
  );
  const actionTypes = [];
  const serviceTypes = [];
  // A file whose default export is one `defineService(…)` without `provides`/`exposeAs` has exactly one key, its
  // path: it is written out, so the service map's keys never wait for a file's type (a factory reading `services`
  // would otherwise reference itself). Records and aliased services keep the inferred entry.
  const serviceSources = new Map(
    await Promise.all(
      [...modules, ...switchedOff]
        .flatMap((module) => module.services.map((entry) => entry.file))
        .map(async (file) => [file, await readFile(file, 'utf8').catch(() => '')]),
    ),
  );
  const singleService = (file) => {
    const text = serviceSources.get(file) ?? '';
    return (
      /export\s+default\s+defineService\s*\(/.test(text) &&
      !/\b(?:provides|exposeAs)\s*:/.test(text)
    );
  };
  let serviceValuesUsed = false;
  let serviceEntriesUsed = false;
  let permissionsUsed = false;
  const single = (kind, file, moduleId) =>
    emitter.emit(kind, file ? [{ file, path: [] }] : [], moduleId);
  const emitModule = (module) => {
    const events = single('events', module.events, module.id);
    const settings = single('settings', module.settings, module.id);
    let permissions;
    if (module.permissions) {
      permissionsUsed = true;
      const [name] = emitter.fileEntries([{ file: module.permissions, path: [] }]);
      permissions = `discoverPermissions([${name}])`;
    }
    const config = emitter.emit('configs', module.configs, module.id);
    const serviceNames = emitter.fileEntries(module.services);
    serviceTypes.push(
      ...serviceNames.map((name, index) => {
        const entry = module.services[index];
        if (singleService(entry.file)) {
          serviceValuesUsed = true;
          const key = [module.prefix, entry.path.join('.')].filter(Boolean).join('.');
          return `{ readonly ${quote(key)}: DiscoveredServiceValue<typeof ${name}> }`;
        }
        serviceEntriesUsed = true;
        return `DiscoveredServiceEntry<typeof ${name}, ${quote(module.prefix)}>`;
      }),
    );
    const actionNames = emitter.fileEntries(module.actions);
    for (const operation of operations.filter((item) => item.module === module))
      actionTypes.push(
        `    ${quote(operation.id)}: ServerActionEntry<typeof ${actionNames[module.actions.indexOf(operation.entry)]}, ${quote(module.id)}, ${operation.exposed}${operation.key ? `, ${quote(operation.key)}` : ''}>;`,
      );
    return {
      events,
      settings,
      permissions,
      config,
      services: `discoverServices([${serviceNames.join(', ')}], ${quote(module.prefix)})`,
      actions: `discoverActions([${actionNames.join(', ')}], ${quote(module.prefix)})`,
      interceptors: emitter.emit('interceptors', module.interceptors, module.id),
      installs: emitter.emit('installers', module.installers, module.id),
      contributions: emitter.contributions(kinds, module.kinds, module.id),
      dependencies: module.dependencies.filter(kept),
    };
  };
  // Switched-off plugins' services: the same entries, through type-only references.
  const switchedOffTypes = switchedOff.flatMap((module) =>
    emitter.typeFileEntries(module.services).map((name, index) => {
      const entry = module.services[index];
      if (singleService(entry.file)) {
        serviceValuesUsed = true;
        const key = [module.prefix, entry.path.join('.')].filter(Boolean).join('.');
        return `{ readonly ${quote(key)}: DiscoveredServiceValue<${name}> }`;
      }
      serviceEntriesUsed = true;
      return `DiscoveredServiceEntry<${name}, ${quote(module.prefix)}>`;
    }),
  );
  const [app, ...plugins] = modules;
  const own = emitModule(app);
  const definitions = plugins.map((module) => {
    const parts = emitModule(module);
    const parent = module.parent && kept(module.parent) ? module.parent : undefined;
    return `withPluginOrigin({ id: ${quote(module.id)}, ${parent ? `parent: ${quote(parent)}, ` : ''}dependencies: ${quote(parts.dependencies)}, events: ${parts.events}, settings: ${parts.settings}, ${parts.permissions ? `permissions: ${parts.permissions}, ` : ''}config: ${parts.config}, services: ${parts.services}, actions: ${parts.actions}, interceptors: ${parts.interceptors}, installs: ${parts.installs}, contributions: ${parts.contributions} }, ${quote(module.origin)})`;
  });
  // Package plugins' server halves (`bitakit.server`): imported, created once, with their exposed
  // operations from the sidecar `bitakit build` wrote (the entry itself never runs here).
  const packageImports = packageServers.map(
    (item, index) => `import packageServer${index} from ${quote(item.specifier)};`,
  );
  for (const [index, item] of packageServers.entries())
    definitions.push(`withPluginOrigin(packageServer${index}(), ${quote(item.origin)})`);
  const exposed = [
    ...operations.filter((item) => item.exposed).map((item) => item.id),
    ...packageServers.flatMap((item) =>
      item.operations
        .filter((operation) => operation.exposed === true && isPublished(publish, operation.id))
        .map((operation) => operation.id),
    ),
  ];
  const twice = exposed.find((id, index) => exposed.indexOf(id) !== index);
  if (twice)
    throw new Error(
      `Two server Actions are named "${twice}" (a package and the app, or two packages).`,
    );
  const values = [
    'createServer',
    emitter.imports.some((line) => line.includes('discoveredFile(')) && 'discoveredFile',
    'discoverActions',
    'discoverServices',
    'discoverInterceptors',
    'discoverInstallers',
    'discoverConfig',
    'discoverEvents',
    'discoverSettings',
    permissionsUsed && 'discoverPermissions',
    'withPluginOrigin',
    'type ServerConfig',
    actionTypes.length && 'type ServerActionEntry',
    serviceEntriesUsed && 'type DiscoveredServiceEntry',
    serviceValuesUsed && 'type DiscoveredServiceValue',
    switchedOffTypes.length && 'type DiscoveredFile',
  ].filter(Boolean);
  const kindDeclarations = emitter.kindDeclarations();
  const source = (stamp) => `${generatedHeader}
// Server only: never import this file from browser code.
import {
${values.map((value) => `  ${value},`).join('\n')}
} from '@bitakit/core/server';
${emitter.imports.join('\n')}
${packageImports.join('\n')}

type DiscoveredServerServices = ${serviceTypes.join(' & ') || '{}'};${switchedOffTypes.length ? `\ntype SwitchedOffServerServices = ${emitter.withoutEnabled(switchedOffTypes, ['DiscoveredServerServices'])};` : ''}
${kindDeclarations ? `${kindDeclarations}\n` : ''}declare module '@bitakit/core' {
  interface ServerActionMap {${actionTypes.length ? `\n${actionTypes.join('\n')}\n  ` : ''}}
  interface ServerServiceMap extends DiscoveredServerServices${switchedOffTypes.length ? ', SwitchedOffServerServices' : ''} {}
}

/** The app's server half: every enabled local module's shared files and server/ folder. */
export function createBitaKitServerConfig() {
  const configOverrides: Record<string, Record<string, unknown>> = ${quote(serverOverrides)};
  return {
    appId: ${quote(appId)},
    dependencies: ${quote(own.dependencies)},
    config: ${own.config},
    configOverrides,
    events: ${own.events},
    settings: ${own.settings},
${own.permissions ? `    permissions: ${own.permissions},\n` : ''}    services: ${own.services},
    actions: ${own.actions},
    interceptors: ${own.interceptors},
    installs: ${own.installs},
    contributions: ${own.contributions},
    plugins: [${definitions.length ? `\n      ${definitions.join(',\n      ')}\n    ` : ''}],
  } satisfies ServerConfig;
}

/** The app's server kernel. Importing it boots nothing; the first call does. */
export const server = createServer(createBitaKitServerConfig(), {
  instance: 'bitakit',
  endpoint: ${quote(endpoint)},${rateLimit === undefined ? '' : `\n  rateLimit: ${quote(rateLimit)},`}
  stamp: ${quote(stamp)},
  operations: ${quote(exposed)},${
    publish.length
      ? `
  publish: ${quote(publish)},`
      : ''
  }
});
`;
  // Same code, same stamp, one boot; a changed server file or helper boots the new code in dev.
  const hash = createHash('sha256').update(source(''));
  for (const file of serverSources(modules)) {
    const text = await readFile(file).catch((error) => {
      // An editor can remove a file between traversal and hashing; the watcher runs again.
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    hash.update(`\0${relativeTo(file)}\0`).update(text);
  }
  const stamp = hash.digest('hex').slice(0, 16);
  return { content: source(stamp), exposed };
}

/** Every file the server file imports and every other source file under a `server/` folder. */
function serverSources(modules) {
  const sources = new Set();
  for (const module of modules) {
    for (const file of [module.events, module.settings, module.permissions])
      if (file) sources.add(file);
    for (const entry of [
      ...module.configs,
      ...module.actions,
      ...module.services,
      ...module.interceptors,
      ...module.installers,
      ...module.kinds.flat(),
    ])
      sources.add(entry.file);
    for (const file of module.code) sources.add(file);
  }
  return [...sources].sort();
}
