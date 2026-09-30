import { preserveContributionPath } from './contribution-origin.js';
import type { Contribution, Plugin, ResolvedContribution } from './definitions.js';
import { resolveContribution } from './conventions.js';

/** Replace only a named plugin contribution, retaining its public ID and placements. */
export function applyActionReplacements(
  plugins: readonly Plugin[],
  appActions: readonly Contribution[],
) {
  const replacements = new Map<string, ResolvedContribution>();
  const ownActions: Contribution[] = [];
  for (const action of appActions) {
    const definition = resolveContribution(action);
    if (!definition.replaces) {
      ownActions.push(action);
      continue;
    }
    if (replacements.has(definition.replaces))
      throw new Error(`Multiple app replacements for action "${definition.replaces}".`);
    replacements.set(definition.replaces, definition);
  }
  const targets = new Map<string, ResolvedContribution>();
  for (const plugin of plugins)
    for (const action of plugin.actions ?? []) {
      const definition = resolveContribution(action);
      if (definition.replaces) throw new Error('Only app actions may replace plugin actions.');
      // Bare native exports can establish their ID at construction; registration validates those.
      if (!definition.id) continue;
      if (targets.has(definition.id))
        throw new Error(`Duplicate plugin action "${definition.id}".`);
      targets.set(definition.id, definition);
    }
  for (const id of replacements.keys()) {
    if (!targets.has(id))
      throw new Error(
        `Cannot replace missing plugin action "${id}". The target needs a discovery or explicit definition ID.`,
      );
  }
  const resolvedPlugins = plugins.map((plugin) => ({
    ...plugin,
    actions: (plugin.actions ?? []).map((action) => {
      const original = resolveContribution(action);
      const replacement = replacements.get(original.id);
      if (!replacement) return action;
      return preserveContributionPath(original, {
        ...replacement,
        id: original.id,
        groups: replacement.groups ?? original.groups,
        order: replacement.order ?? original.order,
        title: replacement.title ?? original.title,
        description: replacement.description ?? original.description,
        icon: replacement.icon ?? original.icon,
        replaces: undefined,
      }) as ResolvedContribution;
    }),
  }));
  return { plugins: resolvedPlugins, actions: ownActions };
}
