import { defineSlot } from '@bitakit/core';
import { z } from 'zod';

// Sections on a company's page. Other plugins add a card with `ui/slots/companies.detail.tsx`
// and receive the company's id; this plugin never imports them.
export default defineSlot({
  accepts: 'component',
  payload: z.object({ companyId: z.number() }),
});
