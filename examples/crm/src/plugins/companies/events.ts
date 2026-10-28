import { defineEvents, event } from '@bitakit/core';

// Other plugins listen to `companies.added`; only this plugin emits it.
export default defineEvents({
  added: event<{ id: number; name: string }>(),
});
