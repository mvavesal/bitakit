import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear the log',
  enabled: ({ services }) => services.audit.log.state.get().entries.length > 0,
  execute: ({ services }) => services.audit.log.clear(),
});
