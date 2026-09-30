import type { ActionDefinition, ActionPresentation } from '@bitakit/core/actions';
import type { ResolvedContribution } from '../definitions.js';
import type { ContributionHost, OpenableDefinition, Override } from './host.js';

/** Every kind reads title, description and tooltip through the same translation rules. */
export function texts(host: ContributionHost, definition: ResolvedContribution) {
  return {
    title: host.title(definition),
    description: host.description(definition),
    tooltip:
      definition.tooltip === undefined
        ? undefined
        : host.text(definition.tooltip, host.text(`${definition.id}.tooltip`, definition.tooltip)),
  };
}
/** Configuration caps: false wins over any reactive result; true never bypasses guards. */
export function cap(presentation: ActionPresentation, override: Override): ActionPresentation {
  if (!override) return presentation;
  return {
    ...presentation,
    enabled: override.enabled === false ? false : presentation.enabled,
    visible: override.visible === false ? false : presentation.visible,
  };
}
/** Merge the host override into the definition once; the cap also applies to reactive results. */
export function applyOverride<T extends ResolvedContribution>(
  resolved: T,
  host: ContributionHost,
): { definition: T; override: Override } {
  const override = host.override(resolved.id);
  return { definition: override ? { ...resolved, ...override } : resolved, override };
}
export function groupsOf(host: ContributionHost, definition: ResolvedContribution) {
  return (definition.groups ?? []).map(host.getGroup);
}
/** The public action of a form or dialog: executing it opens the shared dialog host. */
export function opener(
  host: ContributionHost,
  definition: OpenableDefinition,
  resolve: (input: unknown) => ActionPresentation,
): ActionDefinition {
  return {
    id: definition.id,
    ...texts(host, definition),
    groups: groupsOf(host, definition),
    order: definition.order,
    icon: definition.icon,
    dividerBefore: definition.dividerBefore,
    dependsOn: definition.dependsOn,
    shortcut: definition.shortcut,
    enabled: definition.enabled,
    visible: definition.visible,
    resolve,
    execute: ({ input }) => {
      if (!host.dialog()) host.openDialog(definition, input);
    },
  };
}
