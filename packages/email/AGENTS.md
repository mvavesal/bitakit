# @bitakit/email — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/email`). To
> change the package itself, follow the repository's own AGENTS.md instead.

The server-side email contract: the typed `emailService` key with
`send({ to, subject, text?, html? })`, which resolves to a message ID. It sends nothing by
itself; a provider plugin such as `@bitakit/nodemailer` implements it.

## Use it

- Code that sends mail depends on the contract, not on a provider:
  `getService(services, emailService).send({ to, subject, text })`.
- Provide exactly one implementation on the server with `provides: emailService`.
- It runs on the server only; never import a provider into client code.

## Rules

- Sending needs a real, configured sender; tests use a fake service through `mountPlugin`'s
  `services` option.
- Never log recipients, subjects with personal data or message bodies.
