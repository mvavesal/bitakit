import { serviceKey } from '@bitakit/core';
export type EmailMessage = { to: string; subject: string; text?: string; html?: string };
/** Server-side contract. Providers own delivery, credentials and transport-specific details. */
export interface EmailService {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}
export const emailService = serviceKey<EmailService>('email');
