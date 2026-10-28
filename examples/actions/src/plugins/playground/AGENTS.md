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
- `services/live.ts` (`playground.live`): `state` (title, tooltip, icon, enabled, visible,
  clicks, samples), `set(patch)`, `click()`, `addSample()`, `removeSample()`, `reset()`.
- The live Action `playground.live.target`: every presentation field reads `playground.live`;
  placed in `shell.navigation`, `shell.toolbar`, the `playground.more` group and the live card.
  Its icon is `ui/live-icon.tsx`, a component that follows the state.
- Its controls: `playground.live.rename` (input: a title), `.tooltip` (input: a text, empty
  removes it), `.icon` (choice), `.enable` and `.show` (toggles), `.add` and `.remove` (sample
  items), `.reset`.
- `playground.sample.one`, `.two`, `.three` (built by `actions/-sample.ts`): visible once that
  many items were added; placed in `shell.navigation` and the slot `slots/samples.ts`
  (`playground.samples`, Actions), which `ui/live-card.tsx` renders.
- `actions/-wait.ts` and `actions/-sample.ts` are helpers, not Actions: the `-` prefix keeps
  discovery away from them.

## Checks

In the live card: renaming to "Ship it" shows "Ship it" in the sidebar and the app bar;
unticking **Enabled** disables it there; **Add an item** twice shows "Sample item 2" in the
sidebar; unticking **Visible** removes it everywhere.

On `/playground`: **Greet** is disabled for "A" and greets "Ada"; three clicks on **Click me**
show **Secret button**; typing "apr" into **Search fruit** shows only Apricot;
**Reset the playground** → **Confirm** shows "Playground reset" and **Click me** again.
