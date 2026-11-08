// Roles and permissions as configuration (0.3). Core owns only the vocabulary: the declaration shapes, their
// validation and the composed catalog. It has no provider dependency, stores nothing and authorizes nothing; an
// authorization provider (for example the Better Auth adapter) translates the declarations into its own configuration
// and remains the authority on every check.

const identifier = /^[a-z][a-zA-Z0-9-]*$/;
const show = (values: readonly string[]) => values.map((value) => `"${value}"`).join(', ');

/**
 * Resources and their operations a plugin owns, for example `{ content: ['read', 'edit', 'publish'] }`.
 * Generated declarations extend it, so role grants are typed against the discovered catalog.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PermissionMap {}
/** Role IDs of the app's `roles.ts`; generated declarations extend it. */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RoleMap {}

export type PermissionSpec = Readonly<Record<string, readonly string[]>>;
export type PermissionsDefinition<Spec extends PermissionSpec = PermissionSpec> = {
  readonly kind: 'permissions';
  readonly permissions: Spec;
  /** Project-relative file, set by discovery for diagnostics. */
  readonly source?: string;
};

/**
 * Declares the resources and operations a plugin owns, in its `permissions.ts`. A plugin declares
 * capabilities only; which roles receive them is the app's decision in `roles.ts`.
 */
export function definePermissions<const Spec extends PermissionSpec>(
  permissions: Spec,
): PermissionsDefinition<Spec> {
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions))
    throw new Error(
      "definePermissions expects a record: definePermissions({ content: ['read', 'edit'] }).",
    );
  const resources = Object.keys(permissions);
  if (!resources.length) throw new Error('definePermissions needs at least one resource.');
  for (const resource of resources) {
    if (!identifier.test(resource))
      throw new Error(
        `Invalid permission resource "${resource}". Start with a lowercase letter; use letters, digits and "-".`,
      );
    const actions = permissions[resource];
    if (!Array.isArray(actions) || !actions.length)
      throw new Error(`Permission resource "${resource}" needs a non-empty list of operations.`);
    for (const action of actions)
      if (typeof action !== 'string' || !identifier.test(action))
        throw new Error(
          `Invalid operation "${String(action)}" of permission resource "${resource}". Start with a lowercase letter; use letters, digits and "-".`,
        );
    if (new Set(actions).size !== actions.length)
      throw new Error(`Permission resource "${resource}" lists an operation twice.`);
  }
  return Object.freeze({
    kind: 'permissions',
    permissions: Object.freeze(
      Object.fromEntries(
        resources.map((resource) => [resource, Object.freeze([...permissions[resource]!])]),
      ),
    ) as Spec,
  });
}
export function isPermissionsDefinition(value: unknown): value is PermissionsDefinition {
  return (
    !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'permissions'
  );
}

/** A provider's built-in organization roles a base role can extend. */
export type StandardRole = 'owner' | 'admin' | 'member';
export const standardRoles: readonly StandardRole[] = Object.freeze(['owner', 'admin', 'member']);
type KnownGrants = keyof PermissionMap extends never
  ? Readonly<Record<string, readonly string[]>>
  : { readonly [Resource in keyof PermissionMap]?: readonly PermissionMap[Resource][] };
export type RoleSpec = {
  /** Extends the provider's built-in role with the explicit grants below. */
  readonly standard?: StandardRole;
  /** Default label; a translation `roles.<id>.label` wins. */
  readonly label?: string;
  /** Default explanation; a translation `roles.<id>.description` wins. */
  readonly description?: string;
  /** Operations per resource this role receives, from the discovered permission catalog. */
  readonly grants?: KnownGrants;
};
export type RolesOptions = {
  /** Let organizations create their own roles through the provider's dynamic roles. */
  readonly customRoles?: boolean;
};
export type RolesDefinition<
  Roles extends Readonly<Record<string, RoleSpec>> = Readonly<Record<string, RoleSpec>>,
> = {
  readonly kind: 'roles';
  /** In declaration order: display order only, never a permission hierarchy. */
  readonly roles: Roles;
  readonly options: RolesOptions;
  /** Project-relative file, set by discovery for diagnostics. */
  readonly source?: string;
};

