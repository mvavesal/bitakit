# @bitakit/nodemailer — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/nodemailer`).
> To change the package itself, follow the repository's own AGENTS.md instead.

A server-only SMTP plugin that implements the `emailService` contract of `@bitakit/email`. Each
server runtime owns its transport and closes it on unmount.

## Use it

```ts
// server code only
import { createRuntime, getService } from '@bitakit/core';
import { emailService } from '@bitakit/email';
import { nodemailerPlugin } from '@bitakit/nodemailer';

const runtime = createRuntime({
  plugins: [
    nodemailerPlugin({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER!,
      password: process.env.SMTP_PASSWORD!,
      from: process.env.SMTP_FROM!, // must contain an address: 'Demo <sender@example.test>'
    }),
  ],
});
const dispose = runtime.mount();
const email = getService(runtime.services, emailService);
// Call dispose when the server shuts down, not after every request.
```

## Rules

- The host passes credentials from its environment; the plugin never reads env files itself.
  Keep SMTP credentials in ignored local env files.
- TLS is required; the browser entry refuses to run.
- Registering it opens no connection and sends nothing; do not send real mail from tests.
