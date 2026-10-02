import type { Plugin, Services } from './definitions.js';
import { FoundationStartupError } from './startup-error.js';

/** Who asked for a service. Only used to explain failures. */
export type ServiceRequester = { label: string; source?: string };

/**
 * Resolves the service names contributions use: a public name (`exposeAs`) from any module, then a
 * raw container key. A name means the same service in every module, so the generated ServiceMap
 * types describe exactly what a lookup returns; a module cannot give a name a second, local
 * meaning. Resolution never creates instances; the container stays the only owner of service state.
 */
export class ServiceNames {
  private readonly published = new Map<string, string>();
  constructor(
    modules: readonly Pick<Plugin, 'publicServices'>[],
    private readonly appId: string,
  ) {
    for (const module of modules)
      for (const [name, key] of Object.entries(module.publicServices ?? {}))
        this.published.set(name, key);
  }

  /** The container key that `name` refers to; unknown names are returned as-is. */
  key(name: string): string {
    return this.published.get(name) ?? name;
  }

  /** Public names of the services that currently exist. */
  private names(exists: (key: string) => boolean): string[] {
    return [...this.published].filter(([, key]) => exists(key)).map(([name]) => name);
  }

  /**
   * A read-only view of the container by public name and raw key. Lookups are live, so the view
   * can be handed to services that are still under construction.
   */
  view(instances: Readonly<Record<string, unknown>>): Services {
    const resolve = (name: string | symbol) => {
      if (typeof name !== 'string') return undefined;
      const key = this.key(name);
      return Object.hasOwn(instances, key) ? key : undefined;
    };
    return new Proxy(Object.create(null) as object, {
      get: (_target, name) => {
        const key = resolve(name);
        return key === undefined ? undefined : instances[key];
      },
      has: (_target, name) => resolve(name) !== undefined,
      ownKeys: () => [
        ...new Set([...this.names((key) => Object.hasOwn(instances, key)), ...Object.keys(instances)]),
      ],
      getOwnPropertyDescriptor: (_target, name) => {
        const key = resolve(name);
        return key === undefined
          ? undefined
          : { value: instances[key], enumerable: true, configurable: true, writable: false };
      },
      set: () => false,
      defineProperty: () => false,
      deleteProperty: () => false,
    }) as Services;
  }

  /** Explains a missing requirement of `module` with the closest usable names. */
  missing(
    module: string,
    name: string,
    requester: ServiceRequester,
    exists: (key: string) => boolean,
    rawKeys: Iterable<string>,
  ): FoundationStartupError {
    const available = this.names(exists);
    const covered = new Set(available.map((item) => this.key(item)));
    for (const key of rawKeys)
      if (!covered.has(key) && !available.includes(key) && exists(key)) available.push(key);
    const suggestions = suggest(name, available, [...rawKeys]);
    const lines = [
      `${requester.label} requires service "${name}", but no service has that name.`,
      ...(suggestions.length
        ? [`Did you mean ${suggestions.map((item) => `"${item}"`).join(' or ')}?`]
        : []),
      available.length
        ? `Available services: ${list(available)}.`
        : 'No services are available. Add one under services/ or install the plugin that provides it.',
      ...(requester.source ? [`Source: ${requester.source}`] : []),
    ];
    return new FoundationStartupError(lines.join('\n'), module, {
      source: requester.source,
      app: module === this.appId,
    });
  }
}

function list(names: readonly string[]) {
  return names.length > 12 ? `${names.slice(0, 12).join(', ')}, …` : names.join(', ');
}

/** Close names by edit distance, plus raw keys ending in the requested local name. */
function suggest(name: string, available: readonly string[], rawKeys: readonly string[]) {
  const scored = new Map<string, number>();
  const lower = name.toLowerCase();
  for (const candidate of available) {
    if (candidate === name) continue;
    if (candidate.toLowerCase() === lower) scored.set(candidate, 0);
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance <= Math.max(1, Math.floor(name.length / 3)))
      scored.set(candidate, Math.min(scored.get(candidate) ?? distance, distance));
  }
  for (const key of rawKeys)
    if (key !== name && key.endsWith(`.${name}`)) scored.set(key, Math.min(scored.get(key) ?? 1, 1));
  return [...scored].sort((a, b) => a[1] - b[1]).slice(0, 3).map(([candidate]) => candidate);
}

function editDistance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}