/**
 * Declares the app's base roles in `src/roles.ts`. Roles are app configuration: plugins declare
 * permissions, never roles, and base roles are read-only for organizations.
 */
export function defineRoles<const Roles extends Readonly<Record<string, RoleSpec>>>(
  roles: Roles,
  options: RolesOptions = {},
): RolesDefinition<Roles> {
  if (!roles || typeof roles !== 'object' || Array.isArray(roles))
    throw new Error(
      "defineRoles expects a record: defineRoles({ viewer: { grants: { content: ['read'] } } }).",
    );
  const ids = Object.keys(roles);
  if (!ids.length) throw new Error('defineRoles needs at least one role.');
  const standards = new Map<string, string>();
  for (const id of ids) {
    if (!identifier.test(id))
      throw new Error(
        `Invalid role "${id}". Start with a lowercase letter; use letters, digits and "-".`,
      );
    const spec = roles[id] as RoleSpec;
    if (!spec || typeof spec !== 'object' || Array.isArray(spec))
      throw new Error(`Role "${id}" must be an object, for example { grants: { ... } }.`);
    const unknownKeys = Object.keys(spec).filter(
      (key) => !['standard', 'label', 'description', 'grants'].includes(key),
    );
    if (unknownKeys.length)
      throw new Error(
        `Role "${id}" has unknown fields ${show(unknownKeys)}. Use standard, label, description and grants.`,
      );
    if (spec.standard !== undefined) {
      if (!standardRoles.includes(spec.standard))
        throw new Error(
          `Role "${id}" extends unknown standard role "${String(spec.standard)}". Use ${show(standardRoles)}.`,
        );
      const other = standards.get(spec.standard);
      if (other)
        throw new Error(
          `Roles "${other}" and "${id}" both extend the standard role "${spec.standard}". Each standard role is extended once.`,
        );
      standards.set(spec.standard, id);
    }
    for (const field of ['label', 'description'] as const)
      if (spec[field] !== undefined && (typeof spec[field] !== 'string' || !spec[field]!.trim()))
        throw new Error(`The ${field} of role "${id}" must be a non-empty text.`);
    if (spec.grants !== undefined) {
      if (!spec.grants || typeof spec.grants !== 'object' || Array.isArray(spec.grants))
        throw new Error(`The grants of role "${id}" must be a record of operation lists.`);
      for (const [resource, actions] of Object.entries(
        spec.grants as Record<string, readonly string[]>,
      )) {
        if (!Array.isArray(actions) || !actions.length)
          throw new Error(
            `Role "${id}" grants "${resource}" without operations. List them or remove the resource.`,
          );
        if (new Set(actions).size !== actions.length)
          throw new Error(`Role "${id}" grants an operation of "${resource}" twice.`);
      }
    }
  }
  if (options.customRoles !== undefined && typeof options.customRoles !== 'boolean')
    throw new Error('defineRoles: the customRoles option is true or false.');
  return Object.freeze({
    kind: 'roles',
    roles: Object.freeze(
      Object.fromEntries(
        ids.map((id) => {
          const spec = roles[id] as RoleSpec;
          return [
            id,
            Object.freeze({
              ...spec,
              ...(spec.grants
                ? {
                    grants: Object.freeze(
                      Object.fromEntries(
                        Object.entries(spec.grants as Record<string, readonly string[]>).map(
                          ([resource, actions]) => [resource, Object.freeze([...actions])],
                        ),
                      ),
                    ),
                  }
                : {}),
            }),
          ];
        }),
      ),
    ) as Roles,
    options: Object.freeze({ ...options }),
  });
}
export function isRolesDefinition(value: unknown): value is RolesDefinition {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'roles';
}

/** Generated typing: the resources and operations of one `permissions.ts`. */
export type PermissionsOf<T> =
  T extends PermissionsDefinition<infer Spec>
    ? { -readonly [Resource in keyof Spec]: Spec[Resource][number] }
    : {};
/** Generated typing: the role IDs of the app's `roles.ts`. */
export type RoleIdsOf<T> =
  T extends RolesDefinition<infer Roles> ? { -readonly [Id in keyof Roles]: true } : {};

