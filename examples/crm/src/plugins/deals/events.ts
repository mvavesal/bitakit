import { defineEvents, event } from '@bitakit/core';

// Other plugins listen to `deals.won`; only this plugin emits it.
export default defineEvents({
  won: event<{ id: number; title: string; value: number }>(),
});
