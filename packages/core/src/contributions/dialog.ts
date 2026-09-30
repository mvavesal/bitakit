import type { ConfigContext } from '../config-service.js';
import type { DialogDefinition } from '../definitions.js';
import type { ContributionHost } from './host.js';
import type { Adapted } from './index.js';
import { applyOverride, cap, opener } from './shared.js';

/** Custom dialogs: the opener carries contextual guards; the body renders inside the dialog host. */
export function adaptDialog(
  resolved: DialogDefinition<any> & { id: string },
  host: ContributionHost,
  config: ConfigContext,
): Adapted {
  const { definition, override } = applyOverride(resolved, host);
  const services = host.services;
  return {
    definition,
    requires: definition.requires ?? [],
    watch: definition.watch ?? [],
    registrations: [
      {
        id: definition.id,
        placement: {},
        definition: opener(host, definition, (input) =>
          cap(definition.resolve?.(input, { services, config }) ?? {}, override),
        ),
      },
    ],
  };
}
