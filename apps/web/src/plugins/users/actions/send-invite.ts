import { defineAction } from '@bitakit/core';
import { z } from 'zod';

/** Submits one invitation. Internal: the invite dialog runs it; menus and search do not list it. */
export default defineAction({
  input: z.object({ email: z.email() }),
  internal: true,
  execute: ({ services, input }) => services.users.invitations.invite(input),
  success: 'users.invite.success',
  // The dialog keeps the draft and shows the failure next to the field.
  failure: false,
});
