import type { FoundationRuntime } from '../runtime.js';
import type { FoundationApp } from './types.js';
import { FoundationServiceError } from './service-error.js';
import { createActionAccess } from './action-access.js';

/** Projects the runtime onto the app facade. Nothing is copied; every read is live. */
export function createFoundationApp(runtime: FoundationRuntime): FoundationApp {
  const extensions: Record<string, unknown> = {};
  for (const plugin of runtime.modules) {
    for (const [name, create] of Object.entries(plugin.appExtensions ?? {})) {
      if (
        Object.hasOwn(extensions, name) ||
        ['actions', 'events', 'config', 'services', 'ready', 'has'].includes(name)
      )
        throw new Error(`Duplicate app extension "${name}" in plugin "${plugin.id}".`);
      extensions[name] = create(runtime);
    }
  }
  // Before mount every service read explains that the runtime is not ready yet.
  const services = new Proxy(Object.create(null) as object, {
    get(_target, name, receiver) {
      if (typeof name !== 'string' || name === 'then' || name === 'toJSON') return undefined;
      const tree = runtime.servicesIfMounted();
      if (!tree) throw new FoundationServiceError(name, 'not-ready');
      return Reflect.get(tree as object, name, receiver);
    },
    has: (_target, name) => {
      const tree = runtime.servicesIfMounted();
      return !!tree && typeof name === 'string' && name in (tree as object);
    },
    ownKeys: () => {
      const tree = runtime.servicesIfMounted();
      return tree ? Reflect.ownKeys(tree as object) : [];
    },
    getOwnPropertyDescriptor: (_target, name) => {
      const tree = runtime.servicesIfMounted();
      return tree ? Reflect.getOwnPropertyDescriptor(tree as object, name) : undefined;
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });
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
    services,
    get ready() {
      return runtime.isReady();
    },
    has: (service: string) => runtime.hasService(service),
  }) as unknown as FoundationApp;
}
