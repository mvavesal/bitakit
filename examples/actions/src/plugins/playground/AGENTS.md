# Playground

One page, six tabs, each showing `defineAction` options with plain components bound by
`<Action>`. `ui/pages/index.tsx` lists the tabs and the files each one's Code drawer shows.

## Public contracts

- `services/demo.ts` (`playground.demo`): `state` (`liked`, `results`), `toggleLike(name)`,
  `search(query)`, `unlikeAll()`.
- `services/live.ts` (`playground.live`): `state` (`actions`, `selected`), `selected()`,
  `add()`, `remove()`, `select(index)`, `update(patch)`; `places`, `icons`, `capacity` (4).
- Live Actions `playground.live.first` to `.fourth` (built by `actions/-live.ts`, input: a place
  or none): every field reads entry `n`; placed in `shell.toolbar`, `shell.navigation` and,
  through `ui/slots/sidebar.footer.tsx` and `ui/slots/shell.content.before.tsx`, in those
  slots. Hidden until added; shown in a place only when the entry lists it.
- Editor Actions `playground.live.add`, `.remove`, `.select`, `.places`, `.title`, `.tooltip`,
  `.icon` (choices with `value`) and `.enable` (toggle).
- Example Actions: `playground.open` (navigation), `hello`, `fail` (fails on purpose), `greet`
  (input: a name of 2+ letters), `slow`, `like` (input: a fruit; per-input), `search` (input:
  a query; latest), `reset` (asks first), `details` (dialog `ui/dialogs/details.tsx`),
  `shortcut` (Mod+Shift+H), `docs` (external link), `copy` and `print` (group
  `playground.more`).
- `actions/-wait.ts` and `actions/-live.ts` are helpers, not Actions: the `-` prefix keeps
  discovery away from them. `ui/code.tsx` is the Code drawer.

## Checks

Tab 1: **Add action** shows "Action 1" in the app bar; typing "Deploy" into **Title** renames it
everywhere; ticking **Sidebar footer** and unticking **App bar** moves it; unticking **Enabled**
disables it. **Code** opens the highlighted files. Tab 3: **Greet** is disabled for "A" and
greets "Ada". Tab 4: typing "apr" into **Search fruit** shows only Apricot.
