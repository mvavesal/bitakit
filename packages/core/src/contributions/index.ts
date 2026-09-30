import type { ConfigContext } from '../config-service.js';
import type { Action, ActionDefinition, RegistrationOptions } from '@bitakit/core/actions';
import { resolveContribution } from '../conventions.js';
import type { Contribution, ResolvedContribution } from '../definitions.js';
import { adaptCommand } from './command.js';
import { adaptDialog } from './dialog.js';
import { adaptForm } from './form.js';
import type { ContributionHost } from './host.js';
import { adaptNative } from './native.js';
export type {
  ContributionHost,
  DialogState,
  FeedbackOutcome,
  OpenableDefinition,
  Override,
} from './host.js';

/** A ready-to-register entry: either a class instance (added with bindings) or a plain definition. */
export type Registration = { id: string; placement: RegistrationOptions } & (
  | { instance: Action<any, any>; definition?: undefined }
  | { definition: ActionDefinition; instance?: undefined }
);
/** The normalized shape every contribution kind reduces to. */
export type Adapted = {
  /** Final definition after conventions and overrides; the runtime re-translates from it. */
  definition: ResolvedContribution;
  requires: readonly string[];
  /** Observable services whose changes refresh the shared list. */
  watch: readonly string[];
  registrations: readonly Registration[];
};

export function adaptContribution(
  contribution: Contribution,
  host: ContributionHost,
  config: ConfigContext,
): Adapted {
  const resolved = resolveContribution(contribution);
  switch (resolved.kind) {
    case 'native':
      return adaptNative(resolved, host, config);
    case 'action':
      return adaptCommand(resolved, host, config);
    case 'dialog':
      return adaptDialog(resolved, host, config);
    case 'form':
      return adaptForm(resolved, host, config);
  }
}
