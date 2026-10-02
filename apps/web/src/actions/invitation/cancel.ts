import { defineAction } from '@bitakit/core';
import CancelIcon from 'reicon-react/icons/Xmark';
import { authClient } from '@/lib/auth-client';
import { actionGroups } from '@/lib/action-groups';
import type { InvitationActionContext } from '@/lib/organizations/action-context';

export default defineAction<InvitationActionContext>({
  title: 'Organizations.cancelInvitation',
  groups: [actionGroups.invitation],
  order: 10,
  icon: CancelIcon,
  variant: 'destructive',
  enabled: ({ input }) => !!input?.canInvite,
  execute: async ({ input }) => {
    const result = await authClient.organization.cancelInvitation({
      invitationId: input.invitation.id,
    });
    if (result.error) throw new Error('Invitation cancellation failed');
    input.refresh();
  },
  success: 'Notifications.saved',
  failure: 'Notifications.saveFailed',
});
