import type { ConfigContext } from '../config-service.js';
import type { InputSchema, Plugin } from '../definitions.js';
import { contributionPath, contributionSource } from '../contribution-origin.js';
import type { Events } from '../events/types.js';
import { pluginOrigin } from '../inspection/plugin-origin.js';
import { isServiceInterceptor, type InterceptorTarget } from '../interceptors/define.js';
import { resolveName } from '../name-resolution.js';
import { composePermissions, type PermissionCatalog } from '../permissions.js';
import type { Access, PermissionRequest, RequestContext } from '../request-context.js';
import { reservedSegmentOf, reservedSegments } from '../remote.js';
import type { NormalizedPlugin } from '../runtime.js';
import type { ServerStartParts } from '../runtime-mode.js';
import { BitaKitStartupError, moduleLabel } from '../startup-error.js';
import { accessProblem, isOrganizationAccess } from './access.js';
import type { OperationInfo, ServerInterceptorSpec } from './types.js';
import { isSchema } from './validate.js';

type Hook<K extends 'before' | 'after' | 'onError'> = {
  readonly run: NonNullable<ServerInterceptorSpec[K]>;
  readonly module: string;
};
/** One server Action, compiled once at boot. Frozen; calls never mutate it. */
export type Operation = {
  readonly id: string;
  readonly module: string;
  readonly source?: string;
  /** The file path segments that scope `config.action`. */
  readonly path: readonly string[];
  readonly requires?: readonly string[];
  readonly access: Access;
  readonly organization: boolean;
  readonly permission?: PermissionRequest;
  readonly exposed: boolean;
  readonly input?: InputSchema<unknown>;
  readonly output?: InputSchema<unknown>;
  readonly execute: (context: object) => unknown;
  readonly info: OperationInfo;
  // Linked when the runtime starts:
  config: ConfigContext;
  events: { readonly events: Events; withContext(ctx: RequestContext): Events };
  before: readonly Hook<'before'>[];
  after: readonly Hook<'after'>[];
  onError: readonly Hook<'onError'>[];
};
export type OperationTable = {
  readonly exact: ReadonlyMap<string, Operation>;
  readonly folded: ReadonlyMap<string, Operation>;
  readonly all: readonly Operation[];
};

const clientOnlyFields = [
  'enabled',
  'visible',
  'href',
  'dialog',
  'dialogSize',
  'confirm',
  'slots',
  'groups',
  'order',
  'dividerBefore',
  'shortcut',
  'icon',
  'tooltip',
  'variant',
  'checked',
  'value',
  'concurrency',
  'concurrencyKey',
  'success',
  'failure',
  'internal',
] as const;

/** Server Actions print as `server:<id>` in every message. */
export const label = (id: string) => `server:${id}`;

function startupError(
  id: string,
  module: string,
  appId: string,
  problem: string,
  source: string | undefined,
) {
  return new BitaKitStartupError(
    `${label(id)} in ${moduleLabel(module, appId)} ${problem}${source ? `\nSource: ${source}` : ''}`,
    module,
    { source, app: module === appId },
  );
}

/**
 * The static half of compilation, before any service starts: field rules, `access`, `expose`,
 * schemas, duplicate IDs (exact or equal ignoring case), exposure and the `requestContext`
 * provider check. Every problem is a `BitaKitStartupError` naming the operation and its file.
 */
