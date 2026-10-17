import type { Events } from './events/types.js';
import type { EventsDefinition } from './events/define.js';
import type { Store } from './store.js';
import type { ConfigContext, ConfigValues, ConfigDefinition } from './config-service.js';
import type { SettingsAccess } from './settings/access.js';
import type { SettingsDefinition, SettingsSectionOptions } from './settings/define.js';
import type { PresentationType } from './presentation.js';
import type {
  ActionContext,
  ActionShortcut,
  ActionGroup,
  ActionPresentation,
} from '@bitakit/core/actions';
import type { PluginScope } from './scope.js';
import type { Feedback, MessageValues } from './actions/feedback.js';
import type { BitaKitApp, Namespace } from './app/types.js';
import type { ServiceKey } from './service-key.js';
import type { InterceptorSpec } from './interceptors/define.js';
import type { Confirmation } from './confirmation.js';
import type { Cleanup } from './lifecycle/cleanup.js';
import type { SlotDefinition, SlotDefinitions } from './slots/define.js';

/** Service IDs and aliases with their instance types. Generated from discovery; augmentable by hand. */
export interface ServiceMap {}
/** What every contribution sees as `services`: `services.<plugin>.<name>`, plus contract aliases. */
export type Services = Namespace<ServiceMap>;
export type Translator = ((key: string, values?: MessageValues) => string) & {
  has?: (key: string) => boolean;
};

// ---------------------------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------------------------

export type ServiceContext = {
  services: Services;
  config: ConfigContext;
  events: Events;
  /** Typed setting handles: `settings.todos.pageSize.get()`. */
  settings: SettingsAccess;
  /** Observable state; actions and `useServiceState` follow it automatically. */
  store<T>(initial: T): Store<T>;
  /** Awaited in dependency order before the app is ready. */
  onStart(hook: (context: { signal: AbortSignal }) => void | Promise<void>): void;
  /** Awaited when the runtime stops, in reverse dependency/registration order. */
  onStop(hook: () => void | Promise<void>): void;
};
export type ServiceOptions = {
  /** Optional explicit ID; otherwise discovery derives `<plugin>.<file>`. */
  id?: string;
  /** Services this one needs inside `create`; also an explicit startup check. */
  requires?: readonly string[];
  /** Registers the instance under a shared contract key as well, such as `auth`. */
  provides?: ServiceKey<any>;
  /** An extra flat alias in `services`; use sparingly. */
  exposeAs?: string;
};
export type ServiceDefinition<T = unknown> = ServiceOptions & {
  readonly kind: 'service';
  create(context: ServiceContext): T;
};
/** The instance type a contract key demands. */
type ContractOf<Key> = Key extends ServiceKey<infer Contract, string> ? Contract : unknown;
/**
 * With `provides`, the factory's instance must satisfy the contract; the constraint is checked
 * after inference, so a destructured context parameter still infers the instance type.
 */
export function defineService<
  const Options extends ServiceOptions & { provides: ServiceKey<any> },
  T extends ContractOf<Options['provides']>,
>(create: (context: ServiceContext) => T, options: Options): ServiceDefinition<T> & Options;
export function defineService<
  T,
  const Options extends ServiceOptions & { provides?: undefined } = {},
>(create: (context: ServiceContext) => T, options?: Options): ServiceDefinition<T> & Options;
export function defineService<T>(
  create: (context: ServiceContext) => T,
  options: ServiceOptions = {},
): ServiceDefinition<T> {
  if (typeof create !== 'function')
    throw new Error(
      'defineService expects a factory function: defineService((context) => instance).',
    );
  return { ...options, kind: 'service', create };
}
export function isServiceDefinition(value: unknown): value is ServiceDefinition {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'service';
}

// ---------------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------------

/**
 * What presentation functions and `confirm` receive. Menus, search, group items and slot
 * placements without an input mapping evaluate them without input, so `input` may be undefined;
 * they also see the raw value before schema validation. Only `execute` receives the parsed input.
 */
