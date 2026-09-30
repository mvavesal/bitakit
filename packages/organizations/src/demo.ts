async function logoData(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let data = '';
  for (const byte of bytes) data += String.fromCharCode(byte);
  return `data:${file.type};base64,${btoa(data)}`;
}
import type { OrganizationBackend, Organization, Member, Invitation } from './contracts.js';
/** In-memory test backend. No authentication, persistence or email delivery. */
export function createDemoOrganizationBackend(): OrganizationBackend {
  let activeId = 'studio';
  let incoming = [
    {
      id: 'demo-incoming',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 6 * 86400000).toISOString(),
      email: 'alex@example.test',
      role: 'member',
      status: 'pending',
      organizationName: 'Partner Studio',
    },
  ];
  const organizations: Organization[] = [
    { id: 'studio', name: 'Studio Nord', slug: 'studio-nord' },
    { id: 'academy', name: 'Akademie West', slug: 'akademie-west' },
  ];
  const members = new Map<string, Member[]>(
    organizations.map((org) => [
      org.id,
      [{ id: `${org.id}-owner`, name: 'Alex', email: 'alex@example.test', role: 'owner' }],
    ]),
  );
  members
    .get('studio')!
    .push({ id: 'studio-member', name: 'Sam Beispiel', email: 'sam@example.test', role: 'member' });
  const invitations = new Map<string, Invitation[]>();
  const scope = (id: string) => {
    if (!organizations.some((org) => org.id === id)) throw new Error('Unknown organization');
  };
  return {
    async load() {
      return {
        organizations: [...organizations],
        activeId,
        members: [...(members.get(activeId) ?? [])],
        invitations: [...(invitations.get(activeId) ?? [])],
        canManage: activeId !== 'partner',
        canDelete: activeId !== 'partner',
        viewerMemberId: `${activeId}-owner`,
        incomingInvitations: [...incoming],
      };
    },
    async acceptInvitation(id) {
      if (!incoming.some((item) => item.id === id && item.status === 'pending'))
        throw new Error('Unavailable');
      incoming = incoming.filter((item) => item.id !== id);
      organizations.push({ id: 'partner', name: 'Partner Studio', slug: 'partner-studio' });
      members.set('partner', [
        { id: 'partner-member', name: 'Alex', email: 'alex@example.test', role: 'member' },
      ]);
    },
    async rejectInvitation(id) {
      if (!incoming.some((item) => item.id === id && item.status === 'pending'))
        throw new Error('Unavailable');
      incoming = incoming.filter((item) => item.id !== id);
    },
    async setActive(id) {
      scope(id);
      activeId = id;
    },
    async create(input) {
      if (organizations.some((org) => org.slug === input.slug)) throw new Error('Duplicate slug');
      const id = crypto.randomUUID();
      organizations.push({
        id,
        name: input.name,
        slug: input.slug,
        website: input.website,
        logo: input.logo ? await logoData(input.logo) : null,
      });
      members.set(id, [
        { id: crypto.randomUUID(), name: 'Alex', email: 'alex@example.test', role: 'owner' },
      ]);
      activeId = id;
    },
    async update({ organizationId, name, slug, website, logo, removeLogo }) {
      scope(organizationId);
      if (organizations.some((org) => org.id !== organizationId && org.slug === slug))
        throw new Error('Duplicate slug');
      const org = organizations.find((item) => item.id === organizationId)!;
      Object.assign(org, { name, slug, website });
      if (logo) org.logo = await logoData(logo);
      else if (removeLogo) org.logo = null;
    },
    async delete(id) {
      scope(id);
      organizations.splice(
        organizations.findIndex((item) => item.id === id),
        1,
      );
      members.delete(id);
      invitations.delete(id);
      activeId = organizations[0]?.id ?? '';
    },
    async invite({ organizationId, email, role, resend, expiresInDays = 30 }) {
      scope(organizationId);
      const list = invitations.get(organizationId) ?? [];
      const existing = list.find((item) => item.email === email && item.status === 'pending');
      if (existing && !resend) throw new Error('Already invited');
      if (!existing)
        list.push({
          id: crypto.randomUUID(),
          email,
          role,
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
        });
      invitations.set(organizationId, list);
    },
    async cancelInvitation({ organizationId, invitationId }) {
      scope(organizationId);
      invitations.set(
        organizationId,
        (invitations.get(organizationId) ?? []).filter((item) => item.id !== invitationId),
      );
    },
    async updateRole({ organizationId, memberId, role }) {
      scope(organizationId);
      members.set(
        organizationId,
        (members.get(organizationId) ?? []).map((item) =>
          item.id === memberId ? { ...item, role } : item,
        ),
      );
    },
    async setMemberDisabled({ organizationId, memberId, disabled }) {
      scope(organizationId);
      const member = members.get(organizationId)?.find((item) => item.id === memberId);
      if (!member || member.role === 'owner') throw new Error('Forbidden');
      members.set(
        organizationId,
        members
          .get(organizationId)!
          .map((item) => (item.id === memberId ? { ...item, disabled } : item)),
      );
    },
    async removeMember({ organizationId, memberId }) {
      scope(organizationId);
      members.set(
        organizationId,
        (members.get(organizationId) ?? []).filter((item) => item.id !== memberId),
      );
    },
  };
}
