import { z } from 'zod';

export const DEFAULT_INVITATION_EXPIRY_DAYS = 30;
export const MAX_INVITATION_EXPIRY_DAYS = 365;
export const INVITATION_DAY_MS = 24 * 60 * 60 * 1000;

export const invitationExpiryDaysSchema = z.number().int().min(1).max(MAX_INVITATION_EXPIRY_DAYS);

export const createInvitationSchema = z.object({
  organizationId: z.string().min(1),
  email: z.email(),
  role: z.enum(['member', 'admin']),
  resend: z.boolean().optional(),
  expiresInDays: invitationExpiryDaysSchema.default(DEFAULT_INVITATION_EXPIRY_DAYS),
});
