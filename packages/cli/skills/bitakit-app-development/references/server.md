# Server operations: a plugin's server half

Use this when code must run on the server: a database, a secret, a check of who may do
something, or data shared between users. The plugin keeps it in its own `server/` folder, which
is never bundled for the browser. The browser calls an exposed operation through the generated
`remote` client; there is no hand-written route or `fetch` per feature.
[data-and-api.md](data-and-api.md) builds the complete Bookmarks feature on these files.

## The button and the operation

A server feature has two files with one name:

| File                                     | It is                                                | Edit it to change                                      |
| ---------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `actions/add.ts`                         | The button (client Action `bookmarks.add`)           | Label, `enabled`, `confirm`, messages, client state    |
| `server/actions/add.ts`                  | The operation (server Action `server:bookmarks.add`) | Input, who may call it, what it reads and changes      |
| `server/services/<name>.ts`              | Server logic and data access the operations share    | Queries, clients, caches                               |
| `src/server/services/request-context.ts` | The app's `requestContext` provider (once per app)   | How a request becomes a verified user and organization |

- Both Actions are called `bookmarks.add`, in separate maps: `ActionMap` (client) and
  `ServerActionMap` (server). Tools print the operation as `server:bookmarks.add`.
- The button's `enabled`, `visible` and `confirm` only shape the UI. Who may run the operation
  is decided by its `access`, on the server, for every call.
- Server Actions are the only thing the browser can call. Server services are never reachable
  over HTTP; operations call them.
- A plugin with only server work is just a `server/` folder. Every other file under `server/`
  (helpers, a database module) is the plugin's own code and is not discovered.

## Create the files

```sh
npx bitakit add action bookmarks/add --server
```

It writes `server/actions/add.ts` (`access: 'organization'`, `expose: true`, zod `input` and
`output`), `tests/bookmarks.add.server.test.ts`, the button `actions/add.ts` when the plugin has
none, and the RPC route when no route answers the endpoint yet. It prints what is still missing:
`npm install zod`, the test setup and, when no service provides `requestContext`, the provider.
`npx bitakit add service bookmarks/store --server` and `add interceptor bookmarks/audit --server`
write `server/services/store.ts` and `server/interceptors/audit.ts`. Replace the template bodies.

## The operation

```ts
// src/plugins/bookmarks/server/actions/add.ts
import { randomUUID } from 'node:crypto';
import { defineAction } from '@bitakit/core/server';
import { z } from 'zod';

// The operation behind the Save button (actions/add.ts).
export default defineAction({
  access: 'user',
  expose: true,
  input: z.object({ url: z.url() }),
  execute: ({ input, ctx, services }) => {
    const address = new URL(input.url);
    const bookmark = { id: randomUUID(), title: address.hostname, url: address.href };
    services.bookmarks.store.add(ctx.user.id, bookmark);
    return bookmark;
  },
});
```

- Import `defineAction`, `defineService` and `defineInterceptor` from `@bitakit/core/server` in
  server files: the same functions as `@bitakit/core`, typed with the server fields. Client-only
  fields (`enabled`, `confirm`, `slots`, `success`, ...) are type errors and startup errors there,
  and `access`, `expose` or `output` in a client Action fail with "This file is the button".
- `execute` receives `{ id, input, ctx, services, config, events, settings, signal }`. `input` is
  validated once; without an `input` schema the operation takes no input and a body is refused.
- `output` (a schema) checks the result and returns the validator's value: zod and valibot
  objects drop extra keys, which keeps a database row's other columns from leaking. Without it the
  caller receives exactly what `execute` returns, so select fields yourself.
- `requires: ['billing.invoices']` lists server services of other plugins, as on the client.

## `access` and `expose`

| `access`                                | Who may call it                                       | `ctx` has                                 |
| --------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| `'public'`                              | Anyone, also signed out                               | `requestId`, `signal`                     |
| `'user'`                                | A signed-in user                                      | plus `user` (`id`, `name?`, `email?`)     |
| `'organization'`                        | A member of the active organization                   | plus `organization.id`, `member`, `can()` |
| `{ permission: { todos: ['delete'] } }` | A member whose provider grants every listed operation | as `'organization'`                       |

- `access` is required; there is no default. A typo or an unknown permission is a startup error.
- `expose: true` publishes the operation over HTTP and in `remote`. Without it the operation is
  private: other server code calls it in-process (`server.as(request)`), the browser cannot.
- Permissions come from the plugins' `permissions.ts` ([roles-and-permissions.md](roles-and-permissions.md)).
  The provider's `can()` decides; only an answer of exactly `true` grants.

## `ctx` and tenant filters

`ctx` is the verified identity of this call, frozen and passed explicitly. BitaKit never filters
your data for you: every query of user or organization data names its owner.

