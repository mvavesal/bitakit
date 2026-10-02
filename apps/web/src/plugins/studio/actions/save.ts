import { defineAction } from '@bitakit/core';
import SaveIcon from 'reicon-react/icons/Floppy';

export default defineAction({
  title: 'Save draft',
  icon: SaveIcon,
  // Follows the draft store: valid, changed and restored from this browser.
  enabled: ({ services }) => services.studio.draft.canSave(),
  execute: ({ services }) => {
    services.studio.draft.save();
  },
  success: false,
});
