import { AsyncLocalStorage } from 'node:async_hooks';
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  INVITATION_DAY_MS,
  invitationExpiryDaysSchema,
} from '../organizations/invitation-schema';

// Scope the selected duration to this Better Auth call. Concurrent invitations
// must never change each other's expiry or mutate the shared plugin options.
const invitationExpiry = new AsyncLocalStorage<number>();

export function withInvitationExpiry<T>(days: number, create: () => Promise<T>): Promise<T> {
  return invitationExpiry.run(invitationExpiryDaysSchema.parse(days), create);
}

export async function setInvitationExpiry() {
  const days = invitationExpiry.getStore() ?? DEFAULT_INVITATION_EXPIRY_DAYS;
  return { data: { expiresAt: new Date(Date.now() + days * INVITATION_DAY_MS) } };
}
