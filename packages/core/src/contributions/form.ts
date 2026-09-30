import type { ConfigContext } from '../config-service.js';
import type { ActionContext, ActionDefinition } from '@bitakit/core/actions';
import { ActionFailure } from '../actions/feedback.js';
import type { ResolvedForm } from '../definitions.js';
import { validateFields } from '../validation.js';
import type { ContributionHost } from './host.js';
import type { Adapted } from './index.js';
import { applyOverride, cap, opener, texts } from './shared.js';

/**
 * Forms register the public opener plus an internal `<id>.submit` registration. Submission runs
 * through the same executor so interceptors, pending state and execution events apply, but it is
 * excluded from enumeration: `runtime.submitForm` is the supported programmatic path.
 */
export function adaptForm(
  resolved: ResolvedForm,
  host: ContributionHost,
  config: ConfigContext,
): Adapted {
  const { definition, override } = applyOverride(resolved, host);
  const services = host.services;
  const shared = texts(host, definition);
  const submit: ActionDefinition = {
    id: `${definition.id}.submit`,
    title: shared.title,
    description: shared.description,
    internal: true,
    resolve: () => {
      const state = host.dialog();
      return {
        enabled:
          state?.definition === definition &&
          !!host.actions.resolve(definition.id, state?.input)?.enabled,
        visible: !!host.actions.get(definition.id)?.visible,
      };
    },
    execute: async (context: ActionContext) => {
      const state = host.dialog();
      const input = validateFields(definition.fields, context.input);
      let result: unknown;
      try {
        result = await definition.submit(input, { services, config, input: state?.input });
      } catch (error) {
        const feedback =
          context.get() && host.dialog() === state
            ? host.feedback(definition, 'failure', definition.failure, { error, input, services })
                .message
            : false;
        throw new ActionFailure(feedback, error);
      }
      if (state && context.get() && host.dialog() === state) {
        const feedback = host.feedback(definition, 'success', definition.success, {
          result,
          input,
          services,
        });
        host.rememberFormFeedback(state, {
          ...feedback,
          closeDialog: definition.closeOnSuccess ?? feedback.closeDialog,
        });
      }
      return result;
    },
  };
  return {
    definition,
    requires: definition.requires ?? [],
    watch: [],
    registrations: [
      {
        id: definition.id,
        placement: {},
        definition: opener(host, definition, () => cap({}, override)),
      },
      { id: submit.id, placement: {}, definition: submit },
    ],
  };
}
