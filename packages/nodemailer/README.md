# @bitakit/nodemailer

A server-side SMTP plugin for the shared BitaKit email service. There is no browser installation
and no global SMTP instance: each runtime owns its transport and closes it on unmount.

```ts
import { createRuntime, getService } from '@bitakit/core';
import { emailService } from '@bitakit/email';
import { nodemailerPlugin } from '@bitakit/nodemailer';
import { betterAuthEmail } from '@bitakit/better-auth/email';

const runtime = createRuntime({
  plugins: [
    nodemailerPlugin({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER!,
      password: process.env.SMTP_PASSWORD!,
      from: process.env.SMTP_FROM!,
    }),
  ],
});
const dispose = runtime.mount();
const callbacks = betterAuthEmail(getService(runtime.services, emailService), {
  invitationURL: (id) => new URL(`/invitations/${encodeURIComponent(id)}`, appOrigin).href,
});
// Pass callbacks to your server-side Better Auth configuration.
// Call dispose when the server runtime is shut down, not after every request.
```

The route in the example must exist in the host. `appOrigin` comes from trusted server
configuration. The host loads the local env file; the plugin never reads secret files or
environment variables on its own. `from` must contain an address, for example
`Demo <sender@example.test>`; a display name alone is not enough.

TLS is required, including with STARTTLS. The browser entry refuses to run.
Credentials, message text and recipients are never logged. Registering the plugin opens no SMTP
connection and sends nothing. The automated tests use transport doubles; no real test email is
sent without an explicit request.