```ts
// src/plugins/bookmarks/server/services/store.ts
import { defineService } from '@bitakit/core/server';

export type Bookmark = { id: string; title: string; url: string };

// Example storage: each user's bookmarks in server memory, lost when the server restarts.
// Replace the map with the app's database client; keep every query filtered by the owner.
export default defineService(() => {
  const byUser = new Map<string, Bookmark[]>();
  return {
    list: (userId: string) => byUser.get(userId) ?? [],
    add(userId: string, bookmark: Bookmark) {
      byUser.set(userId, [...(byUser.get(userId) ?? []), bookmark]);
    },
    remove(userId: string, id: string) {
      const bookmarks = byUser.get(userId) ?? [];
      byUser.set(
        userId,
        bookmarks.filter((bookmark) => bookmark.id !== id),
      );
      return bookmarks.some((bookmark) => bookmark.id === id);
    },
  };
});
```

- A server service is one instance for the whole process and every user. Take the owner as a
  method argument (`ctx.user.id`, `ctx.organization.id`); never keep "the current user" in a field.
- For organization data use `access: 'organization'` and filter by `ctx.organization.id`. An
  organization ID sent by the browser is never proof of membership; only `ctx` is.
- Never return authentication records (users, sessions, memberships) from your own tables; read
  them through the auth provider.

## The button calls `remote`

```ts
// src/plugins/bookmarks/actions/add.ts (a button that calls the operation directly)
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Save',
  enabled: ({ input }) => URL.canParse(input?.trim() ?? ''),
  execute: ({ input, remote }) => remote.bookmarks.add({ url: input.trim() }),
});
```

- `remote` is in every client Action's and service's context: one typed function per exposed
  operation, `remote.<plugin>.<name>(input, { signal?, organizationId? })`. A private operation
  is a type error there. When a service holds the client's copy of the data, the button calls the
  service and the service calls `remote` ([data-and-api.md](data-and-api.md)).
- `npx bitakit generate` (the dev server does it on save) adds a new operation to `remote`.
- Signed in, `remote` sends the organization the page shows (the `auth` snapshot's
  `organizationId`, or the `organizationId` option). When the session has moved to another
  organization meanwhile, the server answers `CONFLICT` instead of writing to the wrong one.

## Errors the UI shows

Throw `OperationError` for expected failures; anything else becomes a 500 with a reference, and
the original stays in the server log.

```ts
// src/plugins/bookmarks/server/actions/remove.ts
import { defineAction, OperationError } from '@bitakit/core/server';
import { z } from 'zod';

export default defineAction({
  access: 'user',
  expose: true,
  input: z.string().min(1),
  execute: ({ input, ctx, services }) => {
    if (!services.bookmarks.store.remove(ctx.user.id, input))
      throw new OperationError('NOT_FOUND', 'This bookmark no longer exists.');
  },
});
```

| Code                    | Status | Means                                                                           |
| ----------------------- | ------ | ------------------------------------------------------------------------------- |
| `BAD_REQUEST`           | 400    | Invalid input; `issues: [{ path, message }]` name the fields                    |
| `UNAUTHORIZED`          | 401    | Not signed in                                                                   |
| `FORBIDDEN`             | 403    | `reason`: `NO_ACTIVE_ORGANIZATION`, `NOT_A_MEMBER`, `PERMISSION`, `INTERCEPTED` |
| `NOT_FOUND`             | 404    | Unknown or private operation, or your own "no such thing"                       |
| `CONFLICT`              | 409    | `reason: 'ORGANIZATION_CHANGED'`, or your own conflict                          |
| `TOO_MANY_REQUESTS`     | 429    | Yours to throw (no built-in rate limit)                                         |
| `INTERNAL_SERVER_ERROR` | 500    | An unexpected error; `requestId` matches the server log                         |
| `SERVICE_UNAVAILABLE`   | 503    | Server unreachable, failed to start, or no operations configured                |

`METHOD_NOT_SUPPORTED` (405), `PAYLOAD_TOO_LARGE` (413) and `UNSUPPORTED_MEDIA_TYPE` (415) come
from the HTTP handler. `remote` rejects with the same `OperationError`, and an Action's default
failure message shows its `safeMessage`. Word it per code with `failure`:

```ts
import { isOperationError } from '@bitakit/core';

// In a client Action: failure receives the rejected error.
const failure = ({ error }: { error: unknown }) =>
  isOperationError(error) && error.code === 'UNAUTHORIZED'
    ? 'Sign in to save bookmarks.'
    : isOperationError(error)
      ? error.safeMessage
      : 'Could not save the bookmark.';
```

