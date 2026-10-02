declare const eventType: unique symbol;
/** One declared event: its payload type and whether it can be cancelled. */
export type EventSpec<Data = unknown, Cancelable extends boolean = false> = {
  readonly cancelable: Cancelable;
  readonly schema?: { parse(input: unknown): Data };
  readonly [eventType]?: Data;
};
/** `event<{ id: number }>()` or `event<{ id: number }>({ cancelable: true })`. */
export function event<Data = undefined>(options: {
  cancelable: true;
  schema?: { parse(input: unknown): Data };
}): EventSpec<Data, true>;
export function event<Data = undefined>(options?: {
  cancelable?: false;
  schema?: { parse(input: unknown): Data };
}): EventSpec<Data, false>;
export function event<Data = undefined>(options?: {
  cancelable?: boolean;
  schema?: { parse(input: unknown): Data };
}): EventSpec<Data, boolean> {
  return { cancelable: options?.cancelable ?? false, schema: options?.schema };
}

export type EventsDefinition<
  Specs extends Record<string, EventSpec<any, boolean>> = Record<string, EventSpec<any, boolean>>,
> = {
  readonly kind: 'events';
  readonly events: Specs;
};
/**
 * Declares a plugin's events in `events.ts`. Names are prefixed with the plugin ID, so
 * `changed` in plugin `todos` is emitted and observed as `todos.changed`. Only the declaring
 * plugin may emit them.
 */
export function defineEvents<const Specs extends Record<string, EventSpec<any, boolean>>>(
  events: Specs,
): EventsDefinition<Specs> {
  for (const name of Object.keys(events))
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name))
      throw new Error(
        `Invalid event name "${name}". Use letters, digits, "_" or "-" without dots.`,
      );
  return { kind: 'events', events };
}
export function isEventsDefinition(value: unknown): value is EventsDefinition {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'events';
}

type DataOf<S> = S extends EventSpec<infer Data, any> ? Data : never;
/** `EventMap` entries of one declaration under a plugin prefix. */
export type EventsOf<D, Plugin extends string> =
  D extends EventsDefinition<infer Specs>
    ? { [K in keyof Specs & string as `${Plugin}.${K}`]: DataOf<Specs[K]> }
    : {};
/** `CancelableEventMap` entries of one declaration. */
export type CancelableOf<D, Plugin extends string> =
  D extends EventsDefinition<infer Specs>
    ? {
        [K in keyof Specs & string as Specs[K] extends EventSpec<any, true>
          ? `${Plugin}.${K}`
          : never]: true;
      }
    : {};
