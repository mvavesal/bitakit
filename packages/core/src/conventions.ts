import { preserveContributionPath } from './contribution-origin.js';
import { isActionSpec, type Contribution, type ResolvedContribution } from './definitions.js';

export const actionIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/;

/** Discovery supplies a path-derived ID; manual composition supplies `id` or a record key. */
export function resolveContribution(
  entry: Contribution,
  inferredId?: string,
): ResolvedContribution {
  if (!isActionSpec(entry))
    throw new Error(
      `Invalid action export in "${inferredId ?? 'manual registration'}". Export defineAction({ ... }).`,
    );
  const id = entry.id ?? inferredId;
  if (!id)
    throw new Error(
      'An action needs an ID: use a record key or pass { id } for manual composition.',
    );
  if (!actionIdPattern.test(id))
    throw new Error(
      `Invalid action ID "${id}". Use letters, digits, dots, underscores, colons, slashes or hyphens.`,
    );
  return preserveContributionPath(entry, { ...entry, id }) as ResolvedContribution;
}
/** `todos.clear-all` → `Clear all`. */
export function fallbackTitle(definition: { id: string }) {
  const name = definition.id.split(/[./:]/).at(-1)!.replace(/[-_]/g, ' ');
  return name.charAt(0).toUpperCase() + name.slice(1);
}
