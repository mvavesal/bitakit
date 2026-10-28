import { defineEvents, event } from '@bitakit/core';

// Other plugins listen to `orders.created` to refresh their numbers; only this plugin emits it.
export default defineEvents({
  created: event<{ id: number; product: string; total: number }>(),
});