export function compileOperations(
  modules: readonly NormalizedPlugin[],
  plugins: readonly Plugin[],
  appId: string,
  options: {
    providers: readonly string[];
    operations?: readonly string[];
    publish?: readonly string[];
  },
): OperationTable {
  let catalog: PermissionCatalog;
  try {
    catalog = composePermissions(
      modules
        .filter((module) => module.permissions !== undefined)
        .map((module) => ({ owner: module.id, definition: module.permissions! })),
    );
  } catch {
    catalog = {}; // The runtime constructor already reported the catalog's own problems.
  }
  const exact = new Map<string, Operation>();
  const folded = new Map<string, Operation>();
  const known = options.operations ? new Set(options.operations) : undefined;
  for (const module of modules) {
    const original = plugins.find((plugin) => plugin.id === module.id);
    // A package's operations go over HTTP only once the app publishes them (ServerOptions.publish).
    const local = module.id === appId || pluginOrigin(original)?.kind !== 'package';
    for (const spec of module.actions) {
      const id = spec.id;
      const source = contributionSource(spec);
      const fail = (problem: string) => startupError(id, module.id, appId, problem, source);
      const fields = spec as Record<string, unknown>;
      const clientField = clientOnlyFields.find((field) => fields[field] !== undefined);
      if (clientField)
        throw fail(
          `has the client-only field "${clientField}". It belongs to the button (actions/${(contributionPath(spec) ?? id.split('.')).join('/')}.ts), not the operation.`,
        );
      const problem = accessProblem(fields.access, catalog);
      if (problem) throw fail(problem);
      if (fields.expose !== undefined && typeof fields.expose !== 'boolean')
        throw fail(`has expose ${JSON.stringify(fields.expose)}; use true or false.`);
      for (const field of ['input', 'output'] as const)
        if (fields[field] !== undefined && !isSchema(fields[field]))
          throw fail(`has an ${field} that is not a schema (zod, valibot or a Standard Schema).`);
      if (typeof spec.execute !== 'function') throw fail('needs execute({ input, ctx, ... }).');
      const reserved = reservedSegmentOf(id);
      if (reserved !== undefined)
        throw fail(
          `uses the reserved name "${reserved}"; ${[...reservedSegments].join(', ')} cannot name a server Action, because remote and the in-process caller would turn them into thenable, observable or converting objects. Rename the file (or its record key).`,
        );
      const twin = folded.get(id.toLowerCase());
      if (twin)
        throw new BitaKitStartupError(
          `Duplicate server Action ID${twin.id === id ? '' : ' (equal ignoring case)'}: ${label(twin.id)} in ${moduleLabel(twin.module, appId)} (${twin.source ?? 'no file'}) and ${label(id)} in ${moduleLabel(module.id, appId)} (${source ?? 'no file'}). Rename one of them.`,
          module.id,
          { source, app: module.id === appId },
        );
      const access = freezeAccess(fields.access as Access);
      const exposed =
        fields.expose === true &&
        (local ||
          (options.publish ?? []).some(
            (item) => item === id || (item.endsWith('.*') && id.startsWith(item.slice(0, -1))),
          ));
      if (exposed && known && !known.has(id))
        console.warn(
          `[bitakit] ${label(id)} is exposed over HTTP but missing from the generated remote; discovery could not read its definition statically${source ? ` (${source})` : ''}.`,
        );
      const operation: Operation = {
        id,
        module: module.id,
        source,
        path: contributionPath(spec) ?? id.split('.'),
        requires: spec.requires,
        access,
        organization: isOrganizationAccess(access),
        permission: typeof access === 'object' ? access.permission : undefined,
        exposed,
        input: fields.input as InputSchema<unknown> | undefined,
        output: fields.output as InputSchema<unknown> | undefined,
        execute: spec.execute as (context: object) => unknown,
        info: Object.freeze({
          id,
          plugin: module.id,
          access,
          exposed,
          ...(typeof spec.title === 'string' ? { title: spec.title } : {}),
          ...(typeof spec.description === 'string' ? { description: spec.description } : {}),
          ...(source ? { source } : {}),
        }),
        config: undefined as never,
        events: undefined as never,
        before: [],
        after: [],
        onError: [],
      };
      exact.set(id, operation);
      folded.set(id.toLowerCase(), operation);
    }
  }
  const all = [...exact.values()];
  const guarded = all.find((operation) => operation.access !== 'public');
  if (guarded && !options.providers.length)
    throw startupError(
      guarded.id,
      guarded.module,
      appId,
      `needs a signed-in caller (access ${JSON.stringify(guarded.access)}), but no service provides requestContext. Add src/server/services/request-context.ts with provides: requestContext.`,
      guarded.source,
    );
  return { exact, folded, all };
}

