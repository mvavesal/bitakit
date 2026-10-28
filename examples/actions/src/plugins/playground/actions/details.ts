import { defineAction } from '@bitakit/core';
import DetailsDialog from '../ui/dialogs/details';

// Opens a component in the host's dialog instead of running `execute`.
export default defineAction({
  title: 'Open a dialog',
  description: 'A dialog Action shows its own title and description.',
  dialog: { component: DetailsDialog },
});
