# Playground

One page that demonstrates every `defineAction` option, one Action file per option, in sixteen
numbered cards (`ui/groups.tsx` holds the groups and their pills).

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
  place, spotlight, clicks, samples), `set(patch)`, `move(place)`, `spotlight()`, `click()`,
  `addSample()`, `removeSample()`, `reset()`; `places` and `icons` list the choices.
- The live Action `playground.live.target` (input: a place, or none): every presentation field
  reads `playground.live`; `visible` shows it in a placement only when the input is the chosen
  place. Placed in `shell.toolbar` and `shell.navigation` (with their place as input), in the
  component slots `sidebar.header`, `sidebar.footer`, `shell.header.start` and
  `shell.content.before` (`ui/slots/*.tsx` through `ui/live-place.tsx`), in the
  `playground.more` group and in the live card. Its icon is `ui/live-icon.tsx`.
- Its controls: `playground.live.rename` and `.tooltip` (text fields: `value` plus a run per
  keystroke), `.icon` and `.place` (choices), `.enable` and `.show` (toggles), `.find` (the
  spotlight), `.add` and `.remove` (sample items), `.reset`.
- `playground.sample.one`, `.two`, `.three` (built by `actions/-sample.ts`): visible once that
  many items were added; placed in `shell.navigation` and the slot `slots/samples.ts`
  (`playground.samples`, Actions), which `ui/live-card.tsx` renders.
- `actions/-wait.ts` and `actions/-sample.ts` are helpers, not Actions: the `-` prefix keeps
  discovery away from them.

## Checks

In the live card: typing "Ship it" into **Title** shows "Ship it" in the app bar; choosing
**Sidebar footer** moves it there and shows "Look here: Sidebar footer"; unticking **Enabled**
disables it; **Add an item** twice shows "Sample item 2" in the sidebar; unticking **Visible**
removes it everywhere.

On `/playground`: **Greet** is disabled for "A" and greets "Ada"; three clicks on **Click me**
show **Secret button**; typing "apr" into **Search fruit** shows only Apricot;
**Reset the playground** → **Confirm** shows "Playground reset" and **Click me** again.