export type PresentationContext<Input = unknown> = {
  input: Input | undefined;
  services: Services;
  config: ConfigContext;
  settings: SettingsAccess;
  app: BitaKitApp;
};
/** A value, or a function of the current input and services; functions re-run on service changes. */
export type Dynamic<Input, Value> = Value | ((context: PresentationContext<Input>) => Value);
export type ExecuteContext<Input = unknown> = ActionContext<Input> & {
  services: Services;
  config: ConfigContext;
  settings: SettingsAccess;
  app: BitaKitApp;
  events: Events;
  /** Aborts when the registration is disposed, or when a newer `latest` run supersedes this one. */
  signal: AbortSignal;
};
export type Concurrency = 'exclusive' | 'per-input' | 'latest';
export type DialogSpec = {
  component: PresentationType<'component'>;
  /**
   * A frame the host registered under `dialogs`. Built in: `dialog` (the default) and `command`,
   * a search palette whose content leads with its own search field.
   */
  kind?: string;
  size?: 'default' | 'wide';
};
/** The dialog of an action in object form, whichever way it was declared. */
export function dialogOf(
  spec: Pick<ActionSpecInput<any, any>, 'dialog' | 'dialogSize'>,
): DialogSpec | undefined {
  const dialog = spec.dialog;
  if (!dialog) return undefined;
  if (typeof dialog === 'object' && dialog !== null && 'component' in dialog)
    return { size: spec.dialogSize, ...(dialog as DialogSpec) };
  return { component: dialog as PresentationType<'component'>, size: spec.dialogSize };
}
/** zod, valibot and friends: `parse`, or Standard Schema `~standard.validate`. */
export type InputSchema<T> =
  | { parse(input: unknown): T }
  | {
      '~standard': {
        validate(
          input: unknown,
        ):
          | { value: T }
          | { issues: readonly { message: string }[] }
          | Promise<{ value: T } | { issues: readonly { message: string }[] }>;
      };
    };
export type SchemaOutput<S> = S extends { parse(input: unknown): infer T }
  ? T
  : S extends { '~standard': { validate(input: unknown): infer R } }
    ? Extract<Awaited<R>, { value: unknown }>['value']
    : never;

export type ActionSpecInput<Input = unknown, Result = unknown> = {
  /** Manual composition only; discovery derives `<plugin>.<file>`. */
  id?: string;
  /** A literal or a translation key. The `<id>.title` key wins when the catalog has it. */
  title?: Dynamic<Input, string>;
  description?: Dynamic<Input, string | undefined>;
  tooltip?: Dynamic<Input, string | undefined>;
  /** Static: a component value cannot be told apart from a presentation function. */
  icon?: PresentationType<'icon'>;
  variant?: Dynamic<Input, 'default' | 'destructive' | undefined>;
  /** A navigation action: rendered as a link, executed as navigation. */
  href?: Dynamic<Input, string | undefined>;
  enabled?: Dynamic<Input, boolean>;
  visible?: Dynamic<Input, boolean>;
  checked?: Dynamic<Input, boolean | undefined>;
  /** `{} | null | undefined` instead of `unknown`, so a function here keeps its contextual types. */
  value?: Dynamic<Input, {} | null | undefined>;
  groups?: readonly (string | ActionGroup)[];
  /** Explicit UI placements; groups remain logical membership. */
  slots?: readonly import('./slots/action-placement.js').ActionSlotPlacement<Input>[];
  order?: number;
  dividerBefore?: boolean;
  shortcut?: ActionShortcut<Input>;
  /** Validates and types the input. */
  input?: InputSchema<Input>;
  /** Services from other plugins this action uses; an explicit startup check. */
  requires?: readonly string[];
  /** `exclusive` skips while running, `per-input` tracks each input, `latest` aborts the previous run. */
  concurrency?: Concurrency;
  /** Key for `per-input` pending when the input is not a primitive. */
  concurrencyKey?: (input: Input) => string;
  /** Ask before running; declining skips with reason "cancelled". */
  confirm?: Dynamic<Input, Confirmation | string | false | undefined>;
  /**
   * Opens this component in the host dialog instead of running `execute`. The object form
   * names the host frame (`kind`, for example `sheet`) and the size; the host decides the look.
   */
  dialog?: PresentationType<'component'> | DialogSpec;
  /** @deprecated Use `dialog: { component, size }`. */
  dialogSize?: 'default' | 'wide';
  execute?: (context: ExecuteContext<Input>) => Result | Promise<Result>;
  success?: Feedback<{ result: Awaited<Result>; input: Input; services: Services }>;
  failure?: Feedback<{ error: unknown; input: Input; services: Services }>;
  /** Executable by ID but excluded from menus, search and enumeration. */
  internal?: boolean;
  /** Opaque host metadata; Core never interprets it. */
  metadata?: unknown;
};
export type ActionSpec<Input = unknown, Result = unknown> = ActionSpecInput<Input, Result> & {
  readonly kind: 'action';
};
/**
 * The one way to define an action. Pass an `input` schema to infer the input type, or name it
 * explicitly: `defineAction<string>({ ... })`.
 */
