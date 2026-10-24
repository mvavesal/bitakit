import { defineSlot } from '@bitakit/core';

// Other plugins add buttons above the list by naming `notes.toolbar` in an Action's `slots`.
export default defineSlot({ accepts: 'actions' });
