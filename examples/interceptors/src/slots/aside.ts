import { defineSlot } from '@bitakit/core';

// A column on the right of every page, drawn by src/layouts/app.tsx. Any plugin fills it from
// its own ui/slots/aside.tsx; here the audit plugin puts its live log there.
export default defineSlot({ accepts: 'component' });
