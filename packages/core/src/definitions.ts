import type { Events, EventErrorHandler, FoundationEvent } from './events/types.js';
import type { ActionSetup, ActionSetupContext } from './events/action-setup.js';
import type { ServiceInterceptor } from './interceptors/service.js';
import { statefulAction, type StatefulBuilder } from './contributions/stateful-action.js';
import type { ConfigContext, ConfigValues, ConfigDefinition } from './config-service.js';
import type { AuthService, TranslationService } from './contracts.js';
import type { PresentationType } from './presentation.js';
import type {
  ActionContext,
  ActionShortcut,
  Action,
  ActionInterceptor,
  ActionDefinition,
  ActionPresentation,
  ActionGroup,
} from '@bitakit/core/actions';
import type { PluginScope } from './scope.js';
import type { Feedback, MessageValues } from './actions/feedback.js';
import { URLAction } from '@bitakit/core/actions';
import type { PublicServiceKeys } from './app/types.js';
import type { FoundationApp } from './app/types.js';

/** Augmented by generated service declarations. No global runtime container. */
export interface ServiceMap {
  auth?: AuthService;
  i18n?: TranslationService;
}
/**
 * What a contribution sees as `services`: public names (exposeAs, by default the file path) and
 * raw container keys, which discovery adds to ServiceMap. A name means the same service in every
 * plugin, so these types describe exactly what the runtime resolves.
 */
export type Services = Readonly<ServiceMap>;
export type Translator = ((key: string, values?: MessageValues) => string) & {
  has?: (key: string) => boolean;
};
export interface ServiceDefinition<T = unknown> {
  id: string;
  /** Optional name for this same instance in app.services. Discovery defaults to the file path. */
  exposeAs?: string;
  requires?: readonly string[];
  create(context: { services: Services; config: ConfigContext; events: Events }): T;
  dispose?: (instance: T) => void;
}
export function defineService<const ID extends string, T, const Name extends string>(
  definition: ServiceDefinition<T> & { id: ID; exposeAs: Name },
): ServiceDefinition<T> & { id: ID; exposeAs: Name };
export function defineService<T, const Name extends string>(
  definition: Omit<ServiceDefinition<T>, 'id'> & { exposeAs: Name },
): Omit<ServiceDefinition<T>, 'id'> & { exposeAs: Name };
export function defineService<const ID extends string, T>(
  definition: ServiceDefinition<T> & { id: ID },
): ServiceDefinition<T> & { id: ID };
export function defineService<T>(
  definition: Omit<ServiceDefinition<T>, 'id'>,
): Omit<ServiceDefinition<T>, 'id'>;
export function defineService(
  definition: ServiceDefinition<any> | Omit<ServiceDefinition<any>, 'id'>,
) {
  return definition;
}
export type FoundationInterceptor = {
  before(
    context: ActionContext & { config: ConfigContext },
  ): boolean | void | Promise<boolean | void>;
};
export type InterceptorDefinition = {
  requires?: readonly string[];
  order?: number;
  scope?: 'plugin' | 'global';
  create(context: {
    services: Services;
    translate: Translator;
    config: ConfigContext;
  }): FoundationInterceptor;
};
export function defineInterceptor(definition: InterceptorDefinition): InterceptorDefinition;
export function defineInterceptor(
  definition: FoundationInterceptor & { order?: number; scope?: 'plugin' | 'global' },
): FoundationInterceptor;
export function defineInterceptor(definition: ActionInterceptorEntry): ActionInterceptorEntry {
  return definition;
}
export type ActionInterceptorEntry = (InterceptorDefinition | FoundationInterceptor) & {
  kind?: 'action';
  order?: number;
  scope?: 'plugin' | 'global';
};
export type InterceptorEntry = ActionInterceptorEntry | ServiceInterceptor;
/** Explicit Action discriminator; the legacy defineInterceptor helper remains supported. */
export function defineActionInterceptor<T extends ActionInterceptorEntry>(
  definition: T,
): T & { kind: 'action' } {
  return { ...definition, kind: 'action' };
}
/** Ordered outside-in. Dependencies must already appear before this provider. */
export type ProviderDefinition = {
  id: string;
  component: PresentationType<'provider'>;
  requires?: readonly string[];
};
export function defineProvider(definition: ProviderDefinition): ProviderDefinition {
  return definition;
}
export type Field = {
  type: 'text' | 'email' | 'select';
  label?: string;
  required?: boolean;
  defaultValue?: string;
  options?: readonly { value: string; label: string }[];
};
export type Fields = Readonly<Record<string, Field>>;
export type Values<F extends Fields> = { [K in keyof F]: string };
export type FormRenderProps = {
  values: Readonly<Record<string, string>>;
  setValue(name: string, value: string): void;
  submit(event: { preventDefault(): void }): void;
  pending: boolean;
  enabled: boolean;
  error: string | null;
};
export type ActionConventions = Partial<
  Pick<
    ActionDefinition,
    | 'title'
    | 'description'
    | 'icon'
    | 'tooltip'
    | 'shortcut'
    | 'enabled'
    | 'visible'
    | 'dependsOn'
    | 'dividerBefore'
  >
