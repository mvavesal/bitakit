# Slots (extension points)

Use this when one plugin should show something inside another plugin's page or inside the
Shell (header, sidebar, toolbar). The owner declares and renders a named slot; other plugins
fill it from their own folder.

## Declare a slot

`npx bitakit add slot-definition todos/toolbar` creates `src/plugins/todos/slots/toolbar.ts`.

```ts
import { defineSlot } from '@bitakit/core';

export default defineSlot({ accepts: 'actions' });
```

- The path is the ID: `todos/slots/toolbar.ts` is `todos.toolbar`; `slots/row/menu.ts` and
  `slots/row.menu.ts` are both `todos.row.menu`.
- The command writes `accepts: 'component'`. Set `accepts` to what the slot takes: `'actions'`
  (buttons, links, menu items), `'component'` (React widgets) or `'data'` (needs a `schema`).
- `policy` is `'list'` by default. `'single'` allows one occupant; a second one fails as a
  conflict. `'keyed'` requires a unique `key` per contribution (a repeated key fails as a
  conflict); the outlet picks one with `entryKey`.
- `payload` is a schema for context the owner passes to every outlet, such as a row ID.
- A declaration renders nothing. The owner also mounts an outlet (next section).

## Render the slot where it belongs

A component slot needs one line in the owner's UI: `<PluginSlot name="todos.footer" />`
(the sample page already does this). An actions slot uses `useSlot` and the standard `Button`.
Add this to `src/plugins/todos/ui/pages/index.tsx` (it already imports `Action` and `Button`),
add `useSlot` to its `@bitakit/ui` import and render `<TodosToolbar />` above the `<ul>`:

```tsx
function TodosToolbar() {
  const toolbar = useSlot('todos.toolbar');
  if (toolbar.error) throw toolbar.error;
  if (!toolbar.items.length) return null;
  return (
    <div role="group" aria-label="Todo actions" className="flex flex-wrap gap-2">
      {toolbar.items.map((item) => (
        <Action key={item.key} id={item.action}>
          <Button variant="outline" size="sm" />
        </Action>
      ))}
    </div>
  );
}
```

- Each item has `key`, `plugin`, `order`, `actionId`, `input` and `action` (the live control).
  Use `item.key` as the React key and pass `item.action` to `<Action id>`.
- An empty `<Button />` gets the Action's icon, title, disabled and pending state.
- `useSlot` also returns `payload`, `pending`, `phase`, `error` and `diagnostics`. Items stay
  empty while the slot is pending.
- For a slot with a payload, pass it at every outlet:
  `useSlot('todos.row.menu', { payload: { todoId: todo.id } })` or
  `<PluginSlot name="sidebar.footer" payload={{ collapsed }} />`.

## Contribute a component

`npx bitakit add slot summary/shell.header.end` creates
`src/plugins/summary/ui/slots/shell/header/end.tsx`.

```tsx
'use client';
import { useServiceState } from '@bitakit/ui';

export default function TodoCount() {
  // The fallback keeps the header stable while todos starts or when it is not installed.
  const count = useServiceState('todos.items', (state) => state.items.length, 0);
  return <span className="text-sm text-muted-foreground">{count} todos</span>;
}
```

- The file path is the full ID of the target slot (`todos.footer`, `shell.header.end`); your
  own plugin name is not added. Dots and folders are
  equal: `ui/slots/todos.footer.tsx` (the activity sample) equals `ui/slots/todos/footer.tsx`.
  Keep one file per slot per plugin; two spellings fail generation as a duplicate.
- For a slot with a payload, the component receives it:
  `({ payload }: SlotProps<'sidebar.footer'>)` with `SlotProps` from `@bitakit/ui`.
- Optional exports: `order` (ascending, default 0), `key` (required by keyed slots) and
  `when` (`({ payload }) => boolean`, filters per outlet).
- `ui/slots` files fill component slots only. Actions slots take Actions (next section).

## Place an Action in an actions slot

`npx bitakit add action print/list` creates `src/plugins/print/actions/list.ts` (ID `print.list`).

```ts
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Print list',
  slots: ['todos.toolbar'],
  execute: () => window.print(),
});
```

- `slots` chooses placement; `groups` never does. List several targets to show the same Action
  in several places, for example `['todos.toolbar', 'shell.toolbar']`.
- For a payload slot, map the payload to the Action input, for example for a `todos.row.menu`
  slot with payload `{ todoId }`:
  `slots: [{ slot: 'todos.row.menu', input: ({ payload }) => payload.todoId }]` (`order` and
  `key` also fit here).
- The owner's outlet decides the look; the Action supplies title, icon, guards and behavior.
- `npm run typecheck` rejects slot names that are not declared actions slots.

## Shell slots

The Shell layout is the `shell.layout` setting (`sidebar` or `navbar`).

| Slot                                               | Accepts                                     | Where it renders                                     |
| -------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------- |
| `shell.navigation`                                 | Actions, usually with `href` (`todos.open`) | Sidebar menu, or the top menu in `navbar`            |
| `shell.toolbar`                                    | Actions                                     | Header, right side, both layouts                     |
| `app-bar.end`                                      | component                                   | Header, right side, before the toolbar, both layouts |
| `shell.header.end`                                 | component                                   | Header, right side, after the toolbar, both layouts  |
| `shell.header.start`, `shell.header.center`        | component                                   | Header left / center, both layouts                   |
| `shell.content.before`, `shell.content.after`      | component                                   | Above / below every page, both layouts               |
| `shell.footer`                                     | component                                   | Page footer, both layouts                            |
| `sidebar.header`, `sidebar.body`, `sidebar.footer` | component, payload `{ collapsed }`          | `sidebar` layout only                                |

- Put header widgets in `shell.header.end` (the summary example). Use `shell.toolbar` for
  header buttons, so they keep the Shell's standard Button.
- For content that must stay visible in both layouts, use a header or content slot; the
  `sidebar.*` slots are not rendered in `navbar`.
- Further Shell slots (header rows, drawers, navigation groups, page states) are listed in the
  `@bitakit/shell` README; they render only in layouts that mount them.

## When nothing renders

- Check that an outlet is mounted: the owner's component calls `<PluginSlot>` or `useSlot`, the
  page is open, and the selected Shell layout renders that slot.
- Log `useSlot('todos.toolbar').diagnostics` in the outlet. `reason` is `ready`, `empty`,
  `filtered`, `initializing`, `validating-payload`, `update-pending`, `owner-unavailable`,
  `invalid-payload` or `binding-error`. `excluded` lists each skipped entry with its `id`,
  `plugin` and `reason` (`key`, `condition`, `action-hidden` or `action-unavailable`).
- Run `npx bitakit doctor`: it warns when a `ui/slots` file targets a slot nobody declares.
- Use only declared names: the Shell table above, `slots/` folders, or package slots. When no
  outlet exists where the user wants content, the owning plugin declares a slot and renders it.

## Explain it to the user

Name the owner and the contributor: "todos owns the `todos.toolbar` slot and shows it above the
list; the print plugin adds its 'Print list' Action there without changing todos." Say where it
appears (todos page, Shell header) and how to try it: open `/todos` and look for the new button
or widget. Removing the contributor's folder removes only its contribution.
