import { isOrganizationWebsite, organizationWebsiteError } from '../website.js';
import type {
  InvitationPolicy,
  OrganizationBackend,
  OrganizationData,
  OrganizationInput,
  OrganizationRole,
  Permissions,
} from '../contracts.js';

/** The provider's standard roles, used while a backend reports no roles of its own. */
export const standardOrganizationRoles: readonly OrganizationRole[] = Object.freeze([
  { id: 'owner', standard: 'owner', custom: false, permissions: {} },
  { id: 'admin', standard: 'admin', custom: false, permissions: {} },
  { id: 'member', standard: 'member', custom: false, permissions: {} },
]);
/** Whether `held` includes every operation of `needed` (presentation only; the server decides). */
const covers = (held: Permissions, needed: Permissions) =>
  Object.entries(needed).every(([resource, actions]) =>
    actions.every((action) => held[resource]?.includes(action)),
  );
const rolesOf = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
export type OrganizationSnapshot = OrganizationData & {
  pending: boolean;
  error: string | null;
  loaded: boolean;
};
export function createOrganizationService(backend: OrganizationBackend) {
  let state: OrganizationSnapshot = {
    organizations: [],
    activeId: null,
    members: [],
    invitations: [],
    canManage: false,
    pending: false,
    error: null,
    loaded: false,
  };
  const listeners = new Set<() => void>();
  let generation = 0;
  let disposed = false;
  let mutating = false;
  const update = (patch: Partial<OrganizationSnapshot>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  async function refresh() {
    if (disposed) throw new Error('Organization service is disposed.');
    const ticket = ++generation;
    update({ pending: true, error: null });
    try {
      const result = await backend.load();
      if (ticket === generation) update({ ...result, pending: false, loaded: true });
    } catch (error) {
      if (ticket === generation)
        update({
          pending: false,
          error: 'The organization data could not be loaded.',
          members: [],
          invitations: [],
          canManage: false,
        });
      throw error;
    }
  }
  async function mutate(operation: () => Promise<void>) {
    if (disposed || state.pending || mutating)
      throw new Error('Wait for the current operation to finish.');
    const ticket = generation;
    mutating = true;
    update({ pending: true, error: null });
    try {
      await operation();
      if (ticket === generation && !disposed) await refresh();
    } catch (error) {
      if (ticket === generation && !disposed)
        update({ pending: false, error: 'The change could not be saved.' });
      throw error;
    } finally {
      mutating = false;
    }
  }
  function active() {
    if (!state.activeId || !state.canManage) throw new Error('This action is not available.');
    return state.activeId;
  }
  const availableRoles = () => state.roles ?? standardOrganizationRoles;
  /** The creator role's ID (`standard: 'owner'`), protected by the provider. */
  const creatorRole = () =>
    availableRoles().find((role) => role.standard === 'owner')?.id ?? 'owner';
  const isCreator = (memberRole: string) => rolesOf(memberRole).includes(creatorRole());
  /**
   * Roles the viewer may hand out, for choices in the UI: never the creator role (ownership
   * transfer is its own flow) and, when the backend reports permissions, only roles the viewer's
   * effective permissions cover. The provider enforces the same rule on the server.
   */
  function assignableRoles(): readonly OrganizationRole[] {
    const roles = availableRoles().filter((role) => role.standard !== 'owner');
    if (!state.roles || !state.viewerPermissions) return state.canManage ? roles : [];
    const held = state.viewerPermissions;
    return roles.filter((role) => covers(held, role.permissions));
  }
  const assignable = (role: string) => {
    const ids = rolesOf(role);
    const allowed = assignableRoles().map((item) => item.id);
    return ids.length > 0 && ids.every((id) => allowed.includes(id));
  };
  const unsubscribe = backend.subscribe?.(() => {
    generation++;
    update({
      organizations: [],
      activeId: null,
      members: [],
      invitations: [],
      canManage: false,
      canDelete: false,
      loaded: false,
      incomingInvitations: [],
      incomingInvitationsError: undefined,
      viewerMemberId: undefined,
    });
    void refresh().catch(() => {});
  });
  return {
    get capabilities() {
      return {
        customInvitationExpiry: backend.customInvitationExpiry !== false,
        update: !!backend.update,
        delete: !!backend.delete,
        suspension: !!backend.setMemberDisabled,
        invitations: !!backend.acceptInvitation && !!backend.rejectInvitation,
        customRoles: !!backend.customRoles,
        invitationPolicy: !!backend.invitationPolicy,
      };
    },
    /** The organization's roles: the app's base roles and its custom roles. */
    get roles() {
      return availableRoles();
    },
    assignableRoles,
    /** The default role of an invitation: the assignable role extending `member`, if any. */
    get defaultRole() {
      return assignableRoles().find((role) => role.standard === 'member')?.id;
    },
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    setActive(id: string) {
      if (!state.organizations.some((org) => org.id === id))
        throw new Error('Unknown organization.');
      return mutate(async () => {
        update({ members: [], invitations: [], canManage: false });
        await backend.setActive(id);
      });
    },
    create(input: OrganizationInput) {
      if (!isOrganizationWebsite(input.website ?? '')) throw new Error(organizationWebsiteError);
      if (!input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
        throw new Error('Check the name and identifier.');
      return mutate(() =>
        backend.create({
          ...input,
          name: input.name.trim(),
          website: input.website?.trim(),
          slug: input.slug,
        }),
      );
    },
    invite(email: string, role?: string, expiresInDays = 30) {
      const organizationId = active();
      role ??= assignableRoles().find((item) => item.standard === 'member')?.id;
      if (!role || !assignable(role)) throw new Error('Invalid role.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error('Check the email address.');
      if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)
        throw new Error('Validity must be between 1 and 365 days.');
      return mutate(() =>
        backend.invite({ organizationId, email: email.trim().toLowerCase(), role, expiresInDays }),
      );
    },
    resend(invitationId: string) {
      const organizationId = active();
      const invitation = state.invitations.find(
        (item) => item.id === invitationId && item.status === 'pending',
      );
      if (!invitation) throw new Error('Invitation not available.');
      return mutate(() =>
        backend.invite({
          organizationId,
          email: invitation.email,
          role: invitation.role,
          resend: true,
        }),
      );
    },
    cancel(invitationId: string) {
      const organizationId = active();
      if (!state.invitations.some((item) => item.id === invitationId && item.status === 'pending'))
        throw new Error('Invitation not available.');
      return mutate(() => backend.cancelInvitation({ organizationId, invitationId }));
    },
    updateRole(memberId: string, role: string) {
      const organizationId = active();
      if (!assignable(role)) throw new Error('Invalid role.');
      if (!state.members.some((item) => item.id === memberId && !isCreator(item.role)))
        throw new Error('Member not available.');
      return mutate(() => backend.updateRole({ organizationId, memberId, role }));
    },
    remove(memberId: string) {
      const organizationId = active();
      if (!state.members.some((item) => item.id === memberId && !isCreator(item.role)))
        throw new Error('Member not available.');
      return mutate(() => backend.removeMember({ organizationId, memberId }));
    },
    update(input: OrganizationInput) {
      if (!isOrganizationWebsite(input.website ?? '')) throw new Error(organizationWebsiteError);
      const organizationId = active();
      if (!backend.update) throw new Error('Not supported.');
      if (!input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
        throw new Error('Check the name and identifier.');
      return mutate(() =>
        backend.update!({
          ...input,
          website: input.website?.trim(),
          name: input.name.trim(),
          organizationId,
        }),
      );
    },
    delete() {
      const organizationId = active();
      if (!state.canDelete || !backend.delete) throw new Error('Not available.');
      return mutate(() => backend.delete!(organizationId));
    },
    setDisabled(memberId: string, disabled: boolean) {
      const organizationId = active();
      const member = state.members.find((item) => item.id === memberId);
      if (
        !backend.setMemberDisabled ||
        !member ||
        memberId === state.viewerMemberId ||
        isCreator(member.role)
      )
        throw new Error('Member not available.');
      return mutate(() => backend.setMemberDisabled!({ organizationId, memberId, disabled }));
    },
    /** Creates an organization role; the provider checks the viewer holds what it grants. */
    createCustomRole(role: string, permissions: Permissions) {
      const organizationId = active();
      if (!backend.customRoles) throw new Error('Not supported.');
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(role) || availableRoles().some((item) => item.id === role))
        throw new Error('Choose a new role name: lowercase letters, digits and "-".');
      return mutate(() => backend.customRoles!.create({ organizationId, role, permissions }));
    },
    updateCustomRole(role: string, permissions: Permissions) {
      const organizationId = active();
      if (!backend.customRoles) throw new Error('Not supported.');
      if (!availableRoles().some((item) => item.id === role && item.custom))
        throw new Error('Only custom roles can be changed.');
      return mutate(() => backend.customRoles!.update({ organizationId, role, permissions }));
    },
    deleteCustomRole(role: string) {
      const organizationId = active();
      if (!backend.customRoles) throw new Error('Not supported.');
      if (!availableRoles().some((item) => item.id === role && item.custom))
        throw new Error('Only custom roles can be deleted.');
      return mutate(() => backend.customRoles!.delete({ organizationId, role }));
    },
    /** The active organization's invitation domain policy (members may read it). */
    async invitationPolicy(): Promise<InvitationPolicy> {
      if (!backend.invitationPolicy || !state.activeId) throw new Error('Not supported.');
      return backend.invitationPolicy.load(state.activeId);
    },
    /** Saves the policy; the provider validates it and checks the right to change it. */
    async saveInvitationPolicy(policy: InvitationPolicy): Promise<InvitationPolicy> {
      const organizationId = active();
      if (!backend.invitationPolicy) throw new Error('Not supported.');
      if (policy.mode === 'allowlist' && !policy.domains.length)
        throw new Error('An allowlist needs at least one domain.');
      let saved!: InvitationPolicy;
      await mutate(async () => {
        saved = await backend.invitationPolicy!.save({ organizationId, policy });
      });
      return saved;
    },
    accept(invitationId: string) {
      if (!backend.acceptInvitation || !invitationId) throw new Error('Invitation not available.');
      return mutate(() => backend.acceptInvitation!(invitationId));
    },
    reject(invitationId: string) {
      if (!backend.rejectInvitation || !invitationId) throw new Error('Invitation not available.');
      return mutate(() => backend.rejectInvitation!(invitationId));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      generation++;
      listeners.clear();
    },
  };
}
export type OrganizationService = ReturnType<typeof createOrganizationService>;
