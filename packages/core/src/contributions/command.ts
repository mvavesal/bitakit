import type { ConfigContext } from '../config-service.js';
import type { ActionContext } from '@bitakit/core/actions';
import { ActionFailure } from '../actions/feedback.js';
import type { PlainDefinition } from '../definitions.js';
import type { ContributionHost } from './host.js';
import type { Adapted } from './index.js';
import { applyOverride, cap, groupsOf, texts } from './shared.js';

/** Plain commands: contextual presentation from services, explicit outcome feedback around execution. */
export function adaptCommand(
  resolved: PlainDefinition<any, any> & { id: string },
  host: ContributionHost,
  config: ConfigContext,
): Adapted {
  const { definition, override } = applyOverride(resolved, host);
  const services = host.services;
  const execute = definition.execute;
  return {
    definition,
    setup: definition.setup || definition.onEvent
      ? (context) => {
          if (definition.onEvent && definition.events?.length) {
            const onEvent = definition.onEvent;
            context.events.watch(definition.events, (event, { signal }) =>
              onEvent(event, { ...context, signal }),
            );
          }
          return definition.setup?.(context);
        }
      : undefined,
    requires: definition.requires ?? [],
    watch: definition.watch ?? [],
    registrations: [
      {
        id: definition.id,
        placement: {},
        definition: {
          ...definition,
          ...texts(host, definition),
          groups: groupsOf(host, definition),
          resolve: (input: unknown) =>
            cap(definition.resolve?.(input, { services, config }) ?? {}, override),
          execute: execute
            ? async (context: ActionContext) => {
                let result: unknown;
                try {
                  result = await execute({ ...context, services, config, app: host.app });
                } catch (error) {
                  const feedback = context.get()
                    ? host.feedback(definition, 'failure', definition.failure, {
                        error,
                        input: context.input,
                        services,
                      }).message
                    : false;
                  throw new ActionFailure(feedback, error);
                }
                if (context.get())
                  host.notify(
                    host.feedback(definition, 'success', definition.success, {
                      result,
                      input: context.input,
                      services,
                    }).message,
                  );
                return result;
              }
            : undefined,
        },
      },
    ],
  };
}
