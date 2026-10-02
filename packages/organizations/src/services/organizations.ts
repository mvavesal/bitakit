import { isOrganizationWebsite, organizationWebsiteError } from '../website.js';
import type { OrganizationBackend, OrganizationData, OrganizationInput } from '../contracts.js';
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
    get capabilities() { return {
      customInvitationExpiry: backend.customInvitationExpiry !== false,
      update: !!backend.update,
      delete: !!backend.delete,
      suspension: !!backend.setMemberDisabled,
      invitations: !!backend.acceptInvitation && !!backend.rejectInvitation,
    }; },
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
      return mutate(() => backend.create({ ...input, name: input.name.trim(), website: input.website?.trim(), slug: input.slug }));
    },
    invite(email: string, role: 'member' | 'admin' = 'member', expiresInDays = 30) {
      const organizationId = active();
      if (role !== 'member' && role !== 'admin') throw new Error('Invalid role.');
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
          role: invitation.role === 'admin' ? 'admin' : 'member',
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
    updateRole(memberId: string, role: 'member' | 'admin') {
      const organizationId = active();
      if (role !== 'member' && role !== 'admin') throw new Error('Invalid role.');
      if (
        !state.members.some(
          (item) => item.id === memberId && !item.role.split(',').includes('owner'),
        )
      )
        throw new Error('Member not available.');
      return mutate(() => backend.updateRole({ organizationId, memberId, role }));
    },
    remove(memberId: string) {
      const organizationId = active();
      if (
        !state.members.some(
          (item) => item.id === memberId && !item.role.split(',').includes('owner'),
        )
      )
        throw new Error('Member not available.');
      return mutate(() => backend.removeMember({ organizationId, memberId }));
    },
    update(input: OrganizationInput) {
      if (!isOrganizationWebsite(input.website ?? '')) throw new Error(organizationWebsiteError);
      const organizationId=active();
      if (!backend.update) throw new Error('Not supported.');
      if (!input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new Error('Check the name and identifier.');
      return mutate(()=>backend.update!({...input,website:input.website?.trim(),name:input.name.trim(),organizationId}));
    },
    delete() {
      const organizationId=active();
      if(!state.canDelete || !backend.delete) throw new Error('Not available.');
      return mutate(()=>backend.delete!(organizationId));
    },
    setDisabled(memberId: string, disabled: boolean) {
      const organizationId = active();
      const member = state.members.find((item) => item.id === memberId);
      if (
        !backend.setMemberDisabled ||
        !member ||
        memberId === state.viewerMemberId ||
        member.role.split(',').includes('owner')
      )
        throw new Error('Member not available.');
      return mutate(() => backend.setMemberDisabled!({ organizationId, memberId, disabled }));
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
