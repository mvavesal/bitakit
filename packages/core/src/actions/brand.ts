/**
 * Identity checks that survive duplicate package copies. A linked plugin (npm link, `file:`) or a
 * mismatched version can load a second copy of this package; `instanceof` then fails for values
 * created by the other copy. Each class marks its prototype with a global symbol instead.
 */
const brands = {
  action: Symbol.for('bitakit.core.Action'),
  group: Symbol.for('bitakit.core.ActionGroup'),
  failure: Symbol.for('bitakit.core.ActionFailure'),
  navigation: Symbol.for('bitakit.core.NavigationHost'),
} as const;
export type Brand = keyof typeof brands;

/** Marks a class prototype; subclasses inherit the marker through the prototype chain. */
export function brand(target: { prototype: object }, name: Brand) {
  Object.defineProperty(target.prototype, brands[name], { value: true });
}

let warned = false;
/** True for instances of `Class` from this copy, or branded instances from another copy. */
export function isBrandedInstance<T>(
  value: unknown,
  Class: abstract new (...args: any[]) => T,
  name: Brand,
): value is T {
  if (value instanceof Class) return true;
  if (typeof value !== 'object' || value === null || (value as any)[brands[name]] !== true)
    return false;
  if (!warned) {
    warned = true;
    console.warn(
      '[bitakit] Found a value created by a second copy of @bitakit/core. Declare @bitakit/core ' +
        'as a peerDependency in plugin packages and keep one installed version.',
    );
  }
  return true;
}

/** True when a constructor's prototype chain carries the marker, from any package copy. */
export function isBrandedClass(value: unknown, name: Brand): boolean {
  return (
    typeof value === 'function' &&
    typeof value.prototype === 'object' &&
    value.prototype !== null &&
    (value.prototype as any)[brands[name]] === true
  );
}
