import type { EmailService } from '@bitakit/email';

type AccountEmail = { user: { email: string }; url: string };
type OrganizationInvitation = { id: string; email: string; organization: { name: string } };
/** Server-side callbacks for Better Auth. The host owns its actual invitation route. */
export function betterAuthEmail(
  service: EmailService,
  options: { invitationURL(id: string): string },
) {
  return {
    async sendVerificationEmail({ user, url }: AccountEmail) {
      await service.send({
        to: user.email,
        subject: 'Verify your email address',
        text: `Please verify your email address:\n\n${url}`,
      });
    },
    async sendResetPassword({ user, url }: AccountEmail) {
      await service.send({
        to: user.email,
        subject: 'Reset your password',
        text: `You can reset your password here:\n\n${url}`,
      });
    },
    async sendInvitationEmail({ id, email, organization }: OrganizationInvitation) {
      const url = options.invitationURL(id);
      await service.send({
        to: email,
        subject: 'Organization invitation',
        text: `You have been invited to join ${organization.name}:\n\n${url}`,
      });
    },
  };
}
