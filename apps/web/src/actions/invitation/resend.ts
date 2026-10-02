import { defineAction } from '@bitakit/core';
import SendIcon from 'reicon-react/icons/Send';
import { actionGroups } from '@/lib/action-groups';
import type { InvitationActionContext } from '@/lib/organizations/action-context';

// Enabled only after a real mail sender is configured.
export default defineAction<InvitationActionContext>({
  title: 'Organizations.resendInvitation',
  tooltip: 'Organizations.emailNotConfigured',
  groups: [actionGroups.invitation],
  order: 0,
  icon: SendIcon,
  enabled: false,
});
