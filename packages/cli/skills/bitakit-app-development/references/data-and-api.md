# Load and save data on the server

Use this when data must survive a reload, be shared across devices or users, or needs the
server (a database, secrets, permission checks). Service stores live in browser memory, so the
plugin's server half owns the data and the client service keeps the browser's copy. The example
continues the Bookmarks feature from [worked-example.md](worked-example.md); the server half's
rules, the route and the identity provider are in [server.md](server.md). All code type-checks in
a create-app Next.js app with zod installed.

## Who does what

| Part                           | File                                                                           | Responsibility                                     |
| ------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Operations (server)            | `src/plugins/bookmarks/server/actions/{list,add,remove}.ts`                    | Check who calls, validate input, read and write    |
| Store (server)                 | `src/plugins/bookmarks/server/services/store.ts`                               | Data access, always filtered by the owner          |
| Route and identity (app, once) | `src/app/api/rpc/[...path]/route.ts`, `src/server/services/request-context.ts` | Serve every operation; verify the caller           |
| Service (browser)              | `src/plugins/bookmarks/services/list.ts`                                       | Call `remote`, hold the list and its loading state |
| Actions                        | `src/plugins/bookmarks/actions/*.ts`                                           | Run operations: pending state, failure message     |
| Page                           | `src/plugins/bookmarks/ui/pages/index.tsx`                                     | Show loading, error, empty and loaded states       |

Everything for the feature stays in its plugin folder. `server/` is never bundled for the
browser; the browser reaches it only through the exposed operations.

## The server half

Write `server/services/store.ts`, `server/actions/add.ts` and `server/actions/remove.ts` as in
[server.md](server.md), plus the operation that lists the caller's bookmarks.
`src/plugins/bookmarks/server/actions/list.ts`:

```ts
import { defineAction } from '@bitakit/core/server';

// The operation bookmarks.list: the signed-in user's bookmarks, nobody else's.
export default defineAction({
  access: 'user',
  expose: true,
  execute: ({ ctx, services }) => services.bookmarks.store.list(ctx.user.id),
});
```

- `npx bitakit add action bookmarks/add --server` writes the RPC route when the app has none and
  keeps the existing Save button; replace its template body with server.md's `add.ts`.
- Add the app's `requestContext` provider ([server.md](server.md#the-requestcontext-provider)).
  Until one exists, the server refuses to start because these operations need a signed-in user;
  doctor warns about it. The tests below pass without it: `mountServer` brings its own.
- The store is example storage in server memory. It resets when the server restarts (and in
  development when a server file changes); replace it with the app's database client.

## The service

`src/plugins/bookmarks/services/list.ts`:

```ts
import { defineService } from '@bitakit/core';

export type Bookmark = { id: string; title: string; url: string };

type State = { bookmarks: Bookmark[]; status: 'loading' | 'ready' | 'error'; error: string };

// The browser's copy of the signed-in user's bookmarks; the server half (server/) owns them.
export default defineService(({ store, events, remote, onStart }) => {
  const state = store<State>({ bookmarks: [], status: 'loading', error: '' });

  async function load(signal?: AbortSignal) {
    state.set((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const bookmarks = await remote.bookmarks.list(undefined, { signal });
      state.set({ bookmarks, status: 'ready', error: '' });
    } catch (error) {
      if (signal?.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      state.set((current) => ({ ...current, status: 'error', error: message }));
    }
  }

  // Startup does not wait for the network; pages show `status` while the list loads.
  onStart(({ signal }) => {
    void load(signal);
  });

  return {
    state,
    reload: () => load(),
    async add(url: string) {
      const bookmark = await remote.bookmarks.add({ url });
      state.set((current) => ({ ...current, bookmarks: [...current.bookmarks, bookmark] }));
      events.emit('bookmarks.added', { id: bookmark.id, url: bookmark.url });
    },
    async remove(id: string) {
      await remote.bookmarks.remove(id);
      state.set((current) => ({
        ...current,
        bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== id),
      }));
      events.emit('bookmarks.removed', { id });
    },
  };
});
```

