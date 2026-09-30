import { actionGroups } from '../groups';
import { Action } from '@bitakit/ui/actions';
import SendIcon from 'reicon-react/icons/Send';
import type { InvitationActionContext } from './context';

export default class ResendInvitationAction extends Action<InvitationActionContext> {
  constructor() {
    super({
      id: 'invitation.resend',
      title: 'Organizations.resendInvitation',
      tooltip: 'Organizations.emailNotConfigured',
      groups: [actionGroups.invitation],
      order: 0,
      icon: SendIcon,
      enabled: false,
    });
  }
  // Enabled only after a real mail sender is configured.
}
