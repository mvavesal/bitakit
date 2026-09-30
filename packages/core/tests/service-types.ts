import { serviceKey, provideService, getService, type Services } from '../src/core.js';
interface Mail {
  send(input: { to: string }): Promise<{ id: string }>;
}
const mail = serviceKey<Mail>('mail');
provideService(mail, { create: () => ({ send: async ({ to }) => ({ id: to }) }) });
provideService(mail, {
  // @ts-expect-error A provider must implement the declared return type.
  create: () => ({ send: async () => 123 }),
});
declare const services: Services;
const client = getService(services, mail);
const result: Promise<{ id: string }> = client.send({ to: 'test@example.com' });
// @ts-expect-error Inputs are checked.
client.send({ recipient: 'test@example.com' });
// @ts-expect-error Unknown methods are not exposed.
client.deleteEverything();
// @ts-expect-error Optional auth is not guaranteed merely by installing core.
services.auth.signOut();
void result;

import { definePlugin, type FoundationApp, type PublicServicesOf } from '../src/core.js';
const mailPlugin = definePlugin({ id: 'mail', publicServices: { mail }, services: [] });
declare const app: FoundationApp<PublicServicesOf<readonly [typeof mailPlugin]>>;
const mailResult: Promise<{ id: string }> = app.services.mail.send({ to: 'test@example.com' });
app.optional.services.mail?.send({ to: 'test@example.com' });
// @ts-expect-error Unpublished services are absent from dot completion.
app.services.documents;
// @ts-expect-error Optional service access requires an availability check.
app.optional.services.mail.send({ to: 'test@example.com' });
declare const emptyApp: FoundationApp<PublicServicesOf<readonly []>>;
// @ts-expect-error An empty composition does not claim plugin availability.
emptyApp.services.mail;
void mailResult;
