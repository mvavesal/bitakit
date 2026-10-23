# Todo preview

A verification fixture, not a starting point: a generated Next.js app that exercises BitaKit
Actions, services, native Better Auth accounts and organizations, and generated settings. To
start your own app, use `npx @bitakit/create-app` and its `--sample`. Styles come from the shared platform entry;
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
- Mod+K: search actual tasks through the Todo source. The compact All categories dropdown
  narrows only this dialog. `/settings/quick-search` owns the persistent source choice and shows
  its icon/title/description beside a Switch. Results link to the task's native hash anchor;
  recent results are re-read through the existing authenticated API and scoped to the active organization.
  The AppBar trigger keeps its native button behavior with the central input appearance and Search icon.
- `src/plugins/todos/setup.ts`: the owned optional search contribution; no host search registry.
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
npm run test:search
```

The browser scripts cover form focus/revalidation, login, task CRUD, organization and
account switching, settings, and Clear all in the page/sidebar. They create their own
tasks and disposable test organizations. Clear checks include cancellation, reload,
cross-organization preservation, context changes during confirmation, stale scope and
anonymous requests. They never send email or mutate a shared database.

The search check adds a temporary task and verifies its search result, source icon,
Settings source preferences, compact category filtering, native hash link, history and
organization isolation. It checks the trigger's central field surface and dialog bounds in
light/dark modes on desktop and mobile.

The platform's clean installation and development/production CSS acceptance live in
`scripts/verify-generated.mjs` at the repository root; this sample is not a substitute
for those checks.

Run `npm run test:settings` to verify native account/session cards, organization member and
invitation surfaces, and owner/member/email-verification guards against the running preview.
The test opens disposable browser sessions, cancels invitations without sending mail and
never modifies tasks or credentials. Incoming invitations require verified email; local
seed accounts deliberately retain Better Auth's unverified state.
