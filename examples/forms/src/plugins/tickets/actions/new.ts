import { defineAction } from '@bitakit/core';
import NewTicketDialog from '../ui/dialogs/new-ticket';

// Opens the form in a dialog instead of running `execute`. The page's button and Mod+Shift+N
// both open it; the dialog shows this title and description.
export default defineAction({
  title: 'New ticket',
  description: 'Describe the problem; we answer by email.',
  shortcut: { keys: 'Mod+Shift+N' },
  dialog: { component: NewTicketDialog },
});
