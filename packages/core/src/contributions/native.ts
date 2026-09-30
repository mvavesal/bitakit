import type { ConfigContext } from '../config-service.js';
import { Action } from '@bitakit/core/actions';
import { ActionFailure } from '../actions/feedback.js';
import { resolveContribution } from '../conventions.js';
import type { NativeDefinition, ResolvedContribution } from '../definitions.js';
import type { ContributionHost } from './host.js';
import type { Adapted } from './index.js';
import { applyOverride, cap, groupsOf, texts } from './shared.js';

/**
 * Class and function exports: one fresh instance per runtime. Metadata declared on the instance
 * wins; translation, overrides and opt-in feedback are applied to that instance.
 */
export function adaptNative(
  resolved: NativeDefinition & { id: string },
  host: ContributionHost,
  config: ConfigContext,
): Adapted {
  const instance = resolved.load({ services: host.services, translate: host.translator(), config });
  if (!(instance instanceof Action))
    throw new Error(`Action export "${resolved.id}" must return an Action instance.`);
  let effective = resolved;
  if (resolved.fromExport) {
    const snapshot = instance.snapshot();
    effective = resolveContribution({
      ...resolved,
      ...snapshot,
      id: instance.id ?? resolved.id,
      title: snapshot.title || undefined,
      fromExport: false,
    }) as typeof resolved;
  }
  const { definition, override } = applyOverride(effective, host);
  if (override) {
    const resolve = instance.resolve.bind(instance);
    instance.resolve = (input) => cap(resolve(input), override);
  }
  const shared = texts(host, definition);
  instance.title = shared.title;
  if (shared.description !== undefined) instance.description = shared.description;
  if (definition.icon !== undefined) instance.icon = definition.icon;
  if (shared.tooltip !== undefined) instance.tooltip = shared.tooltip;
  if (definition.enabled !== undefined) instance.enabled = definition.enabled;
  if (definition.visible !== undefined) instance.visible = definition.visible;
  if (definition.shortcut !== undefined) instance.shortcut = definition.shortcut;
  if (definition.dependsOn !== undefined) instance.dependsOn = definition.dependsOn;
  if (instance.success !== undefined || instance.failure !== undefined)
    attachFeedback(instance, definition, host);
  const groups = [
    ...new Map(
      [...(instance.snapshot().groups ?? []), ...groupsOf(host, definition)].map((group) => [
        group.id,
        group,
      ]),
    ).values(),
  ];
  return {
    definition,
    requires: definition.requires ?? [],
    watch: [],
    registrations: [
      {
        id: definition.id,
        instance,
        placement: { groups, order: definition.order, dividerBefore: definition.dividerBefore },
      },
    ],
  };
}

/** Same pipeline as plain commands, but only for feedback the class declares itself. */
function attachFeedback(
  instance: Action<any, any>,
  definition: ResolvedContribution,
  host: ContributionHost,
) {
  const run = instance.execute.bind(instance);
  instance.execute = async (input, context) => {
    const live = () => !context || context.get() !== undefined;
    let result: unknown;
    try {
      result = await run(input, context);
    } catch (error) {
      if (instance.failure === undefined) throw error;
      const feedback = live()
        ? host.feedback(definition, 'failure', instance.failure, { error, input }).message
        : false;
      throw new ActionFailure(feedback, error);
    }
    if (instance.success !== undefined && live())
      host.notify(
        host.feedback(definition, 'success', instance.success, { result, input }).message,
      );
    return result;
  };
}
