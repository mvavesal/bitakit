import { defineSlot } from '@bitakit/core';

// Buttons beside the dashboard's title. Other plugins place an Action here with
// `slots: ['dashboard.toolbar']`.
export default defineSlot({ accepts: 'actions' });
