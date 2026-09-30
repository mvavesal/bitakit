/** Where a declarative value came from (a discovered file or a module), for actionable errors. */
const origins = new WeakMap<object, string>();
export function setOrigin<T>(value: T, origin: string): T {
  if (value && typeof value === 'object') origins.set(value, origin);
  return value;
}
export function originOf(value: unknown, fallback: string): string {
  return (value !== null && typeof value === 'object' && origins.get(value)) || fallback;
}