export function defineAction<S extends InputSchema<any>, Result = unknown>(
  spec: ActionSpecInput<SchemaOutput<S>, Result> & { input: S },
): ActionSpec<SchemaOutput<S>, Result>;
export function defineAction<Input = unknown, Result = unknown>(
  spec: ActionSpecInput<Input, Result> & { input?: undefined },
): ActionSpec<Input, Result>;
export function defineAction(spec: ActionSpecInput<any, any>): ActionSpec<any, any> {
  if (!spec || typeof spec !== 'object') throw new Error('defineAction expects an object.');
  if (spec.dialog && spec.execute)
    throw new Error(
      'An action opens a dialog or runs execute, not both. Run logic from inside the dialog.',
    );
  return { ...spec, kind: 'action' };
}
export function isActionSpec(value: unknown): value is ActionSpec {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'action';
}

// ---------------------------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------------------------

/** `scope` is the plugin's own scope (slots, groups, cleanup); `app` always means the whole application. */
export type Setup = (context: { scope: PluginScope; services: Services }) => void | Cleanup;
/** A component placed in a named slot of a layout. */
export type PluginView = {
  slot: string;
  component: PresentationType<'component'>;
  order?: number;
  id?: string;
  key?: string;
  availability?: import('./slots/types.js').SlotAvailability;
  when?: import('./slots/types.js').SlotPredicate;
};
export type PluginPageDefinition = {
  path: string;
  component: PresentationType<'component'>;
  /** Layout name; `app` by default, `blank` for none. */
  layout?: string;
};
/** Ordered outside-in. Dependencies must already appear before this provider. */
export type ProviderDefinition = {
  id: string;
  component: PresentationType<'provider'>;
  requires?: readonly string[];
};
/** `ui/settings/page.tsx`: replaces the generated settings page of the plugin. */
export type PluginSettingsPage = {
  /** Wraps the entire page, including extension outlets, in the owner's access boundary. */
  boundary?: PresentationType<'component'>;
  /** False when the page renders its own shared PageHeader. */
  showHeader?: boolean;
  component?: PresentationType<'component'>;
  /** Additional independently addressable pages, rendered by the existing settings host. */
  pages?: readonly (SettingsSectionOptions & {
    id: string;
    showHeader?: boolean;
    boundary?: PresentationType<'component'>;
    component: PresentationType<'component'>;
  })[];
};
export type PluginUI = {
  pages?: readonly PluginPageDefinition[];
  slots?: readonly PluginView[];
  providers?: readonly ProviderDefinition[];
  settings?: PluginSettingsPage;
  /** App only: `src/layouts/<name>.tsx`; pages choose one with `export const layout = '<name>'`. */
  layouts?: Readonly<Record<string, PresentationType<'component'>>>;
};
/** Public display information only; package authors remain the source of truth. */
export type PluginMetadata = {
  coverImage?: string;
  /** Catalog labels; presentation only, never permissions or dependencies. */
  tags?: readonly string[];
  icon?: PresentationType<'icon'>;
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  homepage?: string;
  bugs?: string | { url?: string; email?: string };
  license?: string;
};
/** Contribution kinds provided by optional integrations, keyed by kind name. */
export interface ContributionMap {}
export type ContributionSet = {
  readonly [K in keyof ContributionMap]?: readonly ContributionMap[K][];
} & { readonly [kind: string]: readonly unknown[] | undefined };
export type ContributionContext = { module: string; app: boolean; services: Services };
export type ContributionInstaller<T = unknown> = (
  values: readonly T[],
  context: ContributionContext,
) => void | Cleanup;
export type ContributionInstallers = {
  readonly [K in keyof ContributionMap]?: ContributionInstaller<ContributionMap[K]>;
} & { readonly [kind: string]: ContributionInstaller<any> | undefined };

