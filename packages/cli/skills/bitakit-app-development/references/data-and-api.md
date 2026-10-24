# Load and save data through an API

Use this when data must survive a reload, be shared across devices or users, or needs the
server (a database, secrets, permission checks). Service stores live in browser memory, so the
server owns the data and the service keeps the client's copy. The example continues the
Bookmarks feature from [worked-example.md](worked-example.md); all code type-checks in a
create-app Next.js app.

## Who does what

| Part               | File                                       | Responsibility                                         |
| ------------------ | ------------------------------------------ | ------------------------------------------------------ |
| API route (server) | `src/app/api/bookmarks/route.ts`           | Validate input, check permissions, read and write data |
| Service (browser)  | `src/plugins/bookmarks/services/list.ts`   | Call the API, hold the list and its loading state      |
| Actions            | `src/plugins/bookmarks/actions/*.ts`       | Run operations: pending state, failure message         |
| Page               | `src/plugins/bookmarks/ui/pages/index.tsx` | Show loading, error, empty and loaded states           |

API routes are native framework routes in `src/app`, not plugin files; plugins have no server
part yet. Keep secrets and database code there only.

## The API route

`src/app/api/bookmarks/route.ts`:

```ts
import { randomUUID } from 'node:crypto';

type Bookmark = { id: string; title: string; url: string };

// Example storage: one list in server memory, lost on restart and shared by every visitor.
// Replace it with your database, and check the signed-in user before reading or changing data.
const bookmarks: Bookmark[] = [];

export async function GET() {
  return Response.json({ bookmarks });
}

export async function POST(request: Request) {
  // The client's enabled rule is a convenience; the server validates again.
  const { url } = (await request.json().catch(() => ({}))) as { url?: unknown };
  if (typeof url !== 'string' || !URL.canParse(url))
    return new Response('Send a full URL such as https://example.com.', { status: 400 });
  const address = new URL(url);
  const bookmark = { id: randomUUID(), title: address.hostname, url: address.href };
  bookmarks.push(bookmark);
  return Response.json({ bookmark }, { status: 201 });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  const index = bookmarks.findIndex((bookmark) => bookmark.id === id);
  if (index === -1) return new Response('This bookmark no longer exists.', { status: 404 });
  bookmarks.splice(index, 1);
  return new Response(null, { status: 204 });
}
```

- The example list also resets whenever the dev server reloads after a file change; a database
  does not.
- Answer errors with a short, user-readable text: the service passes it on and the Action shows it.
- Use the schema library the app already has (for example zod) for larger inputs; follow
  existing dependency authorization when adding one.
- For per-user data, read the session in the route and filter by the user. Client rules
  (`enabled`, `visible`, interceptors) only shape the UI.

## The service

`src/plugins/bookmarks/services/list.ts`:

```ts
import { defineService } from '@bitakit/core';

export type Bookmark = { id: string; title: string; url: string };

type State = { bookmarks: Bookmark[]; status: 'loading' | 'ready' | 'error'; error: string };

/** Throws the server's message so a failing Action shows it. */
async function send(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error((await response.text()) || response.statusText);
  return response;
}

// Bookmarks stored by the app's API route, src/app/api/bookmarks/route.ts.
export default defineService(({ store, events, onStart }) => {
  const state = store<State>({ bookmarks: [], status: 'loading', error: '' });

  async function load(signal?: AbortSignal) {
    state.set((current) => ({ ...current, status: 'loading', error: '' }));
    try {
      const response = await send('/api/bookmarks', { signal });
      const { bookmarks } = (await response.json()) as { bookmarks: Bookmark[] };
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
      const response = await send('/api/bookmarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const { bookmark } = (await response.json()) as { bookmark: Bookmark };
      state.set((current) => ({ ...current, bookmarks: [...current.bookmarks, bookmark] }));
      events.emit('bookmarks.added', { id: bookmark.id, url: bookmark.url });
    },
    async remove(id: string) {
      await send(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      state.set((current) => ({
        ...current,
        bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== id),
      }));
      events.emit('bookmarks.removed', { id });
    },
  };
});
```

- Start loading with `void load(signal)` in `onStart`. Awaiting it would hold up the whole
  app's startup until the network answers.
- Keep `status` and `error` in the store, next to the data, so every page shows the same state.
- Change the store only after the server confirmed the change, and emit events after that. On
  a failure the list stays as it was.
- The `signal` is aborted when the runtime stops; a cancelled load leaves the store alone.

## The Actions

`src/plugins/bookmarks/actions/add.ts` returns the service's promise:

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Save',
  enabled: ({ input }) => URL.canParse(input?.trim() ?? ''),
  // Return the promise: the button stays pending until the server answers, and a throw fails the run.
  execute: ({ services, input }) => services.bookmarks.list.add(input.trim()),
  success: 'Bookmark saved',
  failure: ({ error }) => (error instanceof Error ? error.message : 'Could not save the bookmark.'),
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

- Without `failure`, a failed run still shows the error's message. Set it to word the message
  for users.
- `remove.ts` stays as in the worked example; returning `remove(input)` already returns the promise.

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

## Test without a server

`mountPlugin` runs no server, so answer `fetch` in the test. This replaces the worked example's
test, which calls the in-memory service.
`tests/bookmarks-api.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineContract, definePlugin, defineSlot, getService } from '@bitakit/core';
import { mountPlugin } from '@bitakit/core/testing';
import type list from '../src/plugins/bookmarks/services/list';

const bookmarks = defineContract('bookmarks.list').of<ReturnType<typeof list.create>>();
const shell = definePlugin({
  id: 'shell',
  slots: { navigation: defineSlot({ accepts: 'actions' }) },
});

test('the list loads from the API and shows server errors on save', async (t) => {
  // No server runs in a headless test: answer the service's requests here.
  t.mock.method(globalThis, 'fetch', async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response('Send a full URL such as https://example.com.', { status: 400 })
      : Response.json({
          bookmarks: [{ id: '1', title: 'example.com', url: 'https://example.com/' }],
        }),
  );
  const plugin = await mountPlugin('src/plugins/bookmarks', { plugins: [shell] });
  try {
    const list = getService(plugin.services, bookmarks);
    await list.reload();
    assert.equal(list.state.get().status, 'ready');
    assert.equal(list.state.get().bookmarks.length, 1);

    // A failed run rejects with the Action's failure message; the list stays unchanged.
    await assert.rejects(plugin.execute('add', 'https://example.org'), /full URL/);
    assert.equal(list.state.get().bookmarks.length, 1);
  } finally {
    await plugin.stop();
  }
});
```

## Data that belongs to the signed-in user

- The route reads the session and returns only that user's data; it rejects requests without
  one (401) or without access (403).
- When the user or organization can change while the app is open, reload in the service when
  the `auth` service reports a different identity, and ignore answers that arrive for the
  previous one. Check `app.has('auth')` (Actions) or declare `requires` (services) first.
- Never decide access from client state alone, such as an organization ID kept in a store.

## Explain it to the user

Say where the data lives ("the server keeps the bookmarks in `src/app/api/bookmarks/route.ts`;
the `bookmarks.list` service loads them when the app starts"), what the user sees while it loads
or fails ("a placeholder, then the list; on an error a message with Try again"), and what still
needs work, such as replacing the example's in-memory storage with the app's database.
