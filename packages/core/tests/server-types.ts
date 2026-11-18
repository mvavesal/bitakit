import type { ExecuteContext, Remote, Services } from '../src/core.js';
import {
  createServer,
  defineAction,
  defineInterceptor,
  defineService,
  discoveredFile,
  OperationError,
  type Caller,
  type ServerActionEntry,
  type ServerExecuteContext,
  type ServerServiceContext,
} from '../src/server/index.js';

const title = {
  parse: (value: unknown) => ({ title: String((value as { title?: unknown })?.title) }),
};
const ledgerOutput = {
  parse: (value: unknown) => value as { id: string },
};

// A server Action types `ctx` from `access` and `input` from its schema.
const add = defineAction({
  access: 'organization',
  expose: true,
  input: title,
  output: ledgerOutput,
  execute: ({ input, ctx }) => {
    const text: string = input.title;
    const organization: string = ctx.organization.id;
    const granted: Promise<boolean> = ctx.can({ ledger: ['write'] });
    void [text, organization, granted];
    return { id: 'a', extra: true };
  },
});
const open = defineAction({
  access: 'public',
  execute: ({ ctx, input }) => {
    const nothing: undefined = input;
    // @ts-expect-error A public operation has no user.
    ctx.user.id;
    return { requestId: ctx.requestId, nothing };
  },
});
const mine = defineAction({
  access: 'user',
  execute: ({ ctx }) => {
    const user: string = ctx.user.id;
    // @ts-expect-error A user operation has no organization.
    ctx.organization.id;
    return user;
  },
});
const purge = defineAction({
  access: { permission: { ledger: ['delete'] } },
  execute: async ({ ctx, settings }) => {
    const organization: string = ctx.organization.id;
    const currency: string = await settings.billing.currency.load();
    void [organization, currency];
  },
});
// @ts-expect-error access is required.
defineAction({ execute: () => 1 });
// @ts-expect-error Client-only fields belong to the button.
defineAction({ access: 'public', enabled: false, execute: () => 1 });
// @ts-expect-error A confirmation belongs to the button.
defineAction({ access: 'public', confirm: 'Sure?', execute: () => 1 });
// @ts-expect-error Unknown access levels are rejected.
defineAction({ access: 'organisation', execute: () => 1 });

// Server interceptors see ctx; `before` may return false, never true.
defineInterceptor({
  action: 'billing.*',
  before: ({ ctx }) => {
    const id: string = ctx.requestId;
    void id;
    return false;
  },
});
// @ts-expect-error `before` returns void or false.
defineInterceptor({ action: '*', before: () => true });

// What the generated server file writes.
const file1 = discoveredFile(add, 'add', 'src/plugins/billing/server/actions/add.ts');
const record = discoveredFile({ purge }, '', 'src/plugins/billing/server/actions.ts');
type AddEntry = ServerActionEntry<typeof file1, 'billing', true>;
const entry: AddEntry = { input: { title: 'x' }, result: { id: 'a' }, exposed: true };
// @ts-expect-error The result follows the output schema.
const wrongEntry: AddEntry = { input: { title: 'x' }, result: { name: 'a' }, exposed: true };

const ledger = defineService(() => ({ balance: (organization: string) => organization.length }));
declare module '../src/core.js' {
  interface ServerActionMap {
    'billing.add': ServerActionEntry<typeof file1, 'billing', true>;
    'billing.open': ServerActionEntry<typeof open, 'billing', true>;
    'billing.mine': ServerActionEntry<typeof mine, 'billing', false>;
    'billing.purge': ServerActionEntry<typeof record, 'billing', false, 'purge'>;
  }
  interface ServerServiceMap {
    'billing.ledger': ReturnType<typeof ledger.create>;
  }
  interface SettingsMap {
    'billing.currency': string;
  }
}

// The in-process caller reaches every operation, also private ones.
const server = createServer({});
const caller: Caller = server.as(new Headers());
const added: Promise<{ id: string }> = caller.billing.add({ title: 'x' });
const purged: Promise<void> = caller.billing.purge();
const own: Promise<string> = caller.billing.mine(undefined, { requestId: 'r1' });
// @ts-expect-error Inputs are typed.
caller.billing.add({ name: 'x' });

// `remote` holds only the exposed ones.
declare const remote: Remote;
const remoteAdded: Promise<{ id: string }> = remote.billing.add(
  { title: 'x' },
  { organizationId: 'o1' },
);
const remoteOpen: Promise<{ requestId: string; nothing: undefined }> = remote.billing.open();
// @ts-expect-error A private operation is not part of remote.
remote.billing.purge();
// @ts-expect-error A private operation is not part of remote.
remote.billing.mine();
declare const execute: ExecuteContext;
const viaContext: Promise<{ id: string }> = execute.remote.billing.add({ title: 'y' });

// Server contexts type services from ServerServiceMap; the client never sees them.
declare const serverContext: ServerExecuteContext<undefined, 'public'>;
const balance: number = serverContext.services.billing.ledger.balance('o1');
declare const serviceContext: ServerServiceContext;
const fromService: number = serviceContext.services.billing.ledger.balance('o1');
const loaded: Promise<string> = serviceContext.settings.billing.currency.load(serverContext.ctx);
// @ts-expect-error Server settings have no process-wide value.
serviceContext.settings.billing.currency.get();
declare const clientServices: Services;
// @ts-expect-error Server services never enter the client ServiceMap.
clientServices.billing.ledger;
// @ts-expect-error Server service contexts have no remote.
serviceContext.remote;

defineService(({ services, settings }) => ({
  read: async (ctx: ServerExecuteContext['ctx']) => [
    services.billing.ledger.balance('x'),
    await settings.billing.currency.load(ctx),
  ],
}));

// `type` says whether an operation only reads; transports may answer a query with GET.
const listed = defineAction({ access: 'public', type: 'query', execute: () => 1 });
// @ts-expect-error Only 'query' or 'mutation'.
defineAction({ access: 'public', type: 'subscription', execute: () => 1 });
declare const described: import('../src/server/index.js').OperationInfo;
const kind: 'query' | 'mutation' = described.type;
void [listed, kind];

const problem = new OperationError('CONFLICT', 'Reload.', { reason: 'ORGANIZATION_CHANGED' });
const status: number = problem.status;
// @ts-expect-error Codes are a closed set.
new OperationError('TEAPOT', 'No.');

void [entry, wrongEntry, added, purged, own, remoteAdded, remoteOpen, viaContext, balance];
void [fromService, loaded, status];
