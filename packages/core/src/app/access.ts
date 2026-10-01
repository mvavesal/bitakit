import type { FoundationRuntime } from '../runtime.js';
import type { FoundationApp } from './types.js';
import { FoundationServiceError } from './service-error.js';
import { createActionAccess } from './action-access.js';

type Source = { key: string; plugin: string };
type Branch = Map<string, Branch | Source>;

/** Projects public service paths onto the existing container, with no cached instances. */
export function createFoundationApp(runtime: FoundationRuntime): FoundationApp {
  const tree: Branch = new Map();
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
        ) {
          const owner =
            existing && !(existing instanceof Map)
              ? ` (already exposed by "${existing.plugin}")`
              : '';
          throw new Error(
            `Duplicate or reserved public service path "${name}" in plugin "${plugin.id}"${owner}.`,
          );
        }
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
