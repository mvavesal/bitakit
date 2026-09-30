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
        subject: 'E-Mail-Adresse bestätigen',
        text: `Bitte bestätige deine E-Mail-Adresse:\n\n${url}`,
      });
    },
    async sendResetPassword({ user, url }: AccountEmail) {
      await service.send({
        to: user.email,
        subject: 'Passwort zurücksetzen',
        text: `Hier kannst du dein Passwort zurücksetzen:\n\n${url}`,
      });
    },
    async sendInvitationEmail({ id, email, organization }: OrganizationInvitation) {
      const url = options.invitationURL(id);
      await service.send({
        to: email,
        subject: 'Einladung zu einer Organisation',
        text: `Du wurdest zu ${organization.name} eingeladen:\n\n${url}`,
      });
    },
  };
}
