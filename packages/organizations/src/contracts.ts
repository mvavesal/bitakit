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
export type OrganizationData = {
  organizations: readonly Organization[];
  activeId: string | null;
  members: readonly Member[];
  invitations: readonly Invitation[];
  canManage: boolean;
  canDelete?: boolean;
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
    role: 'member' | 'admin';
    resend?: boolean;
    expiresInDays?: number;
  }): Promise<void>;
  cancelInvitation(input: { organizationId: string; invitationId: string }): Promise<void>;
  updateRole(input: {
    organizationId: string;
    memberId: string;
    role: 'member' | 'admin';
  }): Promise<void>;
  removeMember(input: { organizationId: string; memberId: string }): Promise<void>;
}
