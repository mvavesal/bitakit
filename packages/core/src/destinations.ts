/**
 * What a navigation Action leads to, so search and overviews can say what a result is and which
 * plugin owns it. Derived from existing registrations; developers never declare it.
 */
export type DestinationKind = 'plugin' | 'page' | 'settings';
export type Destination = Readonly<{
  kind: DestinationKind;
  /** The owning plugin; absent when the application itself owns the destination. */
  plugin?: string;
}>;

const kinds: readonly string[] = ['plugin', 'page', 'settings'];
const field = 'foundationDestination';

/**
 * Action metadata for integrations that project their own registrations into the ActionList,
 * such as settings sections. They already know the owner, so it is carried, not guessed.
 */
export function destinationMetadata({ kind, plugin }: Destination) {
  return { [field]: Object.freeze(plugin ? { kind, plugin } : { kind }) };
}

/** The destination an integration projected into Action metadata, if it is well-formed. */
export function projectedDestination(metadata: unknown): Destination | undefined {
  const value =
    metadata && typeof metadata === 'object'
      ? (metadata as Record<string, unknown>)[field]
      : undefined;
  if (!value || typeof value !== 'object') return undefined;
  const { kind, plugin } = value as { kind?: unknown; plugin?: unknown };
  if (typeof kind !== 'string' || !kinds.includes(kind)) return undefined;
  return { kind: kind as DestinationKind, ...(typeof plugin === 'string' ? { plugin } : {}) };
}
