import { defineSlot } from '@bitakit/core';

// The dashboard's cards. Any plugin adds one with a `ui/slots/dashboard.widgets.tsx` file and
// sorts it with `export const order`; the dashboard never imports them.
export default defineSlot({ accepts: 'component' });