> & {
  id?: string;
  /** App-only: explicitly replace a plugin action while preserving its public ID. */
  replaces?: string;
  groups?: readonly (string | ActionGroup)[];
  order?: number;
  conventions?: boolean;
  /** Explicit local config path for manual registration; discovery supplies it otherwise. */
  configPath?: readonly string[];
};
/** Literal `id`/`replaces` values survive the builders so ActionMap entries use the effective ID. */
type Identity<Id extends string, Replaces extends string> = { id?: Id; replaces?: Replaces };

export type FormDefinition<F extends Fields = Fields, Result = unknown> = ActionConventions & {
  kind: 'form';
  requires?: readonly string[];
  fields: F;
  submit(
    values: Values<F>,
    context: { services: Services; config: ConfigContext; input?: unknown },
  ): Result | Promise<Result>;
  closeOnSuccess?: boolean;
  success?: Feedback<{
    result: NoInfer<Awaited<Result>>;
    input: Values<F>;
    services: Services;
  }>;
  failure?: Feedback<{ error: unknown; input: Values<F>; services: Services }>;
  render?: (props: FormRenderProps) => PresentationType<'node'>;
};
export function defineFormAction<
  const F extends Fields,
  Result,
  const Id extends string = string,
  const Replaces extends string = string,
>(
  definition: Omit<FormDefinition<F, Result>, 'kind' | 'id' | 'replaces'> & Identity<Id, Replaces>,
): FormDefinition<F, Result> & Identity<Id, Replaces> {
  return { ...definition, kind: 'form' };
}
export type DialogDefinition<Input = unknown> = ActionConventions & {
  kind: 'dialog';
  size?: 'default' | 'wide';
  requires?: readonly string[];
  watch?: readonly string[];
  resolve?: (
    input: Input,
    context: { services: Services; config: ConfigContext },
  ) => ActionPresentation;
  render(props: { input: Input; close(): void; services: Services }): PresentationType<'node'>;
};
export function defineDialogAction<
  Input = unknown,
  const Id extends string = string,
  const Replaces extends string = string,
>(
  definition: Omit<DialogDefinition<Input>, 'kind' | 'id' | 'replaces'> & Identity<Id, Replaces>,
): DialogDefinition<Input> & Identity<Id, Replaces> {
  return { ...definition, kind: 'dialog' };
}
/** Context supplied automatically to an exported Action class or function. */
export type ActionEnvironment = {
  services: Services;
  translate: Translator;
  config: ConfigContext;
};
export type ActionExport =
  | (new (context: ActionEnvironment) => Action<any, any>)
  | ((context: ActionEnvironment) => Action<any, any>);
/** Internal normalized representation; application code exports classes/functions directly. */
export type NativeDefinition = ActionConventions & {
  kind: 'native';
  requires?: readonly string[];
  load(context: ActionEnvironment): Action<any, any>;
  fromExport?: boolean;
};
/** Navigation retains native link semantics and programmatic URLAction execution. */
export function defineURLAction<
  const Id extends string = string,
  const Replaces extends string = string,
>(
  definition: Omit<ActionConventions, 'id' | 'replaces'> &
    Identity<Id, Replaces> & { href: string },
): NativeDefinition & Identity<Id, Replaces> {
  return {
    ...definition,
    kind: 'native',
    load: () => new URLAction({ href: definition.href, title: definition.title ?? '' }),
  };
}
export type PlainDefinition<Input = unknown, Result = unknown, Name extends string = string> = Omit<
  ActionConventions,
  'shortcut'
