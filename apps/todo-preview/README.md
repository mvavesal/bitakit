# Todo preview

A generated Next.js app exercising BitaKit actions, services, native Better Auth accounts
and organizations, and generated settings. Styles come from the shared platform entry;
the sample has no per-component CSS fixes.

## Run locally

Install dependencies and build the workspace packages from the repository root. In this
app's ignored `.env.local`, set `TODO_PREVIEW_AUTH=memory` and set
`TODO_PREVIEW_PASSWORD` to a local test password (at least eight characters). Then run:

```sh
npm run dev --workspace todo-preview
```

Open `http://127.0.0.1:3103/auth/sign-in`. The seed creates `alice@example.test` and
`bob@example.test`, both using the configured test password. Alice owns Design Studio and
Alice private team; Bob is a member of Design Studio. Use the native user menu to add and
switch accounts, and the organization menu to select a workspace. The running preview's
credentials are also in the ignored `.env.demo-credentials.local` file.

This is an explicit local memory demo. Accounts and tasks are temporary and are lost when
the server process stops. Email delivery, external OAuth and a production database are not
configured. Do not use real passwords or customer data.

## What the sample demonstrates

- `/todos`: create, edit, complete and delete tasks. Clear all uses one action in both the
  page and sidebar, asks for confirmation, and rejects a changed account/organization.
- `/settings`: generated appearance and native account/organization settings.
- `src/plugins/todos`: service-owned state and operations, with ordinary `defineAction`
  bindings. No copied action registry or separate client session store.
- `src/app/api/tasks/route.ts`: app-owned server data, scoped by the verified native
  session and organization membership. Task IDs alone do not grant access.
- `src/server/auth.ts`: the local native memory adapter and seed, shared across Next route
  modules and development reloads.
- `src/components/workspace.tsx`: native composition. Public auth forms remain mounted
  during session revalidation, so switching browser focus does not erase typed input.

## Verify

With the preview server running, from this directory:

```sh
npm run typecheck
npm run test:preview
```

The browser scripts cover form focus/revalidation, login, task CRUD, organization and
account switching, settings, and Clear all in the page/sidebar. They create their own
tasks and disposable test organizations. Clear checks include cancellation, reload,
cross-organization preservation, context changes during confirmation, stale scope and
anonymous requests. They never send email or mutate a shared database.

The platform's clean installation and development/production CSS acceptance live in
`scripts/verify-generated.mjs` at the repository root; this sample is not a substitute
for those checks.
