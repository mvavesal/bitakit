import { ActionGroup } from '@bitakit/core';
export type OrganizationContext = { organizationId: string | null };
export type MemberContext = OrganizationContext & { memberId: string };
export type InvitationContext = OrganizationContext & { invitationId: string };
/** Public extension points. Context is checked again by the executing service. */
export const organizationGroups = {
  management: new ActionGroup<OrganizationContext>('organizations.management'),
  danger: new ActionGroup<OrganizationContext>('organizations.danger'),
  incoming: new ActionGroup<InvitationContext>('organizations.incoming'),
  toolbar: new ActionGroup<OrganizationContext>('organizations.toolbar'),
  organization: new ActionGroup<OrganizationContext>('organizations.organization'),
  members: new ActionGroup<OrganizationContext>('organizations.members'),
  member: new ActionGroup<MemberContext>('organizations.member'),
  invitation: new ActionGroup<InvitationContext>('organizations.invitation'),
};
