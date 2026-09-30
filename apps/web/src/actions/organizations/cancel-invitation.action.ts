import { actionGroups } from '../groups';
import { Action } from '@bitakit/ui/actions';
import CancelIcon from 'reicon-react/icons/Xmark';
import { authClient } from '@/lib/auth-client';
import { notify } from '@/lib/notifications';
import type { InvitationActionContext } from './context';

export default class CancelInvitationAction extends Action<InvitationActionContext> {
  constructor() {
    super({
      id: 'invitation.cancel',
      title: 'Organizations.cancelInvitation',
      groups: [actionGroups.invitation],
      order: 10,
      icon: CancelIcon,
      variant: 'destructive',
    });
  }
  isEnabled(context: InvitationActionContext) {
    return !!context?.canInvite;
  }
  async execute({ invitation, refresh }: InvitationActionContext) {
    const result = await authClient.organization.cancelInvitation({ invitationId: invitation.id });
    if (result.error) throw new Error('Invitation cancellation failed');
    notify.success('saved');
    refresh();
  }
}