Only `code`, `message`, `issues`, `reason` and `requestId` leave the server; never put internal
details into a `safeMessage`.

## The route

One route serves every operation: `POST /api/rpc/<operation id>` with a JSON body.
`add action … --server` writes it when missing. Next.js, `src/app/api/rpc/[...path]/route.ts`:

```ts
import { fetchHandler } from '@bitakit/core/server';
import { server } from '@/bitakit.gen.server';

// Every BitaKit server operation the browser calls: POST /api/rpc/<operation id>.
export const POST = fetchHandler(server);
```

- TanStack Start: `src/routes/api/rpc.$.ts` with
  `createFileRoute('/api/rpc/$')({ server: { handlers: { POST: ({ request }) => handle(request) } } })`
  and `const handle = fetchHandler(server)`. A plain Vite app has no server to host it.
- `src/bitakit.gen.server.ts` is generated when a module has server content; never import it from
  browser code. Another path: `server: { endpoint: '/api/bitakit' }` in `bitakit.config.ts`
  (route and `remote` follow it).
- `fetchHandler(server, { trustedOrigins, origin, maxBodyBytes })`: browser calls must come from
  the app's origin (the browser's same-origin signal, the request URL or the `Host` it sent;
  `origin` names it behind a proxy) or an exact trusted origin; bodies are
  limited to 1 MiB. Cross-origin browser calls are not supported yet (no CORS preflight).
- Server code reuses an operation in-process with the request's identity:
  `await server.as(request).bookmarks.list()`. It runs the same checks and also reaches private
  operations.

## The `requestContext` provider

The app has one server service with `provides: requestContext`. It turns a request into a
verified identity. While a non-`public` operation exists and no provider does, the server refuses
to start and names the fix. With Better Auth and its organization plugin:

```ts
// src/server/services/request-context.ts
import { defineService, requestContext, type RequestIdentity } from '@bitakit/core/server';
import { auth } from '@/lib/auth'; // the app's Better Auth server instance

export default defineService(
  () => ({
    async resolve(request: Request): Promise<RequestIdentity> {
      const { headers } = request;
      const session = await auth.api.getSession({ headers });
      if (!session) return { user: null };
      const { id, name, email } = session.user;
      const user = { id, name, email };
      const organizationId = session.session.activeOrganizationId;
      if (!organizationId) return { user, organization: null };
      // Only an active, enabled membership of this user in this organization counts.
      const member = await auth.api.getActiveMember({ headers }).catch(() => null);
      if (
        !member ||
        member.organizationId !== organizationId ||
        member.userId !== id ||
        member.disabled === true
      )
        return { user, organization: null, reason: 'NOT_A_MEMBER' };
      return {
        user,
        organization: { id: organizationId },
        member: { id: member.id, role: member.role },
        can: async (permission) => {
          const permissions = Object.fromEntries(
            Object.entries(permission).map(([resource, operations]) => [resource, [...operations]]),
          );
          const result = await auth.api.hasPermission({ headers, body: { permissions } });
          return result.success === true;
        },
      };
    },
  }),
  { provides: requestContext },
);
```

- `member.disabled` exists only when the Better Auth member schema declares it
  (`additionalFields: { disabled: { type: 'boolean', required: false, input: false } }`); drop that
  line otherwise.
- Any other auth works the same way: read the request (a cookie, a bearer token, a gateway
  header), verify it with the library you use and answer `{ user, organization?, member?, can? }`:

```ts
// src/server/services/request-context.ts (without Better Auth)
import { defineService, requestContext, type RequestIdentity } from '@bitakit/core/server';
import { verifySession } from '@/server/session'; // the app's own check of the session cookie

export default defineService(
  () => ({
    async resolve(request: Request): Promise<RequestIdentity> {
      const session = await verifySession(request.headers.get('cookie'));
      if (!session) return { user: null };
      return {
        user: { id: session.userId },
        organization: session.organizationId ? { id: session.organizationId } : null,
      };
    },
  }),
  { provides: requestContext },
);
```

- Return an `organization` only for a verified, active membership, never for an organization ID
  the client merely sent. Without `can`, permission rules deny.
- A throwing `resolve` answers 500 and grants nothing. The provider runs only for non-public
  operations, once per call.

## Jobs and webhooks

Code that runs without a person – a scheduled job, a webhook you verified – calls operations as
`server.system('<plugin>.<job>', { organizationId, permissions: { resource: ['operation'] } })`.
Grant only what that job needs; never build a user or identity by hand.

## Another transport (oRPC, REST, OpenAPI)

Third parties or an oRPC client call the same operations through `@bitakit/orpc`; never write a
transport of your own:

