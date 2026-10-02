import type {
  ActionContext,
  ActionDefinition,
  ActionPresentation,
  RegistrationOptions,
} from '@bitakit/core/actions';
import { CANCEL, navigate } from '@bitakit/core/actions';
import type { ConfigContext } from '../config-service.js';
import { ActionFailure } from '../actions/feedback.js';
import type {
  Dynamic,
  ExecuteContext,
  InputSchema,
  PresentationContext,
  ResolvedContribution,
} from '../definitions.js';
import type { Events } from '../events/types.js';
import type { ContributionHost, OpenableDefinition, Override } from './host.js';

export type Registration = {
  id: string;
  placement: RegistrationOptions;
  definition: ActionDefinition;
};
export type Adapted = {
  definition: ResolvedContribution;
  requires: readonly string[];
  registrations: readonly Registration[];
  /** Installed by the runtime around this action's executions. */
  confirm?: (context: ActionContext) => Promise<typeof CANCEL | undefined>;
};

const dynamicKeys = [
  'title',
  'description',
  'tooltip',
  'variant',
  'href',
  'enabled',
  'visible',
  'checked',
  'value',
] as const;

/** Configuration caps: false wins over any reactive result; true never bypasses guards. */
export function cap(presentation: ActionPresentation, override: Override): ActionPresentation {
  if (!override) return presentation;
  return {
    ...presentation,
    enabled: override.enabled === false ? false : presentation.enabled,
    visible: override.visible === false ? false : presentation.visible,
  };
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  !!value && typeof (value as PromiseLike<unknown>).then === 'function';
const invalid = (issues: readonly { message: string }[]) =>
  new Error(`Invalid input: ${issues.map((issue) => issue.message).join('; ')}`);
/** Undefined when the schema validates asynchronously; execution then awaits `validate`. */
function validateSync<T>(
  schema: InputSchema<T> | undefined,
  input: unknown,
): { ok: true; value: T } | { ok: false; error: Error } | undefined {
  if (!schema) return undefined;
  try {
    if ('parse' in schema) return { ok: true, value: schema.parse(input) };
    const result = schema['~standard'].validate(input);
    if (isThenable(result)) return undefined;
    if ('issues' in (result as object))
      return {
        ok: false,
        error: invalid((result as { issues: readonly { message: string }[] }).issues),
      };
    return { ok: true, value: (result as { value: T }).value };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
async function validate<T>(schema: InputSchema<T>, input: unknown): Promise<T> {
  if ('parse' in schema) return schema.parse(input);
  const result = await schema['~standard'].validate(input);
  if ('issues' in result) throw invalid(result.issues);
  return result.value;
}

/**
 * The one adapter: static fields register as-is, function-valued fields are evaluated per
 * input in `resolve`, `href` executes as navigation, `dialog` opens the host dialog and
 * `execute` runs with validation, feedback and the shared execution guards.
 */
export function adaptAction(
  resolved: ResolvedContribution,
  host: ContributionHost,
  config: ConfigContext,
  events: Events,
): Adapted {
  const override = host.override(resolved.id);
  // Only `false` caps apply to the definition; `true` never bypasses the action's own guards.
  const definition = override
    ? ({
        ...resolved,
        ...(override.enabled === false ? { enabled: false } : {}),
        ...(override.visible === false ? { visible: false } : {}),
      } as ResolvedContribution)
    : resolved;
  const context = (input: unknown): PresentationContext => ({
    input,
    services: host.services,
    config,
    app: host.app,
  });
  const evaluate = <V>(value: Dynamic<unknown, V>, input: unknown): V =>
    typeof value === 'function'
      ? (value as (context: PresentationContext) => V)(context(input))
      : value;
  const resolve = (input: unknown): ActionPresentation => {
    const presentation: ActionPresentation = definition.resolve
      ? { ...definition.resolve(input, { services: host.services, config }) }
      : {};
    for (const key of dynamicKeys) {
      const value = definition[key];
      if (typeof value === 'function')
        (presentation as Record<string, unknown>)[key] = evaluate(value, input);
    }
    // A schema disables the action while the current input is invalid, unless `enabled` decides.
    if (definition.input && definition.enabled === undefined) {
      const checked = validateSync(definition.input, input);
      if (checked) presentation.enabled = checked.ok;
    }
    return cap(presentation, override);
  };
  const isStatic = <V>(value: Dynamic<unknown, V> | undefined): value is V =>
    typeof value !== 'function';
  const execute = definition.dialog
    ? ({ input }: ActionContext) => {
        if (!host.dialog()) host.openDialog(definition as OpenableDefinition, input);
      }
    : definition.execute
      ? (context: ActionContext) => {
          const run = definition.execute!;
          const failure = (error: unknown, input: unknown) =>
            new ActionFailure(
              context.get()
                ? host.feedback(definition, 'failure', definition.failure, {
                    error,
                    input,
                    services: host.services,
                  }).message
                : false,
              error,
            );
          const succeed = (result: unknown, input: unknown) => {
            if (context.get())
              host.notify(
                host.feedback(definition, 'success', definition.success, {
                  result,
                  input,
                  services: host.services,
                }).message,
                'success',
              );
            return result;
          };
          // Synchronous handlers stay synchronous, so the list shows pending only for real promises.
          const start = (input: unknown) => {
            const full: ExecuteContext = {
              ...context,
              input,
              services: host.services,
              config,
              app: host.app,
              events,
            };
            let result: unknown;
            try {
              result = run(full);
            } catch (error) {
              throw failure(error, input);
            }
            return isThenable(result)
              ? Promise.resolve(result).then(
                  (value) => succeed(value, input),
                  (error) => {
                    throw failure(error, input);
                  },
                )
              : succeed(result, input);
          };
          if (!definition.input) return start(context.input);
          const checked = validateSync(definition.input, context.input);
          if (checked) {
            if (!checked.ok) throw failure(checked.error, context.input);
            return start(checked.value);
          }
          return validate(definition.input, context.input).then(start, (error) => {
            throw failure(error, context.input);
          });
        }
      : definition.href !== undefined
        ? (context: ActionContext) =>
            navigate(
              context,
              isStatic(definition.href) ? undefined : evaluate(definition.href!, context.input),
            )
        : undefined;
  const registration: ActionDefinition = {
    id: definition.id,
    title: host.title(definition),
    description: host.description(definition),
    tooltip: host.tooltip(definition),
    icon: definition.icon,
    variant: isStatic(definition.variant) ? definition.variant : undefined,
    href: isStatic(definition.href) ? definition.href : undefined,
    enabled: isStatic(definition.enabled) ? definition.enabled : undefined,
    visible: isStatic(definition.visible) ? definition.visible : undefined,
    checked: isStatic(definition.checked) ? definition.checked : undefined,
    value: isStatic(definition.value) ? definition.value : undefined,
    groups: (definition.groups ?? []).map(host.getGroup),
    order: definition.order,
    dividerBefore: definition.dividerBefore,
    shortcut: definition.shortcut,
    internal: definition.internal,
    metadata: definition.metadata,
    concurrency: definition.concurrency,
    concurrencyKey: definition.concurrencyKey,
    resolve,
    execute,
  };
  const confirm = definition.confirm
    ? async (context: ActionContext) => {
        const request = evaluate(definition.confirm!, context.input);
        if (!request) return undefined;
        const accepted = await host.confirm(
          typeof request === 'string' ? { title: request, description: '' } : request,
        );
        return accepted ? undefined : CANCEL;
      }
    : undefined;
  return {
    definition,
    requires: definition.requires ?? [],
    registrations: [{ id: definition.id, placement: {}, definition: registration }],
    confirm,
  };
}
