import type { betterAuthEmail } from '@bitakit/better-auth/email';
import { apiKey } from '@better-auth/api-key';
import { organization, multiSession, twoFactor } from 'better-auth/plugins';
import { validateOrganization } from './organization-validation';
import { setInvitationExpiry } from './invitation-expiry';
import {
  DEFAULT_INVITATION_EXPIRY_DAYS,
  INVITATION_DAY_MS,
} from '../organizations/invitation-schema';

// Shared by the runtime and schema generation. Organizations use Better Auth's
// owner/admin/member permissions; auth tables are never exposed as generic CRUD.
export function createAuthOptions(mail?: ReturnType<typeof betterAuthEmail>) {
  return {
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      ...(mail ? { sendResetPassword: mail.sendResetPassword } : {}),
    },
    ...(mail ? { emailVerification: { sendVerificationEmail: mail.sendVerificationEmail } } : {}),
    user: { changeEmail: { enabled: true } },
    plugins: [
      multiSession(),
      twoFactor({ issuer: 'SaaS Foundation' }),
      apiKey([
        { configId: 'default', references: 'user' },
        { configId: 'organization', references: 'organization' },
      ]),
      organization({
        teams: { enabled: true },
        ...(mail ? { sendInvitationEmail: mail.sendInvitationEmail } : {}),
        invitationExpiresIn: (DEFAULT_INVITATION_EXPIRY_DAYS * INVITATION_DAY_MS) / 1000,
        organizationHooks: {
          beforeCreateOrganization: validateOrganization,
          beforeUpdateOrganization: validateOrganization,
          beforeCreateInvitation: setInvitationExpiry,
        },
      }),
    ],
  };
}
export const authOptions = createAuthOptions();
