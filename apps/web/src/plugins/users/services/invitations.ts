import { defineService } from '@bitakit/core';

/** Deliberately local: demonstrates the flow without sending email or changing accounts. */
export default defineService(() => ({
  async invite(input: { email: string }): Promise<{ invitationId: string }> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (input.email === 'error@example.com') throw new Error('Demo failure');
    return { invitationId: crypto.randomUUID() };
  },
}));
