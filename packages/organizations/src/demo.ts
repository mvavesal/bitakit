async function logoData(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let data = '';
  for (const byte of bytes) data += String.fromCharCode(byte);
  return `data:${file.type};base64,${btoa(data)}`;
}
import type {
  OrganizationBackend,
  Organization,
  Member,
  Invitation,
  InvitationPolicy,
  OrganizationRole,
} from './contracts.js';
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
  // Base roles as an app would declare them; custom roles and policies per organization.
  const manage = { member: ['create', 'update', 'delete'], invitation: ['create', 'cancel'] };
  const baseRoles: OrganizationRole[] = [
    {
      id: 'owner',
      standard: 'owner',
      custom: false,
      permissions: {
        ...manage,
        organization: ['update', 'delete'],
        content: ['read', 'edit', 'publish'],
      },
    },
    {
      id: 'admin',
      standard: 'admin',
      custom: false,
      permissions: { ...manage, organization: ['update'], content: ['read', 'edit'] },
    },
    {
      id: 'member',
      standard: 'member',
      label: 'Editor',
      custom: false,
      permissions: { content: ['read', 'edit'] },
    },
  ];
  const customRoles = new Map<string, OrganizationRole[]>();
  const policies = new Map<string, InvitationPolicy>();
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
        roles: [...baseRoles, ...(customRoles.get(activeId) ?? [])],
        viewerPermissions: baseRoles[0]!.permissions,
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
    customRoles: {
      async create({ organizationId, role, permissions }) {
        scope(organizationId);
        const list = customRoles.get(organizationId) ?? [];
        if (baseRoles.some((item) => item.id === role) || list.some((item) => item.id === role))
          throw new Error('Role name taken');
        customRoles.set(organizationId, [...list, { id: role, custom: true, permissions }]);
      },
      async update({ organizationId, role, permissions }) {
        scope(organizationId);
        customRoles.set(
          organizationId,
          (customRoles.get(organizationId) ?? []).map((item) =>
            item.id === role ? { ...item, permissions } : item,
          ),
        );
      },
      async delete({ organizationId, role }) {
        scope(organizationId);
        customRoles.set(
          organizationId,
          (customRoles.get(organizationId) ?? []).filter((item) => item.id !== role),
        );
      },
    },
    invitationPolicy: {
      async load(organizationId) {
        scope(organizationId);
        return policies.get(organizationId) ?? { mode: 'any', domains: [] };
      },
      async save({ organizationId, policy }) {
        scope(organizationId);
        policies.set(organizationId, policy);
        return policy;
      },
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
