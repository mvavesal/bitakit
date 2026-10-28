# Playground

One page, six tabs, each showing `defineAction` options with plain components bound by
`<Action>`. `ui/pages/index.tsx` lists the tabs and the files each one's Code drawer shows.

## Public contracts

- `services/demo.ts` (`playground.demo`): `state` (`liked`, `results`), `toggleLike(name)`,
  `search(query)`, `unlikeAll()`.
- `services/live.ts` (`playground.live`): `state` (place, title, tooltip, icon, enabled,
  visible, confirm, slow, message; `initial` holds the start), `set(patch)`.
- `playground.live` (`actions/live.ts`, input: `toolbar`, `navigation` or none): every field
  reads `playground.live`; placed in `shell.toolbar` and `shell.navigation` and shown only in
  the chosen place. Shortcut Alt+1. Its icon is `ui/live-icon.tsx`.
- `playground.edit` (`actions/edit.ts`, input: a partial state): the one editor Action.
- Example Actions: `playground.open` (navigation), `hello`, `fail` (fails on purpose), `greet`
  (input: a name of 2+ letters), `slow`, `like` (input: a fruit; per-input), `search` (input:
  a query; latest), `reset` (asks first), `details` (dialog `ui/dialogs/details.tsx`),
  `shortcut` (Mod+Shift+H), `docs` (external link), `copy` and `print` (group
  `playground.more`).
- `actions/-wait.ts` is a helper, not an Action: the `-` prefix keeps discovery away from it. `ui/code.tsx` is the source drawer, `ui/docs.ts` the doc links.

## Checks

Tab 1: "Live action" is in the app bar; typing "Deploy" into **Title** renames it; choosing
**Sidebar** moves it there; with **Ask first** a click asks before running; unticking
**Enabled** disables it. **Show source code** opens the highlighted files. Tab 3: **Greet** is disabled for "A" and
greets "Ada". Tab 4: typing "apr" into **Search fruit** shows only Apricot.
