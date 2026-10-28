# Playground

One page, six tabs, each showing `defineAction` options with plain components bound by
`<Action>`. `ui/pages/index.tsx` lists the tabs and the files each one's Code drawer shows.

## Public contracts

- `services/demo.ts` (`playground.demo`): `state` (`liked`, `results`), `toggleLike(name)`,
  `search(query)`, `unlikeAll()`.
- `live-action.ts` (not discovered): `liveAction(config)` builds one live Action from a
  `LiveConfig` (number, places, title, tooltip, icon, enabled, visible, confirm, slow, message);
  placed in `shell.toolbar` and `shell.navigation` (input: the place) and the
  `playground.live` group, shown in the ticked places, shortcut Alt+number.
- `ui/providers/live.tsx`: adds a plugin `live-<number>` with that Action through
  `runtime.plugins.add`, removes and re-adds it after an edit, removes it with its
  configuration.
- `services/live.ts` (`playground.live`): `state.configs` (one to start), `add()`,
  `remove(number)`, `set({ number, ...change })`; `capacity` (5).
- `playground.live.add`, `playground.live.remove` (input: a number) and `playground.live.edit`
  (input: a number and the change), the one editor Action.
- Example Actions: `playground.open` (navigation), `hello`, `fail` (fails on purpose), `greet`
  (input: a name of 2+ letters), `slow`, `like` (input: a fruit; per-input), `search` (input:
  a query; latest), `reset` (asks first), `details` (dialog `ui/dialogs/details.tsx`),
  `shortcut` (Mod+Shift+H), `docs` (external link), `copy` and `print` (group
  `playground.more`).
- `actions/-wait.ts` is a helper, not an Action: the `-` prefix keeps discovery away from it. `ui/code.tsx` is the source drawer, `ui/docs.ts` the doc links.

## Checks

Tab 1: "Action 1" is in the app bar; **Add action** adds "Action 2"; on its tab, typing
"Deploy" renames it, ticking **Sidebar** and unticking **App bar** moves it, **Ask first** asks
before running, unticking **Enabled** disables it and **Remove** takes it out everywhere.
**Show source code** opens the highlighted files. Tab 3: **Greet** is disabled for "A" and
greets "Ada". Tab 4: typing "apr" into **Search fruit** shows only Apricot.
