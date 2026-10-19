# Actions

Use this for a button, link, menu entry, shortcut or any operation a control runs. Define it once in
the owning plugin; every bound control gets label, disabled, pending, confirmation and messages from it.

## Add an Action

```sh
npx bitakit add action todos/sort
```

- The file path is the ID, `<plugin>.<path>`: `actions/sort.ts` is `todos.sort`;
  `npx bitakit add action todos/bulk/archive` writes `actions/bulk/archive.ts`, ID `todos.bulk.archive`.
  The command never overwrites a file; to change the sample's `todos.clear`, edit `actions/clear.ts`.
  App-wide Actions live in `src/actions/<name>.ts` (ID `<name>`); create those by hand.
- Each file default-exports one `defineAction({ ... })`; prefix helper files with `-`. Renaming the
  file renames the ID; `npm run typecheck` flags stale IDs in `<Action>`, `useAction` and `slots`,
  but search interceptor `action` targets and `<id>.*` catalog keys yourself.
- `title` is a literal or a translation key; a `<id>.title` catalog entry wins over a literal.
  Without `title`, the last ID segment is used (`clear-done` shows "Clear done").

## Derive state from services and settings

`src/plugins/todos/actions/add.ts` (from the sample):

```ts
import { defineAction } from '@bitakit/core';

export default defineAction<string>({
  title: 'Add',
  // Bound buttons stay disabled while the input is empty or the list is full.
  enabled: ({ input, services, settings }) =>
    !!input?.trim() && services.todos.list.state.get().todos.length < settings.todos.limit.get(),
  execute: ({ services, input }) => services.todos.list.add(input),
});
```

- `title`, `description`, `tooltip`, `variant`, `href`, `enabled`, `visible`, `checked` and `value`
  take a value or a function of `{ input, services, config, settings, app }`. Functions re-run when
  a store or setting they read changes; `input` there is raw and may be `undefined` (menus, search).
- `enabled: false` disables bound controls and `visible: false` renders nothing; both block
  execution. They are UI rules, not server authorization.
- `input: z.string().trim().min(1)` (any Standard Schema or object with `parse`) replaces
  `defineAction<string>`: it infers the type and `execute` gets the parsed value. zod is not in the
  generated `package.json`; ask the user before adding it. A schema disables controls while the
  input is invalid only when `enabled` is not set.

## Run, confirm and report

`src/plugins/todos/actions/clear.ts`:

```ts
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Clear all',
  enabled: ({ services }) => services.todos.list.state.get().todos.length > 0,
  confirm: {
    title: 'Delete every todo?',
    description: 'This cannot be undone.',
    destructive: true,
  },
  execute: ({ services }) => services.todos.list.clear(),
  success: 'All todos deleted',
});
```

- `variant: 'destructive'` on an Action styles menu items only; give a bound `<Button>` its own
  `variant` prop.
- `execute` gets `{ input, services, config, settings, app, events, signal, id, get, update }`. Its
  return value becomes `{ status: 'completed', value }`; a throw makes the run fail.
- `confirm`: a string (title only), `{ title, description, destructive? }`, or a function returning
  one of those or `false` to skip the question. Declining skips the run with reason `cancelled`.
- `success` / `failure`: a string (tried as a translation key first), `{ messageKey, values }`,
  `false`, or a function of `{ result | error, input, services }`. Success is silent by default.
- `concurrency`: `'exclusive'` (default; skips a second run while one is pending), `'per-input'`
  (pending per input, as `todos.remove` does for rows) or `'latest'` (aborts the previous `signal`).

## Use another plugin's service and place the Action

`npx bitakit add action print/list` creates `src/plugins/print/actions/list.ts` (ID `print.list`):

```ts
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Print list',
  slots: ['todos.toolbar'],
  // todos.list belongs to another plugin; listing it turns a missing service into a startup error.
  requires: ['todos.list'],
  enabled: ({ services }) => services.todos.list.state.get().todos.length > 0,
  execute: () => window.print(),
});
```