```ts
import { openapiDocument, orpcHandler } from '@bitakit/orpc';
import { server } from '@/bitakit.gen.server';

export const rest = orpcHandler(server, { prefix: '/api/rest', protocol: 'openapi' });
export const spec = () => openapiDocument(server, { prefix: '/api/rest' });
```

Only exposed operations are reachable. Mark reading operations `type: 'query'` (GET in REST; give
their input schema coercion, query values arrive as strings) and use zod 4 schemas so the document
describes inputs and outputs.

## Test it

The test `add action … --server` writes calls the operation as three people. The same pattern:

```ts
// tests/bookmarks.server.test.ts
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { identity, mountServer } from '@bitakit/core/testing';

// The server half of bookmarks, booted once; as() calls it as different people.
const server = await mountServer('src/plugins/bookmarks');
after(() => server.stop());

test('each user sees only their own bookmarks', async () => {
  const ada = server.as(identity({ user: 'ada' }));
  const bob = server.as(identity({ user: 'bob' }));
  await ada.bookmarks.add({ url: 'https://example.com/' });
  assert.equal((await ada.bookmarks.list()).length, 1);
  assert.deepEqual(await bob.bookmarks.list(), []);
});

test('a signed-out caller and invalid input are refused', async () => {
  const anonymous = server.as(identity({ user: null }));
  await assert.rejects(anonymous.bookmarks.list(), { code: 'UNAUTHORIZED' });
  const ada = server.as(identity({ user: 'ada' }));
  await assert.rejects(ada.bookmarks.add({ url: 'not a link' }), { code: 'BAD_REQUEST' });
  await assert.rejects(ada.bookmarks.remove('missing'), { code: 'NOT_FOUND' });
});
```

- `mountServer(folder)` loads the folder's `events.ts`, `settings.ts`, `permissions.ts`,
  `configs/` and `server/` services, Actions and interceptors (tsconfig `paths` such as `@/` work)
  and boots them. A test provider answers every `as()` caller; it replaces the app's own.
- `identity({ user, organization, member, permissions, reason })`: `user: null` is signed out;
  `organization: 'org-1'` makes a member; `permissions: { todos: ['delete'] }` (or `'*'`) is
  exactly what `can()` grants.
- For organization data, test a member, a member of another organization and a signed-out
  caller, and pass `{ organizationId: 'org-1' }` as a stale page to see `CONFLICT`.
- `mountServer('src')` mounts the app module (unprefixed IDs); `mounted.import('src/server/db.ts')`
  returns the same module instance the operations use, to seed or inspect data.
- The client half calls its real server half in-process:
  `mountPlugin('src/plugins/bookmarks', { plugins: [shell], remote: server.as(identity()) })`.

## Same names, different rules on the server

| On the client                                     | On the server                                                                                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `settings.<plugin>.<name>.get()`                  | `await settings.<plugin>.<name>.load()` in an operation, `load(ctx)` elsewhere; `get()` throws. Needs a `settings.storage` provider; `device` settings stay in the browser |
| `store()` holds one user's UI state               | `store()` is process-wide, shared by every request: a cache, never user data                                                                                               |
| An interceptor's `before` returning `false` skips | It rejects the call with `FORBIDDEN` (`INTERCEPTED`); `before` sees validated input and `ctx`                                                                              |
| Events reach every listener in the browser        | Events stay in the server process (listeners get `{ signal, ctx }`); none reaches the browser                                                                              |
| Client interceptors match client Actions          | Client interceptors never match server Actions; use `server/interceptors/<name>.ts`                                                                                        |
| `contributions/<dir>/` for a kind's files         | Server-only kinds live in `server/contributions/<dir>/`; doctor and generation name a misplaced file                                                                       |

- A server service has no `remote`; it calls other server services directly.
- Server Action IDs may not use the segments `then`, `catch`, `finally`, `subscribe`, `toJSON`,
  `valueOf`, `toString`, `constructor` or `prototype`.

## Checks

- `npm run typecheck` (generates `src/bitakit.gen.server.ts` and types `remote`), then
  `npx bitakit doctor`: it fails when browser code imports a `server/` file,
  `@bitakit/core/server` or `bitakit.gen.server`, or server code imports React or its `ui/`, and
  warns when no route answers the endpoint or no service provides `requestContext`.
  `npx bitakit info` lists operations as `server:<id>`.
- Run the server tests, then use the feature in the running app signed in, signed out and, for
  organization data, after switching organizations.

## Explain it to the user

Name both halves and the rule: "Save is the button `bookmarks.add` in `actions/add.ts`; the
operation `server:bookmarks.add` in `server/actions/add.ts` stores the link for the signed-in
user only (`access: 'user'`) and is the only part the browser can call. Signed-out visitors get
'Sign in to continue.'" Say what is not done, such as replacing the in-memory map with the
app's database.
