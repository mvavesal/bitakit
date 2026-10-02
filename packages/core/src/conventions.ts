import { preserveContributionPath } from './contribution-origin.js';
import { Action, isBrandedClass } from '@bitakit/core/actions';
import type { Contribution, ResolvedContribution } from './definitions.js';

/** Build adapters supply a path-derived ID; explicit consumers supply their own ID. */
export function resolveContribution<T extends Contribution>(
  entry: T,
  inferredId?: string,
  useConventions = true,
): ResolvedContribution {
  const definition =
    typeof entry === 'function'
      ? {
          kind: 'native' as const,
          fromExport: true,
          load: (context: import('./definitions.js').ActionEnvironment) =>
            isBrandedClass(entry, 'action')
              ? new (entry as new (
                  context: import('./definitions.js').ActionEnvironment,
                ) => Action<any, any>)(context)
              : (
                  entry as (
                    context: import('./definitions.js').ActionEnvironment,
                  ) => Action<any, any>
                )(context),
        }
      : entry;
  const normalized = definition as Exclude<Contribution, import('./definitions.js').ActionExport>;
  if (!normalized || !['action', 'form', 'dialog', 'native'].includes(normalized.kind))
    throw new Error(
      `Invalid action export in "${inferredId ?? 'manual registration'}". Export an Action class, function or action definition.`,
    );
  const automatic = normalized.conventions ?? useConventions;
  if (normalized.replaces && normalized.id && normalized.id !== normalized.replaces)
    throw new Error('A replacement must retain the target action ID.');
  const id = normalized.replaces ?? normalized.id ?? (automatic ? inferredId : undefined);
  if (!id && normalized.kind === 'native' && normalized.fromExport)
    return { ...normalized, id: '', conventions: automatic };
  if (!id)
    throw new Error(
      'Action needs an explicit ID when path conventions are unavailable or disabled.',
    );
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(id)) throw new Error(`Invalid action ID: ${id}`);
  if (!automatic && normalized.title === undefined)
    throw new Error(`Action "${id}" needs an explicit title.`);
  return preserveContributionPath(entry, {
    ...normalized,
    id,
    conventions: automatic,
  }) as ResolvedContribution;
}
export function fallbackTitle(definition: ResolvedContribution) {
  const name = definition.id.split(/[./:]/).at(-1)!.replace(/[-_]/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}
