import type { SlotMap } from '../presentation.js';
import type { SlotPayload } from './define.js';
import type { SlotAvailability } from './types.js';

type Names = Extract<keyof SlotMap, string>;
type ActionNames = { [N in Names]: SlotMap[N] extends { accepts: 'actions' } ? N : never }[Names];
type Key<Name extends string> = Name extends Names
  ? SlotMap[Name] extends { policy: 'keyed' }
    ? { key: string }
    : { key?: string }
  : { key?: string };
type PlainNames = {
  [N in ActionNames]: SlotMap[N] extends { policy: 'keyed' } ? never : N;
}[ActionNames];
type Placement<Name extends string, Input> = {
  slot: Name;
  /** Evaluated for each outlet occurrence, never at Action registration. */
  input?: (context: { payload: Name extends Names ? SlotPayload<Name> : unknown }) => Input;
  order?: number;
  availability?: SlotAvailability;
} & Key<Name>;
/** Generated SlotMap checks names and contextual payloads. Manual apps may augment it too. */
export type ActionSlotPlacement<Input = unknown> = [Names] extends [never]
  ? string | Placement<string, Input>
  : PlainNames | { [N in ActionNames]: Placement<N, Input> }[ActionNames];

/** Runtime implementation erases consumer-generated names after public authoring checks. */
export type RuntimeActionPlacement =
  | string
  | {
      slot: string;
      input?: (context: { payload: any }) => unknown;
      order?: number;
      key?: string;
      availability?: SlotAvailability;
    };
