import { defineSlot } from '@bitakit/core';

// Every widget on the dashboard comes from another plugin's `ui/slots/dashboard.widgets.tsx`.
export default defineSlot({ accepts: 'component' });
