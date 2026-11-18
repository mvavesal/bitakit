import type { PermissionCatalog } from '../permissions.js';
import type {
  Access,
  PermissionRequest,
  RequestIdentity,
  RequestMember,
  RequestUser,
} from '../request-context.js';

const levels = new Set(['public', 'user', 'organization']);
const show = (value: unknown) => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/**
 * The startup check of `access`: exactly one of the three levels, or `{ permission }` with at least
 * one resource, each a non-empty list of operation names. With a permission catalog, every
 * resource and operation must be declared. Returns the problem, or undefined.
 */
export function accessProblem(access: unknown, catalog: PermissionCatalog): string | undefined {
  if (access === undefined)
    return "needs access: 'public', 'user', 'organization' or { permission: { resource: ['operation'] } }.";
  if (typeof access === 'string')
    return levels.has(access)
      ? undefined
      : `has an unknown access ${show(access)}. Use 'public', 'user', 'organization' or { permission }.`;
  if (!access || typeof access !== 'object' || Array.isArray(access))
    return `has an invalid access ${show(access)}.`;
  const keys = Object.keys(access);
  if (keys.length !== 1 || keys[0] !== 'permission')
    return `has an invalid access ${show(access)}: an object holds only { permission }.`;
  const permission = (access as { permission: unknown }).permission;
  if (!permission || typeof permission !== 'object' || Array.isArray(permission))
    return "needs access.permission as a record: { permission: { resource: ['operation'] } }.";
  const resources = Object.entries(permission as Record<string, unknown>);
  if (!resources.length) return 'needs at least one resource in access.permission.';
  const declared = Object.keys(catalog);
  for (const [resource, operations] of resources) {
    if (
      !Array.isArray(operations) ||
      !operations.length ||
      operations.some((operation) => typeof operation !== 'string' || !operation)
    )
      return `needs a non-empty list of operation names for "${resource}" in access.permission.`;
    if (!declared.length) continue;
    const known = catalog[resource];
    if (!known)
      return `checks unknown permission resource "${resource}". Declared resources: ${declared.map((name) => `"${name}"`).join(', ')}.`;
    const unknown = operations.filter((operation: string) => !known.actions.includes(operation));
    if (unknown.length)
      return `checks unknown operations ${unknown.map((name: string) => `"${name}"`).join(', ')} of "${resource}" (declared: ${known.actions.map((name) => `"${name}"`).join(', ')}).`;
  }
  return undefined;
}

/** The provider's answer after normalization; never trusted as-is. */
export type Identity = {
  readonly user: RequestUser | null;
  readonly organization: { readonly id: string } | null;
  readonly member: RequestMember | null;
  readonly reason?: 'NO_ACTIVE_ORGANIZATION' | 'NOT_A_MEMBER';
  readonly can?: (permission: PermissionRequest) => boolean | Promise<boolean>;
};

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== '';
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
/**
 * A frozen copy with the named fields read once from the original and written into the copy, so
 * a getter (ORM model instances) or a non-enumerable field is never lost by the spread, and what
 * was checked is exactly what the operation receives.
 */
function copy<T>(value: Record<string, unknown>, fields: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...value };
  for (const [field, read] of Object.entries(fields))
    if (read === undefined) delete result[field];
    else result[field] = read;
  return Object.freeze(result) as T;
}

/**
 * A user only with a non-empty string `id`; an organization only with a user and a non-empty
 * `id`; a non-function `can` is dropped. Each declared field (`id`, `name`, `email`; the
 * organization's `id`; the member's `id` and `role`) is read once and checked on the value the
 * copy holds. Copies are frozen, so no interceptor or listener can change the identity in the
 * middle of a call.
 */
export function normalizeIdentity(raw: unknown): Identity {
  const value = (isObject(raw) ? raw : {}) as Record<string, unknown>;
  const rawUser = isObject(value.user) ? value.user : undefined;
  const userId = rawUser?.id;
  const user =
    rawUser && nonEmpty(userId)
      ? copy<RequestUser>(rawUser, { id: userId, name: rawUser.name, email: rawUser.email })
      : null;
  const rawOrganization = isObject(value.organization) ? value.organization : undefined;
  const organizationId = rawOrganization?.id;
  const organization =
    user && rawOrganization && nonEmpty(organizationId)
      ? copy<{ readonly id: string }>(rawOrganization, { id: organizationId })
      : null;
  const rawMember = isObject(value.member) ? value.member : undefined;
  const member =
    organization && rawMember
      ? copy<RequestMember>(rawMember, { id: rawMember.id, role: rawMember.role })
      : null;
  const reason =
    value.reason === 'NO_ACTIVE_ORGANIZATION' || value.reason === 'NOT_A_MEMBER'
      ? value.reason
      : undefined;
  const can =
    typeof value.can === 'function' ? (value.can.bind(value) as Identity['can']) : undefined;
  return { user, organization, member, reason, can };
}

/** `ctx.can`: only an answer `=== true` grants; a throw or anything else denies. */
export function permissionCheck(identity: Identity, report: (error: unknown) => void) {
  return async (permission: PermissionRequest): Promise<boolean> => {
    if (!identity.can) return false;
    try {
      return (await identity.can(permission)) === true;
    } catch (error) {
      report(error);
      return false;
    }
  };
}

export const isOrganizationAccess = (access: Access) => access !== 'public' && access !== 'user';

/** A system principal's name: lower-case words with dots or dashes (`billing.stripe-webhook`). */
export const systemPrincipalName = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;
/**
 * The identity of `server.system(name, options)`: `system:<name>` with `system: true`, the given
 * organization, and a permission check that grants exactly `permissions` – never more.
 */
export function systemIdentity(
  name: string,
  options: { organizationId?: string; permissions?: PermissionRequest } = {},
): Identity {
  const granted = (options.permissions ?? {}) as Readonly<Record<string, readonly string[]>>;
  return normalizeIdentity({
    user: { id: `system:${name}`, name, system: true },
    organization: options.organizationId ? { id: options.organizationId } : null,
    member: options.organizationId ? { role: 'system' } : null,
    can: (permission: PermissionRequest) =>
      Object.entries(permission as Readonly<Record<string, readonly string[]>>).every(
        ([resource, operations]) =>
          (operations ?? []).every((operation) => granted[resource]?.includes(operation) === true),
      ),
  });
}
