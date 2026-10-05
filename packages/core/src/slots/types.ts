import type { PresentationType, SlotMap, SlotName } from '../presentation.js';
import type { LifecycleFailure, LifecyclePhase } from '../lifecycle/state.js';
import type { SlotPayload, SlotData } from './define.js';
import type { ActionId } from '../actions/core.js';

export type SlotPredicate<Name extends string = string> = (context: {
  payload: Name extends keyof SlotMap ? SlotPayload<Name> : any;
}) => boolean;

export type SlotAvailability = 'require' | 'wait';
export type SlotContent =
  | { component: PresentationType<'component'>; data?: never; actionId?: never; input?: never }
  | { data: unknown; component?: never; actionId?: never; input?: never }
  | {
      actionId: ActionId;
      input?: (context: { payload: any }) => unknown;
      component?: never;
      data?: never;
    };
type ContentFor<Name extends string> = Name extends keyof SlotMap
  ? SlotMap[Name] extends { accepts: 'data' }
    ? { data: SlotData<Name>; component?: never; actionId?: never; input?: never }
    : SlotMap[Name] extends { accepts: 'actions' }
      ? {
          actionId: ActionId;
          input?: (context: { payload: import('./define.js').SlotPayload<Name> }) => unknown;
          component?: never;
          data?: never;
        }
      : SlotMap[Name] extends { accepts: 'component' }
        ? {
            component: PresentationType<'component'>;
            data?: never;
            actionId?: never;
            input?: never;
          }
        : SlotContent
  : SlotContent;
/** IDs are local to the contributor. Keys select an occupant in a keyed slot. */
export type SlotContribution<Name extends string = string> = ContentFor<Name> & {
  id?: string;
  order?: number;
  /** Pure per-outlet presentation filter; never changes shared attachment state. */
  when?: SlotPredicate<Name>;
} & (Name extends keyof SlotMap
    ? SlotMap[Name] extends { policy: 'keyed' }
      ? { key: string }
      : { key?: string }
    : { key?: string });
export type SlotItem = Readonly<
  SlotContent & {
    when?: SlotPredicate;
    id: string;
    plugin: string;
    key?: string;
    order: number;
    generation: number;
  }
>;
export type SlotSnapshot = Readonly<{
  id: string;
  plugin: string;
  generation: number;
  phase: LifecyclePhase;
  failure?: LifecycleFailure;
  items: readonly SlotItem[];
}>;
export type SlotAttachmentSnapshot = Readonly<{
  id: string;
  slot: string;
  plugin: string;
  generation: number;
  phase: 'pending' | 'attached' | 'detached' | 'failed';
  reason?: 'owner-unavailable' | 'contributor-unavailable' | 'action-unavailable' | 'validating';
  failure?: LifecycleFailure;
}>;
export type SlotAttachment = Readonly<{
  get(): SlotAttachmentSnapshot;
  subscribe(listener: (state: SlotAttachmentSnapshot) => void): () => void;
  watch(listener: (state: SlotAttachmentSnapshot) => void): () => void;
  /** First successful attachment only; later transitions are observed through watch. */
  ready: Promise<void>;
  dispose(): void;
}>;
export type SlotReader = Readonly<{
  has(name: string): boolean;
  get(name: SlotName): SlotSnapshot;
  subscribe(name: SlotName, listener: (state: SlotSnapshot) => void): () => void;
  watch(name: SlotName, listener: (state: SlotSnapshot) => void): () => void;
}>;
export type ScopedSlots = SlotReader & {
  attach<const Name extends SlotName>(
    name: Name,
    contribution: SlotContribution<Name>,
    options?: { availability?: SlotAvailability },
  ): SlotAttachment;
};
