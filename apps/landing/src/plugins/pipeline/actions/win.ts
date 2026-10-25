import { defineAction } from '@bitakit/core';
import CheckIcon from 'reicon-react/icons/Check';

export default defineAction<number>({
  title: 'Mark won',
  icon: CheckIcon,
  // A guard: every control bound to this Action is disabled for a deal that is already won.
  enabled: ({ input, services }) =>
    input !== undefined && services.pipeline.deals.find(input)?.stage !== 'won',
  concurrency: 'per-input',
  execute: ({ services, input }) => services.pipeline.deals.win(input),
  success: 'Deal won',
});
