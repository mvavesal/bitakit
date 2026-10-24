# Worked example: a Bookmarks feature from scratch

Use this as the model for a new feature: plan it, create the files, check it and report. The
feature lets users save links, open them and remove them. Every file below passes
`npm run typecheck` and `npx bitakit doctor` in a create-app app with Shell and App Preferences.

## 1. Plan before writing code

Map what the user asked for to BitaKit mechanisms, then tell the user the plan in one or two
sentences.

| The user wants                   | Mechanism                    | File in `src/plugins/bookmarks/` |
| -------------------------------- | ---------------------------- | -------------------------------- |
| A page listing saved links       | Page                         | `ui/pages/index.tsx`             |
| The list, shared by page/Actions | Service with a `store()`     | `services/list.ts`               |
| Save and Remove buttons          | Actions                      | `actions/add.ts`, `remove.ts`    |
| A link in the navigation         | Navigation Action            | `actions/open.ts`                |
| "Open links in a new tab"        | Setting                      | `settings.ts`                    |
| Other features may react         | Events `added` and `removed` | `events.ts`                      |

## 2. Create the files

```sh
npx bitakit add plugin bookmarks
npx bitakit add service bookmarks/list
npx bitakit add events bookmarks
npx bitakit add action bookmarks/add
npx bitakit add action bookmarks/remove
npx bitakit add settings bookmarks
```

The commands write templates; replace each body with the code below and remove the tutorial
comments.

## 3. Events

`src/plugins/bookmarks/events.ts`:

```ts
import { defineEvents, event } from '@bitakit/core';

// Other plugins listen with events.on('bookmarks.added', ...); payloads carry what changed.
export default defineEvents({
  added: event<{ id: string; url: string }>(),
  removed: event<{ id: string }>(),
});
```

## 4. Service

`src/plugins/bookmarks/services/list.ts`:

```ts
import { defineService } from '@bitakit/core';

export type Bookmark = { id: string; title: string; url: string };

// Saved links. They live in memory until the service loads and saves them through an API.
export default defineService(({ store, events }) => {
  const state = store<{ bookmarks: Bookmark[] }>({ bookmarks: [] });
  return {
    state,
    add(url: string) {
      const address = new URL(url);
      const bookmark = { id: crypto.randomUUID(), title: address.hostname, url: address.href };
      state.set((current) => ({ bookmarks: [...current.bookmarks, bookmark] }));
      events.emit('bookmarks.added', { id: bookmark.id, url: bookmark.url });
    },
    remove(id: string) {
      state.set((current) => ({
        bookmarks: current.bookmarks.filter((bookmark) => bookmark.id !== id),
      }));
      events.emit('bookmarks.removed', { id });
    },
  };
});
```

- The service owns the data; pages and Actions only read it and call its methods.
- `state.set` builds a new array each time; events go out after the change.

## 5. Actions

`src/plugins/bookmarks/actions/add.ts`:

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Save',
  // The button stays disabled until the field holds a full URL such as https://example.com.
  enabled: ({ input }) => URL.canParse(input?.trim() ?? ''),
  execute: ({ services, input }) => services.bookmarks.list.add(input.trim()),
  success: 'Bookmark saved',
});
```

`src/plugins/bookmarks/actions/remove.ts`:

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Remove',
  // Each row has its own pending state.
  concurrency: 'per-input',
  confirm: ({ input, services }) => ({
    title: `Remove ${
      services.bookmarks.list.state.get().bookmarks.find((bookmark) => bookmark.id === input)
        ?.title ?? 'this bookmark'
    }?`,
    description: 'The link is deleted from your bookmarks.',
    destructive: true,
  }),
  execute: ({ services, input }) => services.bookmarks.list.remove(input),
});
```

`src/plugins/bookmarks/actions/open.ts` (written by `add plugin`; shown tidied):

```ts
import { defineAction } from '@bitakit/core';

// The navigation entry; the page is ui/pages/index.tsx.
export default defineAction({
  title: 'Bookmarks',
  href: '/bookmarks',
  slots: ['shell.navigation'],
});
```

- A confirmation object needs both `title` and `description`.
- `per-input` lets two rows be removed at once; the default `exclusive` would block the second.

## 6. Setting

`src/plugins/bookmarks/settings.ts`:

```ts
import { defineSettings, setting } from '@bitakit/core';

export default defineSettings(
  { openInNewTab: setting({ default: true, label: 'Open bookmarks in a new tab' }) },
  { title: 'Bookmarks' },
);
```

This adds the page `/settings/bookmarks` with a switch; no UI code is needed.

## 7. Page

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
} from '@bitakit/ui/components';

// Served at /bookmarks. State comes from the bookmarks.list service; buttons run Actions.
export default function BookmarksPage() {
  const [url, setUrl] = useState('');
  const bookmarks = useServiceState('bookmarks.list', (state) => state.bookmarks, []);
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
      {bookmarks.length ? (
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

- A submit button inside a `<form>` lets Enter save; the Action supplies the label, the disabled
  state and the pending state, so the page sets none of them.
- The empty `<Button />` children get the Action titles ("Save", "Remove").
- The page has an empty state; with an API it also needs loading and error states
  ([data-and-api.md](data-and-api.md)).

## 8. Check it

1. `npm run typecheck`, then `npx bitakit doctor`.
2. Open `/bookmarks` in the running app. Type `https://nextjs.org/docs` and press Enter: the row
   appears and the field clears. With an empty field, Save is disabled.
3. Click Remove: a dialog asks "Remove nextjs.org?"; Confirm empties the list.
4. Open `/settings/bookmarks` and switch off "Open bookmarks in a new tab"; links now open in the
   same tab.

## 9. Test it (when the app has a test runner)

Ask before adding the runner ([testing-and-preview.md](testing-and-preview.md)), then run
`npx bitakit add test bookmarks` and replace the body. `tests/bookmarks.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineContract, definePlugin, defineSlot, getService } from '@bitakit/core';
import { mountPlugin } from '@bitakit/core/testing';
import type list from '../src/plugins/bookmarks/services/list';

const bookmarks = defineContract('bookmarks.list').of<ReturnType<typeof list.create>>();
// bookmarks.open targets shell.navigation; this stand-in owns that slot so the plugin starts without Shell.
const shell = definePlugin({
  id: 'shell',
  slots: { navigation: defineSlot({ accepts: 'actions' }) },
});

test('saving and removing a bookmark updates the list and emits events', async () => {
  const plugin = await mountPlugin('src/plugins/bookmarks', { plugins: [shell] });
  try {
    const list = getService(plugin.services, bookmarks);

    assert.equal((await plugin.execute('add', 'https://example.com/docs')).status, 'completed');
    const [saved] = list.state.get().bookmarks;
    assert.equal(saved?.title, 'example.com');
    assert.deepEqual(plugin.events.recorded.at(-1), {
      type: 'bookmarks.added',
      data: { id: saved?.id, url: 'https://example.com/docs' },
    });

    // The enabled rule blocks text that is not a URL, so nothing is saved.
    assert.equal((await plugin.execute('add', 'not a link')).status, 'skipped');
    assert.equal(list.state.get().bookmarks.length, 1);

    list.remove(saved!.id);
    assert.deepEqual(list.state.get().bookmarks, []);
    assert.equal(plugin.events.recorded.at(-1)?.type, 'bookmarks.removed');
  } finally {
    await plugin.stop();
  }
});
```

- A disabled Action resolves to `{ status: 'skipped' }`; a failing one rejects.
- `remove` has a confirmation, so the test calls the service method directly.

## 10. Report it

A good report names what changed, where it appears, how it connects and what was checked:

> I added a **Bookmarks** feature in `src/plugins/bookmarks`. It appears as "Bookmarks" in the
> navigation and at `/bookmarks`: paste a link and press Enter to save it, and use Remove to
> delete it after a confirmation. The `bookmarks.list` service holds the links, the Save and
> Remove buttons are the Actions `bookmarks.add` and `bookmarks.remove`, and other features can
> react to `bookmarks.added` and `bookmarks.removed`. "Open bookmarks in a new tab" is under
> Settings → Bookmarks. Typecheck and doctor pass, and I tried save, remove and the setting in the
> browser. The links live in memory, so a reload clears them until we save them through an API.

## Extend it

- Save the links on a server: [data-and-api.md](data-and-api.md) continues this example.
- Show the count in the Shell header: contribute `ui/slots/shell.header.end.tsx`
  ([slots.md](slots.md)).
- React in another feature: listen to `bookmarks.added` in that feature's service
  ([services-and-events.md](services-and-events.md)).