function freezeAccess(access: Access): Access {
  if (typeof access === 'string') return access;
  return Object.freeze({
    permission: Object.freeze(
      Object.fromEntries(
        Object.entries(access.permission).map(([resource, operations]) => [
          resource,
          Object.freeze([...(operations as readonly string[])]),
        ]),
      ),
    ),
  }) as Access;
}

/**
 * The dynamic half, called by the server-mode runtime once its services exist: `requires`
 * checks, config scopes, event scopes and the interceptor chain of each operation (exact IDs,
 * `prefix.*` and `*`; plugin-local unless global, ordered by `order` like on the client).
 */
export function linkOperations(table: OperationTable, parts: ServerStartParts) {
  const ids = table.all.map((operation) => operation.id);
  const prefixes = new Set(
    ids.flatMap((id) =>
      id
        .split('.')
        .slice(0, -1)
        .map((_, index, all) => all.slice(0, index + 1).join('.')),
    ),
  );
  const interceptors = parts.modules
    .flatMap((module) => (module.interceptors ?? []).map((spec) => ({ spec, module: module.id })))
    .filter(({ spec }) => !isServiceInterceptor(spec))
    .sort((a, b) => (a.spec.order ?? 0) - (b.spec.order ?? 0))
    .map(({ spec, module }) => {
      const definition = spec as ServerInterceptorSpec;
      const source = contributionSource(spec);
      try {
        parts.require(module, definition.requires, {
          label: `A server interceptor in ${moduleLabel(module, parts.appId)}`,
          source,
        });
        return {
          definition,
          module,
          global:
            definition.scope === 'global' ||
            (module === parts.appId && definition.scope !== 'plugin'),
          matches: matcher(definition.action ?? '*', ids, prefixes),
        };
      } catch (error) {
        throw parts.attribute(error, module, 'Server interceptor', source);
      }
    });
  for (const operation of table.all) {
    try {
      parts.require(operation.module, operation.requires, {
        label: label(operation.id),
        source: operation.source,
      });
      operation.config = parts.config(operation.module, operation.path);
      operation.events = parts.events(operation.module);
    } catch (error) {
      throw parts.attribute(error, operation.module, label(operation.id), operation.source);
    }
    const chain = interceptors.filter(
      (entry) => (entry.global || entry.module === operation.module) && entry.matches(operation.id),
    );
    operation.before = hooks(chain, 'before');
    operation.after = hooks(chain, 'after');
    operation.onError = hooks(chain, 'onError');
    Object.freeze(operation);
  }
}

function hooks<K extends 'before' | 'after' | 'onError'>(
  chain: readonly { definition: ServerInterceptorSpec; module: string }[],
  kind: K,
): Hook<K>[] {
  return chain.flatMap(({ definition, module }) => {
    const run = definition[kind];
    return typeof run === 'function'
      ? [{ run: run.bind(definition) as NonNullable<ServerInterceptorSpec[K]>, module }]
      : [];
  });
}

/** Resolves each pattern once against every operation, so matching per operation is O(1). */
function matcher(target: InterceptorTarget, ids: readonly string[], prefixes: ReadonlySet<string>) {
  const patterns = typeof target === 'string' ? [target] : target;
  const tests = patterns.map((pattern) => {
    if (pattern === '*') return () => true;
    if (pattern.endsWith('.*')) {
      const prefix = `${resolveName(pattern.slice(0, -2), prefixes)}.`;
      return (id: string) => id.startsWith(prefix);
    }
    const exact = resolveName(pattern, ids);
    return (id: string) => id === exact;
  });
  return (id: string) => tests.some((test) => test(id));
}
