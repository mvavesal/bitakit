import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add note',
  enabled: ({ input }) => !!input?.trim(),
  execute: ({ services, input }) => services.notes.list.add(input),
});