> &
  Omit<ActionDefinition, 'id' | 'title' | 'groups' | 'execute' | 'resolve' | 'shortcut'> & {
    shortcut?: ActionShortcut<NoInfer<Input>>;
    kind: 'action';
    /** Runs once per registration; events.watch subscriptions are automatically owned. */
    setup?: ActionSetup;
    /** Named custom events delivered to onEvent; independent of observable-service watch. */
    events?: readonly Name[];
    onEvent?(
      event: FoundationEvent<NoInfer<Name>>,
      context: ActionSetupContext & { signal: AbortSignal },
    ): void | Promise<void>;
    requires?: readonly string[];
    /** Observable services that invalidate presentation; subscribed once per runtime. */
    watch?: readonly string[];
    resolve?: (
      input: Input,
      context: { services: Services; config: ConfigContext },
    ) => ActionPresentation;
    execute?: (
      context: ActionContext<Input> & {
        services: Services;
        config: ConfigContext;
        app: FoundationApp;
      },
    ) => Result | Promise<Result>;
    success?: Feedback<{
      result: NoInfer<Awaited<Result>>;
      input: Input;
      services: Services;
    }>;
    failure?: Feedback<{ error: unknown; input: Input; services: Services }>;
  };
/**
 * `Result` is inferred from `execute`. Type `Input` by annotating the first `resolve`
 * parameter, or pass both arguments explicitly: `defineAction<MemberContext, void>({...})`.
 */
export function defineAction<Input>(): StatefulBuilder<Input>;
export function defineAction<
  Input = unknown,
  Result = void,
  const Id extends string = string,
  const Replaces extends string = string,
  const Name extends string = string,
>(
  definition: Omit<PlainDefinition<Input, Result, Name>, 'kind' | 'id' | 'replaces'> &
    Identity<Id, Replaces> & {
      unavailable?: { messageKey: string };
    },
): PlainDefinition<Input, Result, Name> & Identity<Id, Replaces>;
export function defineAction(definition?: any): any {
  if (definition === undefined) return statefulAction();
  const { unavailable, ...action } = definition;
  if (
    unavailable &&
    action.metadata != null &&
    (typeof action.metadata !== 'object' || Array.isArray(action.metadata))
  )
    throw new Error('Unavailable messages require object metadata.');
  return {
    ...action,
    kind: 'action',
    metadata: unavailable
      ? {
          ...(action.metadata as object),
          foundationUnavailableKey: unavailable.messageKey,
        }
      : action.metadata,
  };
}
// Heterogeneous plugin collection; concrete builders retain each input/result type.
export type Contribution =
  | FormDefinition<any, any>
  | DialogDefinition<any>
  | NativeDefinition
  | PlainDefinition<any, any>
  | ActionExport;
export type ResolvedContribution = Exclude<Contribution, ActionExport> & { id: string };
export type ResolvedForm = FormDefinition<Fields, any> & { id: string };

/** A literal string wins; a widened `string` or a missing value falls back. */
type LiteralOr<Value, Fallback> = [NonNullable<Value>] extends [string]
  ? string extends NonNullable<Value>
    ? Fallback
    : NonNullable<Value>
  : Fallback;
/** The ID a contribution registers under when discovered at `Path`: `replaces`, then `id`, then the path. */
export type EffectiveActionId<T, Path extends string> = T extends { replaces?: infer Replaces }
  ? LiteralOr<Replaces, T extends { id?: infer Id } ? LiteralOr<Id, Path> : Path>
  : Path;
/**
 * Input and result of a definition for ActionMap. Class and function exports establish their ID
 * at construction and therefore contribute no entry; augment ActionMap manually for those.
 */
export type ActionSignature<T> = T extends ActionExport
  ? never
  : T extends PlainDefinition<infer Input, infer Result>
    ? { input: Input; result: Awaited<Result> } & (T extends { initialState: infer State }
        ? { state: State }
        : {})
    : T extends FormDefinition<any, any>
      ? { input: unknown; result: void }
      : T extends DialogDefinition<infer Input>
        ? { input: Input; result: void }
        : T extends NativeDefinition
          ? { input: void; result: void }
          : never;
