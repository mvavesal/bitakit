# @bitakit/ui — guide for agents

> For agents building an app with this package (it ships in `node_modules/@bitakit/ui`). To
> change the package itself, follow the repository's own AGENTS.md instead.

React bindings for the BitaKit runtime, plus the optional standard components
(`@bitakit/ui/components`, shadcn/Radix Vega) and the central theme (`@bitakit/ui/theme.css`).
`define*` helpers come from `@bitakit/core`, never from this package. The app skill
`bitakit-app-development` has the recipes; this is the map of the bindings.

## Bindings

| Need                            | Use                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| Run an Action from a control    | `<Action id input><Button /></Action>`, `ActionButton`, `ActionLink`                  |
| A custom control for an Action  | `useAction(id, input?)` with `props()`, `linkProps()`, `menuItemProps()`              |
| Show service state              | `useServiceState(name, selector, fallback)`; `useService(name)`                       |
| Read or change a setting        | `useSetting(key)` → `{ value, set, reset, disabled, ... }`                            |
| React to an event while mounted | `useEvent(name, handler)`                                                             |
| Render a slot                   | `<PluginSlot name payload fallback>{children}</PluginSlot>`, `useSlot(name, options)` |
| Navigation built from Actions   | `useNavigation(slot)`                                                                 |
| Translate in React              | `useTranslation()`                                                                    |
| A contribution's props          | `SlotProps<'slot.id'>` → `{ payload, children }`                                      |

`PluginSlot`: `fallback` renders when nothing is placed and replaces a failing occupant of a
`single` slot; `children` are passed to the occupant (a layout wraps the page).
`useSlot(name).diagnostics` explains an empty outlet (`reason`, `excluded`, `candidates`).

## Components and theme

Import standard components from `@bitakit/ui/components` (`Button`, `Input`, `Card`, `Item`,
`Field`, `Badge`, `Skeleton`, `PageHeader`, `Dialog`, `DropdownMenu`, `Sheet`, ...). Style with
the theme tokens (`text-muted-foreground`, `bg-card`) and layout utilities; no local colors,
radii or a second component library.

## Testing

`renderWithBitaKit(element, { plugins, config, services })` from `@bitakit/ui/testing` mounts the
provider in an existing DOM test setup (jsdom); it installs none.

## Rules

- Bind operations to Actions; do not call service methods from `onClick` (guards, pending
  state, confirmation and messages would be lost).
- Do not copy service state into `useState`; select it with `useServiceState`.
- Do not nest a second `ActionProvider` or runtime provider; the generated `BitaKitProvider`
  owns the one runtime.
