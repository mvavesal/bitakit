/** Extend this interface with application event names and payloads. */
export interface EventMap {}
export type EventName = Extract<keyof EventMap, string> | (string & {});
export type EventData<Name extends string> = Name extends keyof EventMap ? EventMap[Name] : unknown;
export type FoundationEvent<Name extends string = string> = Name extends string
  ? Readonly<{ type: Name; data: EventData<Name> }>
  : never;
export type EventHandler<Name extends string = string> = (
  event: FoundationEvent<Name>,
  context: { signal: AbortSignal },
) => void | Promise<void>;
export type EventErrorHandler = (error: unknown, event: FoundationEvent) => void;
export interface Events {
  /** Each matching event invokes the handler once. Returns an optional early unsubscribe. */
  watch<const Name extends EventName>(
    names: Name | readonly Name[],
    handler: EventHandler<Name>,
  ): () => void;
  /** Synchronous delivery; promises are observed for errors, not awaited. */
  emit<Name extends EventName>(
    name: Name,
    ...data: undefined extends EventData<Name> ? [data?: EventData<Name>] : [data: EventData<Name>]
  ): void;
}