- `requires` lists services of other plugins only; the plugin's own services need no entry.
- `slots` places the Action in a declared actions slot ([slots.md](slots.md) declares and renders
  `todos.toolbar`); `groups` is logical membership and never places UI.
- `shortcut: { keys: 'Mod+Shift+P' }` adds a keyboard shortcut with the same guards as a click. To
  block or check another plugin's Action, use an interceptor ([interceptors.md](interceptors.md)).
- `href` makes a navigation Action, like the sample's `todos/actions/open.ts`:
  `defineAction({ title: 'Todos', href: '/todos', slots: ['shell.navigation'] })`. The page is its
  own file ([plugins-and-pages.md](plugins-and-pages.md)).
- `dialog: { component, size? }` opens a `ui/dialogs/` component (`npx bitakit add dialog
<plugin>/<name>`) instead of running `execute`; defining both throws.

## Bind controls

`src/plugins/todos/ui/todos-controls.tsx` (render `<TodosControls />` from `ui/pages/index.tsx`):

```tsx
'use client';
import { useState } from 'react';
import { Action, ActionButton, ActionLink } from '@bitakit/ui';
import { Button, Input } from '@bitakit/ui/components';

export function TodosControls() {
  const [title, setTitle] = useState('');
  return (
    <div className="flex gap-2">
      <Input
        value={title}
        aria-label="New todo"
        onChange={(event) => setTitle(event.target.value)}
      />
      {/* An empty child receives the Action's title. Keep the draft when the run was skipped. */}
      <Action
        id="todos.add"
        input={title}
        onExecuted={(result) => result.status === 'completed' && setTitle('')}
      >
        <Button />
      </Action>
      <ActionButton action="todos.clear" as={Button} variant="outline" />
      <ActionLink action="todos.open" />
    </div>
  );
}
```

- `<Action id input onExecuted onError kind pending>` merges `onClick`, `disabled` and `aria-busy`
  into its one child; leave those to the Action. `onExecuted` also fires for `{ status: 'skipped' }`
  (declined confirm, interceptor).
- `ActionButton` and `ActionLink` take `action` (not `id`, which stays the HTML attribute) and `as`.
- An `href` Action renders as a real link (a plain `<a>` child becomes the router link). A hidden
  or unregistered Action renders nothing; a misspelled ID fails `npm run typecheck`.

## Build a custom control with useAction

`src/plugins/todos/ui/clear-button.tsx`:

```tsx
'use client';
import { useAction } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

export function ClearButton() {
  const clear = useAction('todos.clear');
  if (!clear?.visible) return null;
  return (
    <Button variant="outline" {...clear.props()}>
      {clear.pending ? 'Clearing…' : clear.title}
    </Button>
  );
}
```

- `useAction(id, input?)` is `undefined` until the Action is registered; then it holds the state
  (`title`, `enabled`, `visible`, `pending`, `disabled`, `status`, `error`, ...), the getters `props()`,
  `linkProps()`, `checkedProps()`, `valueProps()`, `menuItemProps()`, and `execute(input?)`, which
  resolves to the outcome and rejects on failure (the getters report errors for you).

## Keep several Actions in one file

`src/plugins/print/actions.ts` can hold `print.list` (same ID) instead of `actions/list.ts`:

```ts
import { defineAction } from '@bitakit/core';

export default {
  list: defineAction({
    title: 'Print list',
    slots: ['todos.toolbar'],
    execute: () => window.print(),
  }),
};
```

- Each key becomes `<plugin>.<key>`, so splitting into `actions/<key>.ts` later keeps the IDs; one
  ID in both forms fails at startup as a duplicate.
- A bare `export default defineAction(...)` in `actions.ts` fails at app start ("Collection needs
  named entries"); typecheck and doctor do not catch it.

## Explain it to the user

Name the owning plugin and ID (`todos.clear` in `src/plugins/todos/actions/clear.ts`), the service it
calls and where it appears (the todos page, `shell.navigation` or the `todos.toolbar` slot). Tell them
how to try it: open `/todos`, add a todo, use the button, and expect any confirmation or disabled rule.