- `remote.bookmarks.list` is typed from the operation: its input, its result and the fact that it
  is exposed. `npx bitakit generate` (the dev server does it on save) updates it.
- Failures reject with an `OperationError` whose `message` is written for users ("Sign in to
  continue.", "This bookmark no longer exists."); the store keeps it for the page.
- Start loading with `void load(signal)` in `onStart`. Awaiting it would hold up the whole
  app's startup until the network answers.
- Change the store only after the server confirmed the change, and emit events after that. On
  a failure the list stays as it was. Events stay in the browser; the server's own events never
  reach it.

## The Actions

`src/plugins/bookmarks/actions/add.ts` returns the service's promise:

```ts
import { defineAction, isOperationError } from '@bitakit/core';

export default defineAction<string>({
  title: 'Save',
  enabled: ({ input }) => URL.canParse(input?.trim() ?? ''),
  // Return the promise: the button stays pending until the server answers, and a throw fails the run.
  execute: ({ services, input }) => services.bookmarks.list.add(input.trim()),
  success: 'Bookmark saved',
  failure: ({ error }) =>
    isOperationError(error) && error.code === 'UNAUTHORIZED'
      ? 'Sign in to save bookmarks.'
      : 'Could not save the bookmark.',
});
```

`src/plugins/bookmarks/actions/reload.ts` (`npx bitakit add action bookmarks/reload`):

```ts
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Try again',
  execute: ({ services }) => services.bookmarks.list.reload(),
});
```

- Without `failure`, a failed run shows the `OperationError`'s message. Set it to word messages
  per code ([server.md](server.md#errors-the-ui-shows) lists the codes).
- `remove.ts` stays as in the worked example; returning `remove(input)` already returns the promise.
- The Save button's `enabled` rule is a convenience; the operation's `input` schema checks again.

## The page states

The worked example's page with a loading placeholder and an error state.
`src/plugins/bookmarks/ui/pages/index.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Action, useServiceState, useSetting } from '@bitakit/ui';
import {
  Button,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
  PageHeader,
  Skeleton,
} from '@bitakit/ui/components';

// Served at /bookmarks. State comes from the bookmarks.list service; buttons run Actions.
export default function BookmarksPage() {
  const [url, setUrl] = useState('');
  const bookmarks = useServiceState('bookmarks.list', (state) => state.bookmarks, []);
  const status = useServiceState('bookmarks.list', (state) => state.status, 'loading');
  const error = useServiceState('bookmarks.list', (state) => state.error, '');
  const openInNewTab = useSetting('bookmarks.openInNewTab').value;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bookmarks" subtitle="Links you want to come back to." />
      <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
        <Input
          value={url}
          type="url"
          placeholder="https://example.com"
          aria-label="Link to save"
          onChange={(event) => setUrl(event.target.value)}
        />
        {/* Clear the field only when the bookmark was saved. */}
        <Action
          id="bookmarks.add"
          input={url}
          onExecuted={(result) => result.status === 'completed' && setUrl('')}
        >
          <Button type="submit" />
        </Action>
      </form>
      {status === 'loading' ? (
        <Skeleton className="h-16 w-full" />
      ) : status === 'error' ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          Could not load bookmarks: {error}
          <Action id="bookmarks.reload">
            <Button variant="outline" size="sm" />
          </Action>
        </div>
      ) : bookmarks.length ? (
        <ItemGroup>
          {bookmarks.map((bookmark) => (
            <Item key={bookmark.id} variant="outline">
              <ItemContent>
                <ItemTitle>
                  <a
                    href={bookmark.url}
                    {...(openInNewTab ? { target: '_blank', rel: 'noreferrer' } : {})}
                  >
                    {bookmark.title}
                  </a>
                </ItemTitle>
                <ItemDescription>{bookmark.url}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Action id="bookmarks.remove" input={bookmark.id}>
                  <Button variant="outline" size="sm" />
                </Action>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      ) : (
        <p className="text-sm text-muted-foreground">No bookmarks yet. Paste a link above.</p>
      )}
    </div>
  );
}
```

- The selectors fall back to `'loading'` and `[]` until the service is ready, so the first
  render already shows the placeholder.
- The error state offers the `bookmarks.reload` Action instead of asking for a page reload.

## Test both halves

The server half has its own test ([server.md](server.md#test-it)). This one runs the client half
against it in one process: `remote` becomes the server's in-process caller for one person. It
replaces the worked example's test. `tests/bookmarks.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineContract, definePlugin, defineSlot, getService } from '@bitakit/core';
import { identity, mountPlugin, mountServer } from '@bitakit/core/testing';
import type list from '../src/plugins/bookmarks/services/list';

const bookmarks = defineContract('bookmarks.list').of<ReturnType<typeof list.create>>();
const shell = definePlugin({
  id: 'shell',
  slots: { navigation: defineSlot({ accepts: 'actions' }) },
});

// The client half with remote calling the real server half as the given person.
async function mountAs(person: ReturnType<typeof identity>) {
  const server = await mountServer('src/plugins/bookmarks');
  const plugin = await mountPlugin('src/plugins/bookmarks', {
    plugins: [shell],
    remote: server.as(person),
  });
  return {
    list: getService(plugin.services, bookmarks),
    plugin,
    stop: async () => {
      await plugin.stop();
      await server.stop();
    },
  };
}

test('saving goes through the server, and its errors reach the page state', async () => {
  const { list, plugin, stop } = await mountAs(identity({ user: 'ada' }));
  try {
    await list.reload();
    assert.equal(list.state.get().status, 'ready');

    assert.equal((await plugin.execute('add', 'https://example.com/docs')).status, 'completed');
    assert.equal(list.state.get().bookmarks[0]?.title, 'example.com');
    assert.equal(plugin.events.recorded.at(-1)?.type, 'bookmarks.added');

    // The server refuses an unknown ID; the list stays as it was.
    await assert.rejects(list.remove('missing'), /no longer exists/);
    assert.equal(list.state.get().bookmarks.length, 1);
  } finally {
    await stop();
  }
});

test('a signed-out visitor sees the server message instead of a list', async () => {
  const { list, stop } = await mountAs(identity({ user: null }));
  try {
    await list.reload();
    assert.equal(list.state.get().status, 'error');
    assert.equal(list.state.get().error, 'Sign in to continue.');
  } finally {
    await stop();
  }
});
```

- No HTTP server and no route run: `mountServer` boots the server half with a test identity, and
  `server.as(...)` checks access and input exactly as over HTTP.
- To test the client half alone, pass a stub instead:
  `remote: { bookmarks: { list: async () => [] } }` (with a cast, since it covers one operation).

## Data that belongs to the signed-in user

- The operations read the owner from `ctx` (`ctx.user.id`, or `ctx.organization.id` with
  `access: 'organization'`) and filter every query by it. Anything the browser sends, such as an
  organization ID kept in a store, is never proof of access.
- When the user or organization can change while the app is open, reload in the service when
  the `auth` service reports a different identity, and ignore answers that arrive for the
  previous one. Check `app.has('auth')` (Actions) or declare `requires` (services) first. For
  organization data, `remote` sends the organization the page shows; a stale page gets
  `CONFLICT` instead of writing to another organization.

## When a native route still fits

Keep a framework route in `src/app` (or `src/routes`) for what is not a call from this app's
browser: a webhook from another service, a file download or upload, a streamed answer, or a
public API for other clients. Such a route can reuse an operation with the caller's identity:
`await server.as(request).bookmarks.list()` (import `server` from `@/bitakit.gen.server`).

## Explain it to the user

Say where the data lives ("the `bookmarks` plugin's server half keeps each user's bookmarks;
the operations in `server/actions/` are the only part the browser can call, and each one checks
the signed-in user"), what the user sees while it loads or fails ("a placeholder, then the
list; on an error a message with Try again; signed out, 'Sign in to continue.'"), and what still
needs work, such as replacing the example's in-memory store with the app's database and adding
the app's `requestContext` provider.