/** Services and actions may be records keyed by name (IDs become `<plugin>.<name>`) or arrays with IDs. */
export type Plugin = {
  id: string;
  dependencies?: readonly string[];
  /**
   * The plugin that owns this one; discovery sets it for a nested plugin folder. It counts as a
   * dependency, so the parent starts first. Disabling or removing the parent always includes its
   * descendants; disabling this plugin never affects the parent.
   */
  parent?: string;
  metadata?: PluginMetadata;
  services?: readonly ServiceDefinition<any>[] | Readonly<Record<string, ServiceDefinition<any>>>;
  actions?: readonly ActionSpec<any, any>[] | Readonly<Record<string, ActionSpec<any, any>>>;
  /** Owned declarations; `ui.slots` contains components contributed to a target. */
  slots?: SlotDefinitions | readonly SlotDefinition[];
  events?: EventsDefinition<any>;
  settings?: SettingsDefinition<any>;
  config?: ConfigValues | ConfigDefinition;
  interceptors?: readonly InterceptorSpec[];
  setup?: Setup;
  ui?: PluginUI;
  /** Declarative values for installers provided by integrations. */
  contributions?: ContributionSet;
  /** Installers for contribution kinds this module owns. One module per kind. */
  installs?: ContributionInstallers;
};
export function definePlugin<const T extends Plugin>(plugin: T): T {
  if (!plugin || typeof plugin.id !== 'string' || !plugin.id)
    throw new Error('definePlugin needs an id, for example definePlugin({ id: "todos", ... }).');
  return plugin;
}

export type BitaKitRuntimeConfig = Omit<Plugin, 'id' | 'dependencies' | 'parent'> & {
  appId?: string;
  dependencies?: readonly string[];
  /** Receives synchronous throws and async rejections from event handlers. */
  onEventError?: import('./events/types.js').EventErrorHandler;
  configOverrides?: Readonly<Record<string, ConfigValues>>;
  groups?: readonly string[];
  actionOverrides?: Readonly<Record<string, { enabled?: boolean; visible?: boolean }>>;
  plugins?: readonly Plugin[];
};

// ---------------------------------------------------------------------------------------------
// Type helpers for generated declarations
// ---------------------------------------------------------------------------------------------

/** A literal string wins; a widened `string` or a missing value falls back. */
type LiteralOr<Value, Fallback> = [NonNullable<Value>] extends [string]
  ? string extends NonNullable<Value>
    ? Fallback
    : NonNullable<Value>
  : Fallback;
/** The ID a contribution registers under when discovered at `Path`: `id`, then the path. */
export type EffectiveActionId<T, Path extends string> = T extends { id?: infer Id }
  ? LiteralOr<Id, Path>
  : Path;
export type ActionSignature<T> =
  T extends ActionSpec<infer Input, infer Result>
    ? { input: Input; result: Awaited<Result> }
    : never;
export type ActionEntry<T, Path extends string> = [ActionSignature<T>] extends [never]
  ? {}
  : { [Key in EffectiveActionId<T, Path>]: ActionSignature<T> };
export type Contribution = ActionSpec<any, any>;
export type ResolvedContribution = ActionSpec<any, any> & { id: string };
