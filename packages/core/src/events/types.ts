import type { NamedValue, NameKey } from '../name-resolution.js';
import type { GeneratedName, CheckedName } from '../names.js';

/** Event names and payloads. Generated from every plugin's `events.ts`; may also be augmented by hand. */
export interface EventMap {}
/** Events whose `emit` waits for the handlers and returns whether none cancelled. */
export interface CancelableEventMap {}

export type KnownEventName = Extract<keyof EventMap, string>;
/** A declared event name; strict generated apps reject unknown names. */
export type EventName = GeneratedName<KnownEventName>;
type PatternOf<Name extends string> = Name extends `${infer Prefix}.${string}`
  ? `${Prefix}.*`
  : never;
/** What a listener selects: an event, a `<prefix>.*` pattern of declared events, or `*`. */
export type EventSelector = EventName | PatternOf<KnownEventName> | '*';
export type EventData<Name extends string> = NamedValue<EventMap, Name>;
/** `todos.*` matches every declared `todos.<name>` event. */
type MatchingPrefix<Prefix extends string> = {
  [K in KnownEventName]: K extends `${infer Owner}.${string}`
    ? Lowercase<Owner> extends Lowercase<Prefix>
      ? K
      : never
    : never;
}[KnownEventName];
export type EventsMatching<Pattern extends string> = Pattern extends unknown
  ? Pattern extends `${infer Prefix}.*`
    ? [MatchingPrefix<Prefix>] extends [never]
      ? string
      : MatchingPrefix<Prefix>
    : [NameKey<EventMap, Pattern>] extends [never]
      ? Pattern
      : NameKey<EventMap, Pattern>
  : never;

export type BitaKitEvent<Name extends string = string> = Name extends string
  ? Readonly<{
      type: Name;
      data: EventData<Name>;
      /** Present on cancelable events: stops the operation that asked. */
      cancel?: (reason?: string) => void;
      cancelled?: boolean;
    }>
  : never;
export type EventHandler<Name extends string = string> = (
  event: BitaKitEvent<EventsMatching<Name>>,
  context: { signal: AbortSignal },
) => void | Promise<void>;
export type EventErrorHandler = (error: unknown, event: BitaKitEvent) => void;
export type EmitResult<Name extends string> = [NameKey<CancelableEventMap, Name>] extends [never]
  ? void
  : NameKey<CancelableEventMap, Name> extends keyof CancelableEventMap
    ? Promise<boolean>
    : void;
type EmitArguments<Name extends string> =
  undefined extends EventData<Name> ? [data?: EventData<Name>] : [data: EventData<Name>];

export interface Events {
  /** Each matching event invokes the handler once. Returns the unsubscribe function. */
  on<const Name extends string>(
    names:
      | (Name & CheckedName<Name, KnownEventName | PatternOf<KnownEventName> | '*'>)
      | readonly (Name & CheckedName<Name, KnownEventName | PatternOf<KnownEventName> | '*'>)[],
    handler: EventHandler<Name>,
  ): () => void;
  /**
   * Synchronous delivery; async handlers are observed for errors, not awaited. A cancelable
   * event waits for its handlers and resolves to false when one of them cancelled.
   */
  emit<Name extends string>(
    name: Name & CheckedName<Name, KnownEventName>,
    ...data: EmitArguments<Name>
  ): EmitResult<Name>;
}
