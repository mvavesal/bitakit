# Best practices and common mistakes

Each rule names the mistake agents make most often, why it breaks, and the fix. The examples use
the Bookmarks feature from [worked-example.md](worked-example.md).

## Run operations through Actions

A service call in `onClick` loses what the Action provides: disabled and pending state, the
confirmation, success and failure messages, interceptors and keyboard shortcuts.

```tsx
// ✗ No pending state, no confirmation, errors vanish.
<Button onClick={() => services.bookmarks.list.remove(bookmark.id)}>Remove</Button>
```

```tsx
// ✓ The Action owns the label, guards and messages.
<Action id="bookmarks.remove" input={bookmark.id}>
  <Button variant="outline" size="sm" />
</Action>
```

For a control that needs its own markup, use `useAction(id).props()` ([actions.md](actions.md)).

## Read service state with a selector; do not copy it

Copying a store into React state shows stale data and renders twice.

```tsx
// ✗ A second copy that drifts from the service.
const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
useEffect(() => setBookmarks(service?.state.get().bookmarks ?? []), [service]);
```

```tsx
// ✓ Re-renders only when the selected value changes; [] until the service is ready.
const bookmarks = useServiceState('bookmarks.list', (state) => state.bookmarks, []);
```

Select the smallest value a component needs, such as `state.bookmarks.length` for a counter.

## Replace store values; never change them in place

`state.set` is what notifies pages and Actions. Changing the current value does not.

```ts
// ✗ Nothing re-renders; other readers see a changed array without notice.
state.get().bookmarks.push(bookmark);
```

```ts
// ✓ A new array, and every reader updates.
state.set((current) => ({ ...current, bookmarks: [...current.bookmarks, bookmark] }));
```

## Return the promise from `execute`

The Action waits for what `execute` returns. Without a return the run ends at once, the button
is not pending, and a failure becomes an unhandled rejection instead of a message.

```ts
// ✗ Braces without return: completes immediately, errors are lost.
execute: ({ services, input }) => {
  services.bookmarks.list.add(input);
},
```

```ts
// ✓
execute: ({ services, input }) => services.bookmarks.list.add(input),
```

## Read settings when you use them

A service factory runs before stored settings load, so a value read there stays at its default.

```ts
// ✗ Always the default value.
export default defineService(({ settings }) => {
  const newTab = settings.bookmarks.openInNewTab.get();
  // ...
});
```

```ts
// ✓ Read inside the method, at call time.
open(url: string) {
  window.open(url, settings.bookmarks.openInNewTab.get() ? '_blank' : '_self');
},
```

In React, use `useSetting('bookmarks.openInNewTab').value`; in Actions, the `settings` argument.

## Reach other features through their contracts

Importing another plugin's files ties the two folders together: removing or renaming one breaks
the other, and the import bypasses startup order and the missing-service check.

```ts
// ✗ In src/plugins/sharing: reaches into another plugin's folder.
import list from '../../bookmarks/services/list';
```

```ts
// ✓ src/plugins/sharing/actions/copy-links.ts: the service by name, declared as a dependency.
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Copy all links',
  requires: ['bookmarks.list'],
  execute: ({ services }) =>
    navigator.clipboard.writeText(
      services.bookmarks.list.state
        .get()
        .bookmarks.map((bookmark) => bookmark.url)
        .join('\n'),
    ),
});
```

Read the state with `useServiceState`, react to `bookmarks.added` with `events.on`, and add UI
through the owner's slots. A type-only import in a test is fine.

## Place UI with `slots`, not `groups`

`groups` is a logical label for queries; it never renders anything.

```ts
// ✗ Appears nowhere.
defineAction({ title: 'Bookmarks', href: '/bookmarks', groups: ['navigation'] });
```

```ts
// ✓ Shell renders it in the navigation.
defineAction({ title: 'Bookmarks', href: '/bookmarks', slots: ['shell.navigation'] });
```

## Load data in services, not in components

A `fetch` in a page runs again on every visit, is not shared with Actions or other features,
and leaves loading and error handling to each component. Load in the service's `onStart`, keep
`status` and `error` in its store, and let pages render them
([data-and-api.md](data-and-api.md)).

## Emit your own events after the change

Only the declaring plugin emits its events, and only after its state changed, so listeners read
the new state. To react to another feature, listen to its event; to need a new one, add it in
the owner.

```ts
// ✗ Emitted before the change, and from a plugin that does not own the event.
events.emit('bookmarks.added', { id, url });
```

```ts
// ✓ In the bookmarks service, after state.set(...).
events.emit('bookmarks.added', { id: bookmark.id, url: bookmark.url });
```

## Enforce permissions on the server

`enabled`, `visible`, `confirm` and interceptors shape the UI in the browser. Anyone can call
the API directly, so the API route checks the session and the input again.

## Give every list its states

Show an empty state ("No bookmarks yet"), a loading placeholder (`Skeleton`) and an error with a
retry Action. A blank area looks broken.

## Keep the generated and template code out of the result

- Never edit `src/bitakit.gen.*`; change the source file and run `npm run typecheck`.
- Replace template bodies, placeholder subtitles and tutorial comments from `bitakit add`, and
  delete files the feature does not use.
- Keep one feature in one plugin folder: deleting the folder removes the feature and nothing else.

## Replace parts through their slot, never by editing the owner

A sign-in frame, a 404 page or another plugin's card is a replaceable part (a single slot). Put
your version in your own folder and leave the owner unchanged.

```text
✗ Editing node_modules/@bitakit/shell or another team's plugin to change its not-found page.
✓ src/plugins/brand/ui/slots/screen.not-found.tsx  (or src/layouts/auth.tsx for a layout)
```

Deleting your file brings the default back. With several candidates, decide in
`bitakit.config.ts` (`choose`); see [layouts-and-screens.md](layouts-and-screens.md).

## Let a plugin introduce itself

Every installed `@bitakit/*` package ships an `AGENTS.md` with its IDs, extension points and
rules; read `node_modules/@bitakit/<name>/AGENTS.md` before using it. Give your own shared
plugins the same: a short `src/plugins/<id>/AGENTS.md` that names what the plugin owns
(services, Actions, events, settings, slots and replaceable parts), how other features extend
or replace it, and what must not change. Keep it current when the contract changes.

## Name things after the domain

| Kind    | Form                           | Examples                              |
| ------- | ------------------------------ | ------------------------------------- |
| Plugin  | The feature, usually a noun    | `bookmarks`, `billing`, `team`        |
| Action  | A verb, optionally with object | `add`, `remove`, `open`, `export-csv` |
| Service | What it holds                  | `list`, `feed`, `cart`                |
| Event   | What happened, past tense      | `added`, `removed`, `changed`         |
| Setting | The preference, in camelCase   | `limit`, `openInNewTab`               |
| Slot    | Where it renders               | `toolbar`, `footer`, `row.menu`       |

The plugin ID prefixes every name, so `bookmarks.add` reads as a sentence; do not repeat the
plugin in the file name (`actions/add.ts`, not `actions/add-bookmark.ts`).
