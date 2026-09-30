import type { ActionStatus } from './state.js';
import type { PresentationType } from '../presentation.js';
import type { RegistrationOptions } from './groups.js';

export type ActionIcon = PresentationType<'icon'>;
/** The returned value becomes `value` of the completed execution result. */
export type ActionHandler<Input = unknown, Result = unknown> = (
  context: ActionContext<Input>,
) => Result | Promise<Result>;

/** Declarative keyboard binding; browser adapters own parsing, scopes and presentation. */
export type ActionShortcut<Input = unknown> = Readonly<{
  keys: string;
  scope?: string;
  allowInInputs?: boolean;
}> &
  (undefined extends Input ? { input?: Input } : { input: Input });

export interface ActionDefinition extends RegistrationOptions {
  /** Prefer namespaced IDs, e.g. "course.save". Unique within one list. */
  id: string;
  title: string;
  description?: string;
  tooltip?: string;
  shortcut?: ActionShortcut;
  variant?: 'default' | 'destructive';
  resolve?: (input: unknown) => ActionPresentation;
  icon?: ActionIcon;
  href?: string;
  enabled?: boolean;
  /** All referenced actions must be enabled. Missing actions and cycles disable this action. */
  dependsOn?: readonly string[];
  visible?: boolean;
  checked?: boolean;
  value?: unknown;
  /** Cloned for each registration; updated only through the existing snapshot store. */
  initialState?: object;
  state?: unknown;
  execute?: ActionHandler;
  /**
   * Executable and subscribable by ID, but excluded from enumeration such as `useActions()`
   * and group views. Used for helper registrations that must not surface as commands.
   */
  internal?: boolean;
  /** Opaque, immutable host metadata. The core never interprets it. */
  metadata?: unknown;
}

export type ActionPresentation = Partial<
  Pick<
    ActionDefinition,
    | 'title'
    | 'description'
    | 'tooltip'
    | 'icon'
    | 'href'
    | 'enabled'
    | 'visible'
    | 'checked'
    | 'value'
    | 'variant'
  >
>;

export type ActionPatch = Partial<Omit<ActionDefinition, 'id'>>;
export type ActionSnapshot = Readonly<
  Omit<ActionDefinition, 'enabled' | 'visible'> & {
    enabled: boolean;
    visible: boolean;
    pending: boolean;
    status: ActionStatus;
    error?: unknown;
    state: unknown;
  }
>;
export interface ActionContext<Input = unknown> {
  readonly id: string;
  /** Per-invocation input. The handler validates it; it is never stored in action state. */
  readonly input: Input;
  /** Current snapshot of this registration; undefined after removal/replacement. */
  get(): ActionSnapshot | undefined;
  /** Optional host dependency injection, owned by this list (never global). */
  readonly environment: unknown;
  /** Updates only this registration, even if the handler finishes after replacement. */
  update(patch: ActionPatch): boolean;
}
export interface ActionRegistration {
  update(patch: ActionPatch): boolean;
  /** Idempotent. Cannot remove a newer registration of the same ID. */
  unregister(): void;
}
export type ExecutionResult<Value = unknown> =
  | { status: 'completed'; value: Value }
  | {
      status: 'skipped';
      reason:
        | 'missing'
        | 'disabled'
        | 'hidden'
        | 'pending'
        | 'no-handler'
        | 'intercepted'
        | 'replaced';
    };

/**
 * Registry of known action IDs with their input and result types. Build tooling augments it
 * from discovered definitions; explicit hosts and packages may augment it themselves:
 * `declare module '@bitakit/core' { interface ActionMap { 'users.invite': { input: X; result: Y } } }`
 */
export interface ActionMap {}
/** Augment with `{ strict: true }` to reject action IDs that are not part of ActionMap. */
export interface ActionMapOptions {}
export type KnownActionId = Extract<keyof ActionMap, string>;
/** Known IDs autocomplete; unknown strings stay allowed unless strict mode is enabled. */
export type ActionId = ActionMapOptions extends { strict: true }
  ? KnownActionId
  : KnownActionId | (string & {});
export type ActionInput<Id extends string = string> = Id extends KnownActionId
  ? ActionMap[Id] extends { input: infer Input }
    ? Input
    : unknown
  : unknown;
export type ActionResult<Id extends string = string> = Id extends KnownActionId
  ? ActionMap[Id] extends { result: infer Result }
    ? Result
    : unknown
  : unknown;
