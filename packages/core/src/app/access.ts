import type { FoundationRuntime } from '../runtime.js';
import type { FoundationApp } from './types.js';
import { FoundationServiceError } from './service-error.js';
import { createActionAccess } from './action-access.js';
import { FoundationStartupError, moduleLabel } from '../startup-error.js';

type Source = { key: string; plugin: string };
type Branch = Map<string, Branch | Source>;

/** Projects public service paths onto the existing container, with no cached instances. */
export function createFoundationApp(runtime: FoundationRuntime): FoundationApp {
  const tree: Branch = new Map();
  const appId = runtime.modules[0]?.id ?? '@foundation/app';
  for (const plugin of runtime.modules) {
    for (const [name, key] of Object.entries(plugin.publicServices ?? {})) {
      const segments = name.split('.');
      let branch = tree;
      for (const [index, segment] of segments.entries()) {
        const existing = branch.get(segment);
        if (
          !segment ||
          ['then', 'toJSON', '__proto__'].includes(segment) ||
          (existing && (!(existing instanceof Map) || index === segments.length - 1))
        )
          throw conflict(name, segments.slice(0, index + 1).join('.'), plugin.id, existing, appId);
        if (index === segments.length - 1) branch.set(segment, { key, plugin: plugin.id });
        else {
          if (!existing) branch.set(segment, new Map());
          branch = branch.get(segment) as Branch;
        }
      }
    }
  }
  const read = (name: string, source: Source, optional: boolean) => {
    if (!runtime.isReady()) {
      if (optional) return undefined;
      throw new FoundationServiceError(name, 'not-ready', source.plugin);
    }
    if (!Object.hasOwn(runtime.services, source.key)) {
      if (optional) return undefined;
      throw new FoundationServiceError(name, 'missing', source.plugin);
    }
    return (runtime.services as Record<string, unknown>)[source.key];
  };
  const project = (branch: Branch, optional: boolean, prefix = ''): object => {
    const target = Object.create(null);
    for (const [segment, source] of branch) {
      const name = prefix ? `${prefix}.${segment}` : segment;
      Object.defineProperty(
        target,
        segment,
        source instanceof Map
          ? { enumerable: true, value: project(source, optional, name) }
          : { enumerable: true, get: () => read(name, source, optional) },
      );
    }
    return new Proxy(Object.freeze(target), {
      get(target, name, receiver) {
        if (Object.hasOwn(target, name)) return Reflect.get(target, name, receiver);
        if (typeof name === 'symbol' || name === 'then' || name === 'toJSON' || optional)
          return undefined;
        throw new FoundationServiceError(prefix ? `${prefix}.${name}` : name, 'unregistered');
      },
    });
  };
  const extensions: Record<string, unknown> = {};
  for (const plugin of runtime.modules) {
    for (const [name, create] of Object.entries(plugin.appExtensions ?? {})) {
      if (
        Object.hasOwn(extensions, name) ||
        ['actions', 'events', 'config', 'services', 'ready', 'optional'].includes(name)
      )
        throw new Error(`Duplicate app extension "${name}" in plugin "${plugin.id}".`);
      extensions[name] = create(runtime);
    }
  }
  return Object.freeze({
    ...extensions,
    events: runtime.events,
    actions: createActionAccess(runtime.actions),
    get config() {
      return Object.freeze(
        Object.fromEntries(
          runtime.modules.map((module) => [
            module.id,
            runtime.configuration.plugin(module.id).snapshot(),
          ]),
        ),
      );
    },
    services: project(tree, false),
    get ready() {
      return runtime.isReady();
    },
    optional: Object.freeze({ services: project(tree, true) }),
  }) as unknown as FoundationApp;
}

/** Explains a public service name that cannot be added, with the usual fix. */
function conflict(
  name: string,
  at: string,
  plugin: string,
  existing: Branch | Source | undefined,
  appId: string,
) {
  const label = (module: string) => moduleLabel(module, appId);
  const choose = 'Choose a different exposeAs.';
  let message: string;
  if (existing && !(existing instanceof Map) && at === name) {
    const fix = `Rename one of the service files, or set exposeAs in one of them (for example exposeAs: '${plugin === appId ? 'app' : plugin}.${name}').`;
    const first = existing.plugin;
    message =
      first === plugin
        ? `${capitalize(label(plugin))} exposes two services named "${name}". ${fix}`
        : first !== appId && plugin !== appId
          ? `Plugins "${first}" and "${plugin}" both expose a service named "${name}". ${fix}`
          : `${capitalize(label(first))} and ${label(plugin)} both expose a service named "${name}". ${fix}`;
  } else if (existing && !(existing instanceof Map))
    message = `Service name "${name}" in ${label(plugin)} is nested under "${at}", which is already a service in ${label(existing.plugin)}. ${choose}`;
  else if (existing)
    message = `Service name "${name}" in ${label(plugin)} is already used as a service namespace. ${choose}`;
  else
    message = `Service name "${name}" in ${label(plugin)} is empty or uses a reserved segment (then, toJSON, __proto__). ${choose}`;
  return new FoundationStartupError(message, plugin, { app: plugin === appId });
}
function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
