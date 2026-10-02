import { isOrganizationWebsite, organizationWebsiteError } from '@bitakit/organizations';
export { sessionOrganizationBackend } from './organization-session.js';
import type { BetterAuthClient } from './index.js';
import type { OrganizationBackend, Organization, Member, Invitation } from '@bitakit/organizations';

type Result<T> = Promise<{ data: T | null; error: unknown }>;
type AuthMember = {
  id: string;
  role: string;
  disabled?: boolean;
  createdAt?: Date | string;
  user: { name: string; email: string; image?: string | null };
};
/** Structural boundary supports an existing client configured with Better Auth's organization plugin. */
export interface BetterAuthOrganizationClient {
  $store?: BetterAuthClient['$store'];
  organization: {
    list(): Result<Array<Organization & { metadata?: unknown }>>;
    getOrganization?(): Result<{ id: string }>;
    getFullOrganization(): Result<{ id: string }>;
    getActiveMember(): Result<{ id?: string; role: string; disabled?: boolean }>;
    listMembers(input: {
      query: { organizationId: string; limit: number; offset: number };
    }): Result<{ members: AuthMember[]; total: number }>;
    listInvitations(input: { query: { organizationId: string } }): Result<
      Array<{
        id: string;
        email: string;
        role: string | null;
        status: string;
        createdAt?: Date | string;
        expiresAt?: Date | string;
      }>
    >;
    listUserInvitations?(): Result<
      Array<{
        id: string;
        email: string;
        role: string | null;
        status: string;
        organizationName: string;
        organizationId?: string;
        organizationLogo?: string | null;
        createdAt?: Date | string;
        expiresAt?: Date | string;
      }>
    >;
    acceptInvitation?(input: { invitationId: string }): Result<unknown>;
    rejectInvitation?(input: { invitationId: string }): Result<unknown>;
    setActive(input: { organizationId: string }): Result<unknown>;
    create(input: {
      name: string;
      slug: string;
      logo?: string;
      metadata?: Record<string, unknown>;
    }): Result<{ id: string }>;
    update?(input: {
      organizationId: string;
      data: {
        name: string;
        slug: string;
        logo?: string | null;
        metadata?: Record<string, unknown>;
      };
    }): Result<unknown>;
    delete?(input: { organizationId: string }): Result<unknown>;
    inviteMember(input: {
      organizationId: string;
      email: string;
      role: 'member' | 'admin';
      resend?: boolean;
    }): Result<unknown>;
    cancelInvitation(input: { invitationId: string }): Result<unknown>;
    updateMemberRole(input: {
      organizationId: string;
      memberId: string;
      role: 'member' | 'admin';
    }): Result<unknown>;
    removeMember(input: { organizationId: string; memberIdOrEmail: string }): Result<unknown>;
  };
}
async function value<T>(request: Result<T>): Promise<T> {
  const result = await request;
  if (result.error) throw result.error;
  if (result.data === null) throw new Error('Better Auth returned no data.');
  return result.data;
}
async function completed(request: Result<unknown>) {
  const result = await request;
  if (result.error) throw result.error;
}
/** No HTTP routes or credentials are invented. The server must enforce membership and permissions. */
export type OrganizationExtensions = {
  /** Host-supplied, authenticated server operation; never a client-side DB write. */
  setMemberDisabled?: OrganizationBackend['setMemberDisabled'];
  /** Optional server endpoint supporting per-invitation expiry. */
  invite?: OrganizationBackend['invite'];
  create?: OrganizationBackend['create'];
  update?: OrganizationBackend['update'];
  delete?: OrganizationBackend['delete'];
  list?: () => Promise<Organization[]>;
};
export function betterAuthOrganizations(
  client: BetterAuthOrganizationClient,
  extensions: OrganizationExtensions = {},
): OrganizationBackend {
  const api = client.organization;
  const activeOrganization = () =>
    api.getOrganization ? api.getOrganization() : api.getFullOrganization();

  return {
    setMemberDisabled: extensions.setMemberDisabled,
    customInvitationExpiry: !!extensions.invite,
    update:
      extensions.update ??
      (api.update
        ? async ({ organizationId, ...input }) => {
            const existing = (await value(api.list())).find((org) => org.id === organizationId);
            if (!existing) throw new Error('Organization is not accessible.');
            await completed(
              api.update!({
                organizationId,
                data: {
                  ...(await organizationDetails(input)),
                  metadata: { ...metadata(existing.metadata), website: input.website ?? '' },
                },
              }),
            );
          }
        : undefined),
    delete:
      extensions.delete ??
      (api.delete ? (id) => completed(api.delete!({ organizationId: id })) : undefined),
    acceptInvitation: api.acceptInvitation
      ? (invitationId) => completed(api.acceptInvitation!({ invitationId }))
      : undefined,
    rejectInvitation: api.rejectInvitation
      ? (invitationId) => completed(api.rejectInvitation!({ invitationId }))
      : undefined,
    subscribe(listener) {
      const session = client.$store?.atoms.session;
      if (!session) return () => {};
      let previous = session.get();
      return session.subscribe((current) => {
        if (current.data === previous.data && current.isPending === previous.isPending) return;
        previous = current;
        listener();
      });
    },
    async load() {
      const [organizations, incomingResult, active] = await Promise.all([
        extensions.list
          ? extensions.list()
          : value(api.list()).then((items) =>
              items.map((org) => ({
                ...org,
                website: String(metadata(org.metadata).website ?? ''),
              })),
            ),
        api.listUserInvitations?.(),
        activeOrganization(),
      ]);
      const verificationRequired =
        (incomingResult?.error as { code?: string } | undefined)?.code ===
        'EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION';
      if (incomingResult?.error && !verificationRequired) throw incomingResult.error;
      const incomingInvitations = (incomingResult?.data ?? []).map((item) => ({
        ...item,
        role: item.role ?? 'member',
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        expiresAt: item.expiresAt instanceof Date ? item.expiresAt.toISOString() : item.expiresAt,
      }));
      if (active.error) throw active.error;
      const empty = {
        organizations,
        activeId: null,
        members: [],
        invitations: [],
        canManage: false,
        incomingInvitations,
        incomingInvitationsError: verificationRequired
          ? 'Verify your email address to see invitations.'
          : undefined,
      };
      if (!active.data) return empty;
      const activeId = active.data.id;
      if (!organizations.some((org) => org.id === activeId))
        throw new Error('Active organization is not accessible.');
      const current = await value(api.getActiveMember());
      if (current.disabled) throw new Error('Membership is disabled.');
      const canManage = current.role
        .split(',')
        .some((role) => role === 'owner' || role === 'admin');
      const [members, invitations] = await Promise.all([
        (async () => {
          const members: Member[] = [];
          for (let offset = 0; ; ) {
            const page = await value(
              api.listMembers({ query: { organizationId: activeId, limit: 100, offset } }),
            );
            members.push(
              ...page.members.map((member) => ({
                id: member.id,
                role: member.role,
                disabled: member.disabled,
                createdAt:
                  member.createdAt instanceof Date
                    ? member.createdAt.toISOString()
                    : member.createdAt,
                name: member.user.name,
                image: member.user.image,
                email: member.user.email,
              })),
            );
            offset += page.members.length;
            if (offset >= page.total) break;
            if (!page.members.length) throw new Error('Incomplete member list.');
          }
          return members;
        })(),
        canManage
          ? value(api.listInvitations({ query: { organizationId: activeId } })).then((items) =>
              items.map((item) => ({
                ...item,
                role: item.role ?? 'member',
                createdAt:
                  item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
                expiresAt:
                  item.expiresAt instanceof Date ? item.expiresAt.toISOString() : item.expiresAt,
              })),
            )
          : Promise.resolve([] as Invitation[]),
      ]);
      // Another tab may have changed the active workspace during the requests.
      const latest = await activeOrganization();
      if (latest.error) throw latest.error;
      if (latest.data?.id !== activeId)
        throw new Error('Active organization changed during loading.');
      return {
        organizations,
        activeId,
        members,
        invitations,
        canManage,
        canDelete: current.role.split(',').includes('owner'),
        viewerMemberId: current.id,
        incomingInvitations,
        incomingInvitationsError: verificationRequired
          ? 'Verify your email address to see invitations.'
          : undefined,
      };
    },
    setActive: (id) => completed(api.setActive({ organizationId: id })),
    create:
      extensions.create ??
      (async (input) => {
        const created = await value(api.create(await organizationDetails(input)));
        await completed(api.setActive({ organizationId: created.id }));
      }),
    invite:
      extensions.invite ??
      ((input) => {
        if (input.expiresInDays !== undefined && input.expiresInDays !== 30)
          throw new Error('Custom invitation expiry requires a server extension.');
        const { expiresInDays: _expiry, ...body } = input;
        return completed(api.inviteMember(body));
      }),
    async cancelInvitation({ organizationId, invitationId }) {
      // Better Auth's cancel API takes only the invitation ID; verify the displayed scope first.
      const invitations = await value(api.listInvitations({ query: { organizationId } }));
      if (!invitations.some((item) => item.id === invitationId))
        throw new Error('Invitation is not in this organization.');
      await completed(api.cancelInvitation({ invitationId }));
    },
    updateRole: (input) => completed(api.updateMemberRole(input)),
    removeMember: ({ organizationId, memberId }) =>
      completed(api.removeMember({ organizationId, memberIdOrEmail: memberId })),
  };
}

function metadata(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return metadata(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
async function organizationDetails(input: import('@bitakit/organizations').OrganizationInput) {
  if (!isOrganizationWebsite(input.website ?? '')) throw new Error(organizationWebsiteError);
  let logo: string | undefined;
  if (input.logo) {
    if (
      input.logo.size > 2 * 1024 * 1024 ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(input.logo.type)
    )
      throw new Error('Invalid organization logo.');
    const bytes = new Uint8Array(await input.logo.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    logo = `data:${input.logo.type};base64,${btoa(binary)}`;
  } else if (input.removeLogo) logo = '';
  return {
    name: input.name,
    slug: input.slug,
    ...(logo !== undefined ? { logo } : {}),
    metadata: { website: input.website ?? '' },
  };
}
