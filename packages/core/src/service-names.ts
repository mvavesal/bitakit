import { FoundationStartupError } from './startup-error.js';
import { FoundationServiceError } from './app/service-error.js';
import type { Services } from './definitions.js';

/** Who asked for a service. Only used to explain failures. */
export type ServiceRequester = { label: string; source?: string };
export type ServiceEntry = { id: string; aliases: readonly string[]; plugin: string };

type Node = { leaf?: string; children: Map<string, Node> };

/**
 * Service names as contributions see them: IDs such as `todos.items` form the tree
 * `services.todos.items`; aliases (`exposeAs`, contracts) are extra paths onto the same
 * instance. Resolution never creates instances; the container stays the only owner.
 */
export class ServiceNames {
  private readonly ids = new Map<string, string>();
  private readonly root: Node = { children: new Map() };
  constructor(
    entries: readonly ServiceEntry[],
    private readonly appId: string,
  ) {
    for (const entry of entries) {
      this.add(entry.id, entry.id, entry.plugin);
      for (const alias of entry.aliases) this.add(alias, entry.id, entry.plugin);
    }
  }
  private add(name: string, id: string, plugin: string) {
    const segments = name.split('.');
    if (
      segments.some(
        (segment) => !segment || ['then', 'toJSON', '__proto__', 'constructor'].includes(segment),
      )
    )
      throw new FoundationStartupError(
        `Service name "${name}" in ${this.label(plugin)} is empty or uses a reserved segment.`,
        plugin,
        { app: plugin === this.appId },
      );
    const existing = this.ids.get(name);
    if (existing !== undefined && existing !== id)
      throw new FoundationStartupError(
        `Two services are named "${name}" (${existing} and ${id}). Rename one of the files, or set exposeAs on one of them.`,
        plugin,
        { app: plugin === this.appId },
      );
    this.ids.set(name, id);
    let node = this.root;
    for (const [index, segment] of segments.entries()) {
      let child = node.children.get(segment);
      if (!child) node.children.set(segment, (child = { children: new Map() }));
      const last = index === segments.length - 1;
      if (last) {
        if (child.children.size)
          throw new FoundationStartupError(
            `Service name "${name}" in ${this.label(plugin)} is already used as a namespace by ${[...child.children.keys()].map((key) => `${name}.${key}`).join(', ')}. A plugin cannot provide or expose a service under its own ID; rename the plugin folder (for example "${name}-provider") or choose another alias.`,
            plugin,
            { app: plugin === this.appId },
          );
        child.leaf = id;
      } else if (child.leaf !== undefined)
        throw new FoundationStartupError(
          `Service name "${name}" in ${this.label(plugin)} is nested under "${segments.slice(0, index + 1).join('.')}", which is already a service.`,
          plugin,
          { app: plugin === this.appId },
        );
      node = child;
    }
  }
  private label(plugin: string) {
    return plugin === this.appId ? 'the app' : `plugin "${plugin}"`;
  }

  /** The container key that `name` refers to; unknown names are returned as-is. */
  key(name: string): string {
    return this.ids.get(name) ?? name;
  }
  known(name: string): boolean {
    return this.ids.has(name);
  }
  /** Every known name, IDs first. */
  names(): string[] {
    return [...this.ids.keys()];
  }

  /**
   * The live tree over a container. Reads resolve at access time, so the tree can be handed to
   * services that are still under construction. Unknown names throw a named error.
   */
  tree(instances: Readonly<Record<string, unknown>>, notReady?: () => boolean): Services {
    const cache = new WeakMap<Node, object>();
    const project = (node: Node, prefix: string): object => {
      const cached = cache.get(node);
      if (cached) return cached;
      const target = Object.create(null) as Record<string, unknown>;
      const proxy: Record<string, unknown> = new Proxy(target, {
        get: (_target, name) => {
          if (typeof name !== 'string' || name === 'then' || name === 'toJSON') return undefined;
          const path = prefix ? `${prefix}.${name}` : name;
          const child = node.children.get(name);
          if (!child)
            throw new FoundationServiceError(path, notReady?.() ? 'not-ready' : 'unregistered');
          if (child.leaf !== undefined) {
            if (!Object.hasOwn(instances, child.leaf))
              throw new FoundationServiceError(path, notReady?.() ? 'not-ready' : 'missing');
            return instances[child.leaf];
          }
          return project(child, path);
        },
        has: (_target, name) => typeof name === 'string' && node.children.has(name),
        ownKeys: () => [...node.children.keys()],
        getOwnPropertyDescriptor: (_target, name): PropertyDescriptor | undefined =>
          typeof name === 'string' && node.children.has(name)
            ? { enumerable: true, configurable: true, writable: false, value: proxy[name] }
            : undefined,
        set: () => false,
        defineProperty: () => false,
        deleteProperty: () => false,
      });
      cache.set(node, proxy);
      return proxy;
    };
    return project(this.root, '') as Services;
  }

  /** Explains a missing requirement of `module` with the closest usable names. */
  missing(
    module: string,
    name: string,
    requester: ServiceRequester,
    exists: (key: string) => boolean,
  ): FoundationStartupError {
    const available = this.names().filter((item) => exists(this.key(item)));
    const suggestions = suggest(name, available);
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
/** Close names by edit distance, plus names ending in the requested local name. */
function suggest(name: string, available: readonly string[]) {
  const scored = new Map<string, number>();
  const lower = name.toLowerCase();
  for (const candidate of available) {
    if (candidate === name) continue;
    if (candidate.toLowerCase() === lower) scored.set(candidate, 0);
    if (candidate.endsWith(`.${name}`))
      scored.set(candidate, Math.min(scored.get(candidate) ?? 1, 1));
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance <= Math.max(1, Math.floor(name.length / 3)))
      scored.set(candidate, Math.min(scored.get(candidate) ?? distance, distance));
  }
  return [...scored]
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([candidate]) => candidate);
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
