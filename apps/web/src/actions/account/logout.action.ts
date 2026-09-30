import { getService, authService } from '@bitakit/core';
import { defineAction } from '@bitakit/core';
import LogOutIcon from 'reicon-react/icons/Logout';
import { actionGroups } from '../groups';

export default defineAction({
  title: 'Nav.logout',
  icon: LogOutIcon,
  groups: [actionGroups.account],
  watch: [authService],
  resolve: (_, { services }) => {
    const session = getService(services, authService).getSnapshot();
    return { visible: !!session.user, enabled: !session.pending };
  },
  execute: ({ services }) => getService(services, authService).signOut(),
  success: false,
});
