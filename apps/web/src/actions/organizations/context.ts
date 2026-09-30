export type MemberActionContext = {
  organizationId: string;
  member: { id: string; name: string; role: string; disabled: boolean };
  canManage: boolean;
  refresh: () => void;
};
export type InvitationActionContext = {
  organizationId: string;
  invitation: { id: string; email: string };
  canInvite: boolean;
  refresh: () => void;
};
