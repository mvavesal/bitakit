import {
  defineInterceptor,
  definePlugin,
  defineService,
  discoveredFile,
  getService,
  provideService,
  serviceKey,
  type DiscoveredServiceEntry,
  type FoundationApp,
  type PublicServicesOf,
  type ServiceDefinition,
  type Services,
} from '../src/core.js';

interface Mail {
  send(input: { to: string }): Promise<{ id: string }>;
}
const mail = serviceKey<Mail>('mail');
// The contract phantom is contravariant: a richer instance satisfies a narrower contract.
const outbox = defineService(() => ({ send: async ({ to }: { to: string }) => ({ id: to }), drafts: [] as string[] }), {
  provides: mail,
  exposeAs: 'messaging.mail',
});
defineService(() => ({ send: async () => 123 }), {
  // @ts-expect-error A provider must implement the declared contract.
  provides: mail,
});
const typed: ServiceDefinition<{ send(input: { to: string }): Promise<{ id: string }>; drafts: string[] }> = outbox;
// The deprecated object form types the same way.
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
services.auth?.signOut();

// Services form a tree: services.<plugin>.<file>. The map is generated; here it is augmented by hand.
declare module '../src/core.js' {
  interface ServiceMap {
    'todos.tasks': { list(): string[]; add(title: string): number };
  }
}
const titles: string[] = services.todos.tasks.list();
// @ts-expect-error Flat keys are not part of the tree.
services['todos.tasks'];
// @ts-expect-error Unknown plugins are not part of the tree.
services.notes;

// Service interceptors are typed from the map: method names, arguments and results.
defineInterceptor({
  service: 'todos.tasks',
  method: 'add',
  before: ({ args }) => {
    const title: string = args[0];
    void title;
  },
  after: ({ result }) => {
    const id: number = result;
    void id;
  },
});
defineInterceptor({
  service: 'todos.tasks',
  before: ({ method }) => {
    const name: 'list' | 'add' = method;
    void name;
  },
});
// @ts-expect-error Unknown methods are rejected.
defineInterceptor({ service: 'todos.tasks', method: 'remove' });

// Manual composition: record keys become <plugin>.<key>; exposeAs adds a flat alias onto the same instance.
const clock = defineService(() => ({ now: () => new Date() }), { exposeAs: 'clock' });
const mailPlugin = definePlugin({ id: 'mail', services: { outbox, clock } });
declare const app: FoundationApp<PublicServicesOf<readonly [typeof mailPlugin]>>;
const sent: Promise<{ id: string }> = app.services.mail.outbox.send({ to: 'test@example.com' });
const aliased: Promise<{ id: string }> = app.services.messaging.mail.send({ to: 'example' });
const now: Date = app.services.clock.now();
const drafts: string[] = app.services.mail.outbox.drafts;
// @ts-expect-error Input checking survives aliasing.
app.services.messaging.mail.send({ recipient: 'example' });
// @ts-expect-error Unpublished services are absent from completion.
app.services.documents;
// @ts-expect-error app.optional is gone; read app.services once app.ready is true.
app.optional;
const ready: boolean = app.ready;
const has: boolean = app.has('mail.outbox');
declare const emptyApp: FoundationApp<PublicServicesOf<readonly []>>;
// @ts-expect-error An empty composition does not claim plugin availability.
emptyApp.services.mail;
const arrayPlugin = definePlugin({ id: 'arr', services: [defineService(() => 1, { id: 'arr.one' })] });
declare const arrayApp: FoundationApp<PublicServicesOf<readonly [typeof arrayPlugin]>>;
const one: number = arrayApp.services.arr.one;

// Discovery: the file path names the service; exposeAs is part of the same entry.
const file = discoveredFile(defineService(() => ({ now: () => new Date() }), { exposeAs: 'clock' }), 'internal', 'services/internal.ts');
type Stored = DiscoveredServiceEntry<typeof file, 'plugin'>;
const stored: Stored['plugin.internal'] = { now: () => new Date() };
const exposed: Stored['clock'] = stored;
// @ts-expect-error The alias does not replace the ID.
type Wrong = Stored['plugin.clock'];
void [typed, result, titles, sent, aliased, now, drafts, ready, has, one, exposed];
