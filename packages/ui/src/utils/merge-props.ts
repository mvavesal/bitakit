/**
 * Merges generated control props into a child's own props: event handlers are chained (the
 * child's first), class names are joined, `style` objects are spread, `disabled` is OR-ed and
 * every other explicit child prop wins.
 */
export function mergeProps<T extends Record<string, unknown>>(
  generated: Record<string, unknown>,
  own: T,
): T & Record<string, unknown> {
  const result: Record<string, unknown> = { ...generated };
  for (const [key, value] of Object.entries(own)) {
    const existing = result[key];
    if (value === undefined) continue;
    if (/^on[A-Z]/.test(key) && typeof existing === 'function' && typeof value === 'function') {
      result[key] = (...args: unknown[]) => {
        (value as (...args: unknown[]) => unknown)(...args);
        const event = args[0] as { defaultPrevented?: boolean } | undefined;
        if (!event || !event.defaultPrevented)
          (existing as (...args: unknown[]) => unknown)(...args);
      };
    } else if (key === 'className' && typeof existing === 'string' && typeof value === 'string')
      result[key] = `${existing} ${value}`.trim();
    else if (
      key === 'style' &&
      existing &&
      value &&
      typeof existing === 'object' &&
      typeof value === 'object'
    )
      result[key] = { ...(existing as object), ...(value as object) };
    else if (key === 'disabled') result[key] = Boolean(existing) || Boolean(value);
    else result[key] = value;
  }
  return result as T & Record<string, unknown>;
}

/** True when two values are the same or are arrays/plain objects with identical entries. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
