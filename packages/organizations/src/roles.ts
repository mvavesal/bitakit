/**
 * Organization roles as an app configures them, most powerful first. The app passes them once:
 * `organizationsPlugin({ roles: ['owner', 'admin', 'publisher', 'editor', 'viewer'] })`, the same IDs as
 * its Better Auth `organization({ roles })`. Labels come from translations (`foundationUI.roles.<id>`),
 * never from code. The server still decides every change; these roles only drive the UI.
 */
export type OrganizationRoleKind = 'owner' | 'admin' | 'member';
export type OrganizationRole = {
  id: string;
  /** What the role means to the organization UI: `owner` (protected), `admin` (manages members), `member`. */
  kind: OrganizationRoleKind;
  /** False hides it from invitations and role changes (an alias or a role only the server grants). */
  assignable: boolean;
};
/** A role in `organizationsPlugin({ roles })`: its ID, or the ID with options. */
export type OrganizationRoleConfig =
  | string
  | { id: string; kind?: OrganizationRoleKind; assignable?: boolean };

/** Better Auth's default roles; apps without a `roles` option keep exactly this behavior. */
export const defaultOrganizationRoles: readonly OrganizationRole[] = Object.freeze([
  { id: 'owner', kind: 'owner', assignable: false },
  { id: 'admin', kind: 'admin', assignable: true },
  { id: 'member', kind: 'member', assignable: true },
]);

const rolePattern = /^[a-z][a-z0-9_-]{0,63}$/i;
/** Normalizes the configured list: `owner` and `admin` keep their meaning, everything else is a member role. */
export function organizationRoles(
  config?: readonly OrganizationRoleConfig[],
): readonly OrganizationRole[] {
  if (!config) return defaultOrganizationRoles;
  const roles = config.map((entry): OrganizationRole => {
    const id = typeof entry === 'string' ? entry : entry.id;
    if (!rolePattern.test(id)) throw new Error(`Invalid organization role "${id}".`);
    const kind =
      (typeof entry === 'object' && entry.kind) ||
      (id === 'owner' ? 'owner' : id === 'admin' ? 'admin' : 'member');
    const assignable =
      typeof entry === 'object' && entry.assignable !== undefined
        ? entry.assignable && kind !== 'owner'
        : kind !== 'owner';
    return { id, kind, assignable };
  });
  if (new Set(roles.map((role) => role.id)).size !== roles.length)
    throw new Error('Organization roles must be unique.');
  if (!roles.some((role) => role.assignable))
    throw new Error('At least one organization role must be assignable.');
  return Object.freeze(roles);
}
/** The strongest kind among a member's roles (Better Auth stores several comma-separated). */
export function roleKind(role: string, roles: readonly OrganizationRole[]): OrganizationRoleKind {
  const ids = role.split(',').map((value) => value.trim());
  const kinds = roles.filter((item) => ids.includes(item.id)).map((item) => item.kind);
  if (kinds.includes('owner') || ids.includes('owner')) return 'owner';
  if (kinds.includes('admin') || ids.includes('admin')) return 'admin';
  return 'member';
}
