import type { EmailMessage, EmailService } from '@bitakit/email';
export type MailTransport = {
  sendMail(message: EmailMessage & { from: string }): Promise<{ messageId: string }>;
  verify(): Promise<unknown>;
  close(): void;
};
/** Transport ownership is per plugin mount. No credentials or message bodies are logged. */
export function createMailService(
  transport: MailTransport,
  from: string,
): EmailService & { verify(): Promise<void>; dispose(): void } {
  let disposed = false;
  const active = () => {
    if (disposed) throw new Error('Email service is disposed.');
  };
  return {
    async send(message) {
      active();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) || /[\r\n]/.test(message.subject))
        throw new Error('Invalid email recipient or subject.');
      if (!message.text && !message.html) throw new Error('An email body is required.');
      const result = await transport.sendMail({
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        from,
      });
      return { messageId: result.messageId };
    },
    async verify() {
      active();
      await transport.verify();
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        transport.close();
      }
    },
  };
}
