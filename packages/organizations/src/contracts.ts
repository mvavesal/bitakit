import type { StandardRole } from '@bitakit/core';

export type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  website?: string;
};
export type OrganizationInput = {
  name: string;
  slug: string;
  website?: string;
  logo?: File;
  removeLogo?: boolean;
};
export type Member = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: string;
  createdAt?: string;
  disabled?: boolean;
};
export type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  expiresAt?: string;
};
export type IncomingInvitation = Invitation & {
  organizationName: string;
  organizationId?: string;
  organizationLogo?: string | null;
};
/** Operations per resource. Presentation data: the provider decides every change on the server. */
export type Permissions = Readonly<Record<string, readonly string[]>>;
/** A role an organization can use: the app's base roles and the organization's custom roles. */
export type OrganizationRole = {
  id: string;
  /** Default texts from the app's roles (`defineRoles`); translations override them. */
  label?: string;
  description?: string;
  /** The provider's built-in role it extends; `owner` is the creator role. */
  standard?: StandardRole;
  /** Created by the organization (provider-stored) rather than declared by the app. */
  custom: boolean;
  /** Its effective permissions, for presentation. */
  permissions: Permissions;
};
/** The organization's invitation domain policy as the provider stores it (ASCII domains). */
export type InvitationPolicy = {
  mode: 'any' | 'allowlist' | 'blocklist';
  domains: readonly {
    domain: string;
    includeSubdomains: boolean;
    /** Unicode form. */ display?: string;
  }[];
};
export type OrganizationData = {
  organizations: readonly Organization[];
  activeId: string | null;
  members: readonly Member[];
  invitations: readonly Invitation[];
  canManage: boolean;
  canDelete?: boolean;
  /** Available roles, in the app's declaration order then custom roles; absent: provider defaults. */
  roles?: readonly OrganizationRole[];
  /** The viewer's effective permissions in the active organization, for presentation. */
  viewerPermissions?: Permissions;
  viewerMemberId?: string;
  incomingInvitationsError?: string;
  incomingInvitations?: readonly IncomingInvitation[];
};
export interface OrganizationBackend {
  /** False when only the server-defined invitation lifetime is supported. */
  customInvitationExpiry?: boolean;
  /** Invalidate cached tenant data when the authenticated context changes. */
  subscribe?(listener: () => void): () => void;
  setMemberDisabled?(input: {
    organizationId: string;
    memberId: string;
    disabled: boolean;
  }): Promise<void>;
  acceptInvitation?(invitationId: string): Promise<void>;
  rejectInvitation?(invitationId: string): Promise<void>;
  update?(input: OrganizationInput & { organizationId: string }): Promise<void>;
  delete?(organizationId: string): Promise<void>;
  load(): Promise<OrganizationData>;
  setActive(id: string): Promise<void>;
  create(input: OrganizationInput): Promise<void>;
  invite(input: {
    organizationId: string;
    email: string;
    /** A role ID from `roles`; the provider checks it. */
    role: string;
    resend?: boolean;
    expiresInDays?: number;
  }): Promise<void>;
  cancelInvitation(input: { organizationId: string; invitationId: string }): Promise<void>;
  updateRole(input: { organizationId: string; memberId: string; role: string }): Promise<void>;
  /** Organization-created roles, when the provider supports them. */
  customRoles?: {
    create(input: {
      organizationId: string;
      role: string;
      permissions: Permissions;
    }): Promise<void>;
    update(input: {
      organizationId: string;
      role: string;
      permissions: Permissions;
    }): Promise<void>;
    delete(input: { organizationId: string; role: string }): Promise<void>;
  };
  /** The invitation domain policy, when the provider enforces one. */
  invitationPolicy?: {
    load(organizationId: string): Promise<InvitationPolicy>;
    save(input: { organizationId: string; policy: InvitationPolicy }): Promise<InvitationPolicy>;
  };
  removeMember(input: { organizationId: string; memberId: string }): Promise<void>;
}