/** One resource of the composed catalog with its owning module. */
export type PermissionResource = {
  readonly owner: string;
  readonly source?: string;
  readonly actions: readonly string[];
};
export type PermissionCatalog = Readonly<Record<string, PermissionResource>>;
/** Configuration errors of roles and permissions, collected so every problem is reported at once. */
export class AccessConfigurationError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Roles and permissions are misconfigured:\n- ${problems.join('\n- ')}`);
    this.name = 'AccessConfigurationError';
    this.problems = problems;
  }
}
const where = (owner: string, source?: string) =>
  source ? `"${owner}" (${source})` : `"${owner}"`;

/**
 * Composes the modules' permission declarations into one catalog. A resource has exactly one
 * owning module; a second claim is an error, never resolved by order or merging.
 */
export function composePermissions(
  declarations: readonly { owner: string; definition: PermissionsDefinition }[],
): PermissionCatalog {
  const catalog: Record<string, PermissionResource> = Object.create(null);
  const problems: string[] = [];
  for (const { owner, definition } of declarations) {
    if (!isPermissionsDefinition(definition)) {
      problems.push(
        `${where(owner, (definition as { source?: string })?.source)} must default-export definePermissions({ ... }) in permissions.ts.`,
      );
      continue;
    }
    for (const [resource, actions] of Object.entries(definition.permissions)) {
      const claimed = catalog[resource];
      if (claimed) {
        problems.push(
          `Permission resource "${resource}" is declared by ${where(claimed.owner, claimed.source)} and ${where(owner, definition.source)}. A resource has one owning plugin: rename one resource, or keep it in one plugin and use it from the other.`,
        );
        continue;
      }
      catalog[resource] = Object.freeze({ owner, source: definition.source, actions });
    }
  }
  if (problems.length) throw new AccessConfigurationError(problems);
  return Object.freeze(catalog);
}

/**
 * Checks the app's base roles against the catalog: every granted resource and operation must be
 * declared. Returns the problems instead of fixing anything.
 */
export function roleProblems(roles: RolesDefinition, catalog: PermissionCatalog): string[] {
  const problems: string[] = [];
  const file = roles.source ? ` in ${roles.source}` : '';
  const known = Object.keys(catalog);
  for (const [id, spec] of Object.entries(roles.roles)) {
    for (const [resource, actions] of Object.entries(
      (spec.grants ?? {}) as Record<string, readonly string[]>,
    )) {
      const declared = catalog[resource];
      if (!declared) {
        problems.push(
          `Role "${id}"${file} grants unknown resource "${resource}". Declared resources: ${known.length ? show(known) : 'none'}. Fix the grant or declare the resource in the owning plugin's permissions.ts.`,
        );
        continue;
      }
      const unknown = actions.filter((action) => !declared.actions.includes(action));
      if (unknown.length)
        problems.push(
          `Role "${id}"${file} grants unknown operations ${show(unknown)} of "${resource}" (declared by ${where(declared.owner, declared.source)}: ${show(declared.actions)}).`,
        );
    }
  }
  return problems;
}

/** Composed, validated access configuration: the permission catalog and the app's base roles. */
export type AccessConfiguration = {
  readonly permissions: PermissionCatalog;
  readonly roles?: RolesDefinition;
};
/** Composes and validates everything at once; throws one error listing every problem. */
export function composeAccessConfiguration(input: {
  permissions: readonly { owner: string; definition: PermissionsDefinition }[];
  roles?: RolesDefinition;
}): AccessConfiguration {
  const permissions = composePermissions(input.permissions);
  if (input.roles !== undefined && !isRolesDefinition(input.roles))
    throw new AccessConfigurationError([
      `${(input.roles as { source?: string })?.source ?? 'roles.ts'} must default-export defineRoles({ ... }).`,
    ]);
  const problems = input.roles ? roleProblems(input.roles, permissions) : [];
  if (problems.length) throw new AccessConfigurationError(problems);
  return Object.freeze({ permissions, ...(input.roles ? { roles: input.roles } : {}) });
}
