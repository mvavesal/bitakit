import { ActionGroup } from '@bitakit/ui/actions';
import type { MemberActionContext, InvitationActionContext } from './organizations/context';

export const actionGroups = {
  navigation: new ActionGroup<void>('navigation.main'),
  preferences: new ActionGroup<void>('account.preferences'),
  account: new ActionGroup<void>('account.commands'),
  member: new ActionGroup<MemberActionContext>('organization.member.menu'),
  invitation: new ActionGroup<InvitationActionContext>('organization.invitation.menu'),
};
