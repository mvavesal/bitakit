import 'server-only';
import { createActionList, FoundationRuntime, getService } from '@bitakit/core';
import { emailService } from '@bitakit/email';
import { nodemailerPlugin } from '@bitakit/nodemailer';
import { betterAuthEmail } from '@bitakit/better-auth/email';
let mail: ReturnType<typeof betterAuthEmail> | undefined;
/** Server-owned runtime: no credentials or transport can enter the browser graph. */
export function getAuthMail() {
  if (mail) return mail;
  const user = process.env.SMTP_USER ?? '';
  const from = process.env.SMTP_FROM ?? '';
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      nodemailerPlugin({
        host: process.env.SMTP_HOST ?? '',
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        user,
        password: process.env.SMTP_PASSWORD ?? '',
        from: from.includes('@') ? from : `${from || 'SaaS Foundation'} <${user}>`,
      }),
    ],
  });
  runtime.mount();
  mail = betterAuthEmail(getService(runtime.services, emailService), {
    invitationURL(id) {
      const uiOrigin = process.env.AUTH_UI_ORIGIN;
      const url = new URL(
        uiOrigin ? '/better-auth/auth/accept-invitation' : '/organizations',
        uiOrigin ?? process.env.BETTER_AUTH_URL,
      );
      url.searchParams.set(uiOrigin ? 'invitationId' : 'invitation', id);
      return url.toString();
    },
  });
  return mail;
}
