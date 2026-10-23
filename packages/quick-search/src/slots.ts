import { defineSlot } from '@bitakit/core';
import { searchSourceSchema } from './schemas.js';

/** Each contribution uses an explicit, stable local `id`; Core qualifies it with its owner. */
export const searchSources = defineSlot({
  id: 'quick-search.sources',
  accepts: 'data',
  schema: searchSourceSchema,
});

export default searchSources;

declare module '@bitakit/core' {
  interface SlotMap {
    'quick-search.sources': typeof searchSources;
  }
}
