import { isServiceInterceptor, matchesTarget, type InterceptorSpec } from './define.js';

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

/**
 * Wraps service instances whose ID or alias matches an interceptor's `service` target. All
 * container consumers receive the same wrapper; frozen instances are supported.
 */
export function serviceObserver(
  interceptors: readonly InterceptorSpec[],
  namesOf: (id: string) => readonly string[],
) {
  const entries = interceptors
    .filter(isServiceInterceptor)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (id: string, instance: any, active: () => boolean): any => {
    if (!instance || (typeof instance !== 'object' && typeof instance !== 'function'))
      return instance;
    const names = [id, ...namesOf(id)];
    const selected = entries.filter((entry) =>
      names.some((name) => matchesTarget(entry.service, name)),
    );
    if (!selected.length) return instance;
    const cache = new Map<PropertyKey, { original: Function; wrapped: Function }>();
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
              notify(entry[phase] as ((event: any) => unknown) | undefined, {
                service: id,
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
