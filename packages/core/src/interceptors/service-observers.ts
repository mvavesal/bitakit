import type { Plugin } from '../definitions.js';
import { isServiceInterceptor } from './service.js';

/** Observer errors are isolated from business execution, as with Action lifecycle observers. */
function notify(callback: ((event: any) => unknown) | undefined, event: object) {
  try {
    const result = callback?.(Object.freeze(event));
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      void Promise.resolve(result).catch(() => {});
  } catch {
    /* Observation must not change the service outcome. */
  }
}

/** Creates a runtime-local projection; all container consumers receive the same service wrapper. */
export function serviceObserver(modules: readonly Plugin[]) {
  const aliases = new Map(modules.flatMap((module) => Object.entries(module.publicServices ?? {})));
  const entries = modules
    .flatMap((module) => (module.interceptors ?? []).filter(isServiceInterceptor))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (id: string, instance: any, active: () => boolean): any => {
    const selected = entries.filter(
      (entry) => (aliases.get(entry.service) ?? entry.service) === id,
    );
    if (!selected.length) return instance;
    const cache = new Map<PropertyKey, { original: Function; wrapped: Function }>();
    // A forwarding shell also supports frozen service objects without mutating their methods.
    return new Proxy(Object.create(Object.getPrototypeOf(instance)), {
      has: (_target, key) => key in instance,
      ownKeys: () => Reflect.ownKeys(instance),
      getOwnPropertyDescriptor: (_target, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(instance, key);
        return descriptor ? { ...descriptor, configurable: true } : undefined;
      },
      set: (_target, key, value) => Reflect.set(instance, key, value, instance),
      defineProperty: () => false,
      deleteProperty: (_target, key) => Reflect.deleteProperty(instance, key),
      preventExtensions: () => false,
      get(_target, key) {
        const target = instance;
        const value = Reflect.get(target, key, target);
        if (typeof value !== 'function' || key === 'constructor') return value;
        if (cache.get(key)?.original === value) return cache.get(key)!.wrapped;
        const observers =
          typeof key === 'string'
            ? selected.filter((entry) => entry.method === undefined || entry.method === key)
            : [];
        const wrapped = (...args: unknown[]) => {
          const emit = (phase: 'before' | 'after' | 'onError', extra = {}) => {
            if (!active()) return;
            for (const entry of observers)
              notify(entry[phase], {
                service: entry.service,
                method: key,
                args: Object.freeze([...args]),
                ...extra,
              });
          };
          emit('before');
          let result;
          try {
            result = Reflect.apply(value, target, args);
          } catch (error) {
            emit('onError', { error });
            throw error;
          }
          if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
            // Observe settlement without replacing the original Promise or changing sync methods.
            void Promise.resolve(result).then(
              (value) => emit('after', { result: value }),
              (error) => emit('onError', { error }),
            );
          } else emit('after', { result });
          return result;
        };
        cache.set(key, { original: value, wrapped });
        return wrapped;
      },
    });
  };
}
