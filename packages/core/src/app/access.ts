import type { BitaKitRuntime } from '../runtime.js';
import type { BitaKitApp } from './types.js';
import { BitaKitServiceError } from './service-error.js';
import { createActionAccess } from './action-access.js';

/** Projects the runtime onto the app facade. Nothing is copied; every read is live. */
export function createBitaKitApp(runtime: BitaKitRuntime): BitaKitApp {
  // Before mount every service read explains that the runtime is not ready yet.
  const services = new Proxy(Object.create(null) as object, {
    get(_target, name, receiver) {
      if (typeof name !== 'string' || name === 'then' || name === 'toJSON') return undefined;
      const tree = runtime.servicesIfMounted();
      if (!tree) throw new BitaKitServiceError(name, 'not-ready');
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
    settings: runtime.settingsAccess,
    get ready() {
      return runtime.isReady();
    },
    has: (service: string) => runtime.isServiceReady(service),
  }) as unknown as BitaKitApp;
}
