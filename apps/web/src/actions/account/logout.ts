import { authService, defineAction, getService } from '@bitakit/core';
import LogOutIcon from 'reicon-react/icons/Logout';
import { actionGroups } from '@/lib/action-groups';

export default defineAction({
  title: 'Nav.logout',
  icon: LogOutIcon,
  groups: [actionGroups.account],
  // The shared auth service is observed, so both fields follow the session.
  visible: ({ services }) => !!getService(services, authService).getSnapshot().user,
  enabled: ({ services }) => !getService(services, authService).getSnapshot().pending,
  execute: ({ services }) => getService(services, authService).signOut(),
  success: false,
});
