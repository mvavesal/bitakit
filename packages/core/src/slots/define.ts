import type { InputSchema, SchemaOutput, EffectiveActionId } from '../definitions.js';
import type { SlotMap } from '../presentation.js';

/**
 * `list`: every contribution renders, sorted by `order`. `single`: a replaceable part; several
 * contributors may offer a candidate and outlets render the one `selectSingle` picks, or the
 * owner's fallback. `keyed`: contributions need unique keys and an outlet picks one by key.
 */
export type SlotPolicy = 'list' | 'single' | 'keyed';
/** Payload is supplied by the owner; schema describes contributed data, not UI. */
export type SlotOptions = {
  id?: string;
  policy?: SlotPolicy;
  payload?: InputSchema<any>;
} & (
  | { accepts: 'actions' | 'component'; schema?: never }
  | { accepts: 'data'; schema: InputSchema<any> }
);
export type SlotDefinition = Readonly<
  SlotOptions & {
    kind: 'slot';
    policy: SlotPolicy;
    /** Duplicate declarations, single occupants and duplicate keys never silently replace. */
    conflict: 'error';
  }
>;
export type SlotDefinitions = Readonly<{ [name: string]: SlotDefinition | SlotDefinitions }>;
export type ResolvedSlotDefinition = SlotDefinition & { readonly id: string };
export type OwnedSlotDefinition = ResolvedSlotDefinition & { readonly plugin: string };

/** Declares a headless extension point. Attachment and rendering are separate operations. */
export function defineSlot<const T extends SlotOptions>(
  options: T,
): Readonly<
  T & {
    kind: 'slot';
    policy: T extends { policy: infer P } ? P : 'list';
    conflict: 'error';
  }
> {
  return Object.freeze({
    ...options,
    kind: 'slot',
    policy: options.policy ?? 'list',
    conflict: 'error',
  }) as never;
}
export function isSlotDefinition(value: unknown): value is SlotDefinition {
  return !!value && typeof value === 'object' && (value as SlotDefinition).kind === 'slot';
}

/** Accept a generated name or a definition directly (manual composition needs no augmentation). */
type DefinitionOf<T> = T extends keyof SlotMap ? SlotMap[T] : T;
export type SlotPayload<T> =
  DefinitionOf<T> extends { payload: infer S } ? SchemaOutput<S> : undefined;
export type SlotData<T> =
  DefinitionOf<T> extends { accepts: 'data'; schema: infer S } ? SchemaOutput<S> : never;
export type SlotEntry<T, Path extends string> = T extends SlotDefinition
  ? { readonly [K in EffectiveActionId<T, Path>]: T }
  : {};
