import { defineAction } from '@bitakit/core';
import InviteDialog from '../ui/dialogs/invite';

/** Opens the invitation form; the dialog runs users.send-invite with the entered values. */
export default defineAction({
  groups: ['userManagement.dropdownMenu'],
  dialog: InviteDialog,
});
