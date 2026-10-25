import { defineEvents, event } from '@bitakit/core';

// What other plugins can react to: `pipeline.added`, `pipeline.won`, `pipeline.removed`.
export default defineEvents({
  added: event<{ name: string; amount: number }>(),
  won: event<{ name: string; amount: number }>(),
  removed: event<{ name: string }>(),
});
