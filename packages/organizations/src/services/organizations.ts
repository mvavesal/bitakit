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
    if (disposed) throw new Error('Organisations-Service ist beendet.');
    const ticket = ++generation;
    update({ pending: true, error: null });
    try {
      const result = await backend.load();
      if (ticket === generation) update({ ...result, pending: false, loaded: true });
    } catch (error) {
      if (ticket === generation)
        update({
          pending: false,
          error: 'Die Organisationsdaten konnten nicht geladen werden.',
          members: [],
          invitations: [],
          canManage: false,
        });
      throw error;
    }
  }
  async function mutate(operation: () => Promise<void>) {
    if (disposed || state.pending || mutating)
      throw new Error('Bitte warte auf den laufenden Vorgang.');
    const ticket = generation;
    mutating = true;
    update({ pending: true, error: null });
    try {
      await operation();
      if (ticket === generation && !disposed) await refresh();
    } catch (error) {
      if (ticket === generation && !disposed)
        update({ pending: false, error: 'Die Änderung konnte nicht gespeichert werden.' });
      throw error;
    } finally {
      mutating = false;
    }
  }
  function active() {
    if (!state.activeId || !state.canManage) throw new Error('Diese Aktion ist nicht verfügbar.');
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
        throw new Error('Unbekannte Organisation.');
      return mutate(async () => {
        update({ members: [], invitations: [], canManage: false });
        await backend.setActive(id);
      });
    },
    create(input: OrganizationInput) {
      if (!isOrganizationWebsite(input.website ?? '')) throw new Error(organizationWebsiteError);
      if (!input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
        throw new Error('Bitte prüfe Name und Kennung.');
      return mutate(() => backend.create({ ...input, name: input.name.trim(), website: input.website?.trim(), slug: input.slug }));
    },
    invite(email: string, role: 'member' | 'admin' = 'member', expiresInDays = 30) {
      const organizationId = active();
      if (role !== 'member' && role !== 'admin') throw new Error('Ungültige Rolle.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        throw new Error('Bitte prüfe die E-Mail-Adresse.');
      if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)
        throw new Error('Gültigkeit muss zwischen 1 und 365 Tagen liegen.');
      return mutate(() =>
        backend.invite({ organizationId, email: email.trim().toLowerCase(), role, expiresInDays }),
      );
    },
    resend(invitationId: string) {
      const organizationId = active();
      const invitation = state.invitations.find(
        (item) => item.id === invitationId && item.status === 'pending',
      );
      if (!invitation) throw new Error('Einladung nicht verfügbar.');
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
        throw new Error('Einladung nicht verfügbar.');
      return mutate(() => backend.cancelInvitation({ organizationId, invitationId }));
    },
    updateRole(memberId: string, role: 'member' | 'admin') {
      const organizationId = active();
      if (role !== 'member' && role !== 'admin') throw new Error('Ungültige Rolle.');
      if (
        !state.members.some(
          (item) => item.id === memberId && !item.role.split(',').includes('owner'),
        )
      )
        throw new Error('Mitglied nicht verfügbar.');
      return mutate(() => backend.updateRole({ organizationId, memberId, role }));
    },
    remove(memberId: string) {
      const organizationId = active();
      if (
        !state.members.some(
          (item) => item.id === memberId && !item.role.split(',').includes('owner'),
        )
      )
        throw new Error('Mitglied nicht verfügbar.');
      return mutate(() => backend.removeMember({ organizationId, memberId }));
    },
    update(input: OrganizationInput) {
      if (!isOrganizationWebsite(input.website ?? '')) throw new Error(organizationWebsiteError);
      const organizationId=active();
      if (!backend.update) throw new Error('Nicht unterstützt.');
      if (!input.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) throw new Error('Bitte prüfe Name und Kennung.');
      return mutate(()=>backend.update!({...input,website:input.website?.trim(),name:input.name.trim(),organizationId}));
    },
    delete() {
      const organizationId=active();
      if(!state.canDelete || !backend.delete) throw new Error('Nicht verfügbar.');
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
        throw new Error('Mitglied nicht verfügbar.');
      return mutate(() => backend.setMemberDisabled!({ organizationId, memberId, disabled }));
    },
    accept(invitationId: string) {
      if (!backend.acceptInvitation || !invitationId) throw new Error('Einladung nicht verfügbar.');
      return mutate(() => backend.acceptInvitation!(invitationId));
    },
    reject(invitationId: string) {
      if (!backend.rejectInvitation || !invitationId) throw new Error('Einladung nicht verfügbar.');
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