/** One ActionMap entry for a discovered file; build tooling intersects these into the augmentation. */
export type ActionEntry<T, Path extends string> = [ActionSignature<T>] extends [never]
  ? {}
  : { [Key in EffectiveActionId<T, Path>]: ActionSignature<T> };

export type Setup = (context: { app: PluginScope; services: Services }) => void | (() => void);
/**
 * Contribution kinds provided by optional integrations, keyed by kind name. An integration
 * augments this map with the value type its normalizer produces, e.g. `'settings.sections': Section`.
 */
export interface ContributionMap {}
/** Declarative values a module contributes; Core routes each kind to the installer that claims it. */
export type ContributionSet = {
  readonly [K in keyof ContributionMap]?: readonly ContributionMap[K][];
} & {
  readonly [kind: string]: readonly unknown[] | undefined;
};
export type ContributionContext = {
  /** The contributing module. */
  module: string;
  /** True for the application module. */
  app: boolean;
  services: Services;
};
/**
 * Installs one module's values of a kind. Runs during mount after services, translation and
 * interceptors, before actions and setup. The returned cleanup belongs to the contributing module.
 */
export type ContributionInstaller<T = unknown> = (
  values: readonly T[],
  context: ContributionContext,
) => void | (() => void);
export type ContributionInstallers = {
  readonly [K in keyof ContributionMap]?: ContributionInstaller<ContributionMap[K]>;
} & { readonly [kind: string]: ContributionInstaller<any> | undefined };
export function defineSetup(setup: Setup) {
  return setup;
}
export type PluginView = { slot: string; component: PresentationType<'component'>; order?: number };
export function defineView(view: PluginView): PluginView {
  return view;
}
export type PluginPageDefinition = { path: string; component: PresentationType<'component'> };
export function definePage(page: PluginPageDefinition): PluginPageDefinition {
  return page;
}
export type Plugin = {
  /** Aliases for externally supplied services or existing compositions. Prefer service.exposeAs. */
  publicServices?: PublicServiceKeys;
  /** Instance-local projections owned by optional packages; never a second state store. */
  appExtensions?: Readonly<
    Record<string, (runtime: import('./runtime.js').FoundationRuntime) => unknown>
  >;
  config?: ConfigValues | ConfigDefinition;
  interceptors?: readonly InterceptorEntry[];
  providers?: readonly ProviderDefinition[];
  metadata?: PluginMetadata;
  pages?: readonly PluginPageDefinition[];
  views?: readonly PluginView[];
  id: string;
  dependencies?: readonly string[];
  services?: readonly ServiceDefinition<any>[];
  actions?: readonly Contribution[];
  setup?: Setup;
  /** Declarative values for installers provided by integrations. */
  contributions?: ContributionSet;
  /** Installers for contribution kinds this module owns. One module per kind. */
  installs?: ContributionInstallers;
};
export function definePlugin<const T extends Plugin>(plugin: T): T {
  return plugin;
}
export type FoundationConfig = {
  /** Receives synchronous throws and async rejections from event handlers. */
  onEventError?: EventErrorHandler;
  publicServices?: PublicServiceKeys;
  /** Instance-local projections owned by optional packages; never a second state store. */
  appExtensions?: Readonly<
    Record<string, (runtime: import('./runtime.js').FoundationRuntime) => unknown>
  >;
  metadata?: PluginMetadata;
  dependencies?: readonly string[];
  pages?: readonly PluginPageDefinition[];
  views?: readonly PluginView[];
  setup?: Setup;
  appId?: string;
  config?: ConfigValues | ConfigDefinition;
  configOverrides?: Readonly<Record<string, ConfigValues>>;
  services?: readonly ServiceDefinition<any>[];
  groups?: readonly string[];
  actionOverrides?: Readonly<Record<string, { enabled?: boolean; visible?: boolean }>>;
  actions?: readonly Contribution[];
  interceptors?: readonly InterceptorEntry[];
  providers?: readonly ProviderDefinition[];
  plugins?: readonly Plugin[];
  contributions?: ContributionSet;
  installs?: ContributionInstallers;
};

/** Public display information only; package authors remain the source of truth. */
export type PluginMetadata = {
  /** Optional presentation image; the UI falls back to the plugin icon. */
  coverImage?: string;
  icon?: PresentationType<'icon'>;
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  homepage?: string;
  bugs?: string | { url?: string; email?: string };
  license?: string;
};
