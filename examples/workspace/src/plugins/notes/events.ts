import { defineEvents, event } from '@bitakit/core';

// The contract other plugins listen to: `notes.changed`.
export default defineEvents({
  changed: event<{ kind: 'added' | 'removed'; title: string }>(),
});
