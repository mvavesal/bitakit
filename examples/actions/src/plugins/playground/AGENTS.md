# Playground

One page that demonstrates every `defineAction` option, one Action file per option.

## Public contracts

- `services/demo.ts` (`playground.demo`): `state` (count, liked, favorite, sort, query,
  results), `increment()`, `toggleLike(name)`, `setFavorite(value)`, `setSort(value)`,
  `search(query)`, `reset()`.
- Actions: `playground.open` (navigation), `hello`, `greet` (input: a name of 2+ letters),
  `count`, `unlocked` (visible from count 3), `slow`, `reset` (asks first), `fail` (fails on
  purpose), `details` (dialog `ui/dialogs/details.tsx`), `like` (input: a fruit; per-input),
  `search` (input: a query; latest), `favorite` (toggle), `sort` (choice: `newest` or `name`),
  `shortcut` (Mod+Shift+H), `docs` (external link), `copy` and `print` (group
  `playground.more`).
- `actions/-wait.ts` is a helper, not an Action: the `-` prefix keeps discovery away from it.

## Checks

On `/playground`: **Greet** is disabled for "A" and greets "Ada"; three clicks on **Click me**
show **Secret button**; typing "apr" into **Search fruit** shows only Apricot;
**Reset the playground** → **Confirm** shows "Playground reset" and **Click me** again.
