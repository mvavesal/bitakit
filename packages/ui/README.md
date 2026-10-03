# @bitakit/ui

React bindings for the headless BitaKit runtime. The optional `./components` entry provides
shared standard visual components; Core remains independent of React and UI libraries.

- Main entry: `FoundationProvider`, action bindings, service and event hooks, plugin rendering
  and configuration hooks.
- `/actions`: `ActionProvider`, `useAction`, `useActionGroup`, `<Action>`, `ActionButton`,
  `ActionLink` and `mergeProps` for standalone action lists.

## Provider

`FoundationProvider` mounts one runtime per configuration. It owns the root `ActionProvider`
by default and reuses an existing outer provider during migration. Apps render the generated
`BitaKitProvider` from `src/bitakit.gen.tsx`, which passes the discovered `config`; the
framework adapters add navigation and query state.

| Prop                        | Meaning                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `config`                    | The generated configuration (`createBitaKitConfig()`), or an explicit one                          |
| `additionalPlugins`         | Plugins added to the configuration; an entry with an existing ID replaces it in place              |
| `controls`                  | Prop-name adapters per control kind, for example `{ button: (s) => ({ isDisabled: s.disabled }) }` |
| `notify`                    | `(message, kind)` for action feedback toasts                                                       |
| `services`                  | Host services under their contract names, such as `{ auth }`                                       |
| `translate`, `labels`, `ui` | Translator, default copy and the standard visual mapping                                           |
| `actionOptions`             | Options of the owned `ActionProvider`, such as `shortcuts`                                         |
| `isolateFailures`           | Keep the app running when a plugin fails to start; on in development builds                        |

In development, a plugin that fails to start is turned off together with the plugins that
depend on it, and a startup report names the plugin, the cause and the file; a page that
still requires one of its services shows an explanation instead of crashing. Production fails
fast.

## Bind actions

```tsx
import { Action, ActionButton, useAction } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

<Action id="todos.add" input={draft}><Button /></Action>          // empty child: icon + title
<Action id="todos.open"><a /></Action>                              // link for actions with href
<Action id="todos.show-done" kind="toggle"><Switch /></Action>      // checked / onCheckedChange
<ActionButton action="todos.add" input={draft} as={Button} />       // sugar on <Action>

const add = useAction('todos.add', draft);
<button {...add?.props()}>{add?.title}</button>
```

`<Action id input kind?>` merges the control props into its child: handlers are chained, class
names joined and `disabled` combined. `kind` is `button`, `link`, `toggle`, `choice` or
`menuItem`; the default is `link` for actions with an `href`, otherwise `button`. A render
function receives the control. `useAction(id, input)` returns the resolved state (`title`,
`enabled`, `visible`, `pending`, `disabled`, `checked`, `value`, `href`, `status`, `error`), a
guarded `execute(input?)` and the prop getters `props()`, `linkProps()`, `checkedProps()`,
`valueProps()` and `menuItemProps()`; it returns `undefined` for an unregistered action. All
bindings also accept typed references such as `app.actions.todos.add`.

`useActionGroup(group, input?)` returns a group's visible actions as controls for menus,
toolbars and row actions; `ActionMenu` renders a group with the host menu component.
`ActionBoundary` gates children on an action's availability. `useActions()` lists public
snapshots.

## Read services, settings and events

```tsx
const items = useServiceState('todos.items', (state) => state.items, []); // reactive
const service = useService('todos.items'); // the instance
useEvent('todos.changed', (event) => {
  /* event.data */
});
const pageSize = useSetting('todos.pageSize'); // { value, ready, writable, pending, error, set, reset }
```

`useSetting(key)` reads one setting the runtime owns and writes through it; the value is the
confirmed value, `disabled` covers not loaded, read-only and saving. Layout and settings
hosts use `useSettingsCatalog()` (sections derived from every plugin's `settings.ts` and
`ui/settings/page.tsx`), `useNavigation(groups)` (bound navigation groups plus the router's
pathname, link and `isActive`), `useSlot(name)` (components plugins placed in a slot) and
`useCurrentPage()` (the current plugin page with its `layout` name). Dialog actions name a
frame kind (`dialog: { component, kind: 'sheet' }`); register frames on `FoundationProvider`
through `dialogs={{ sheet: SheetFrame }}`.

`useServiceState(name, selector?, fallback?)` subscribes to the store a service exposes as
`state` (or a `subscribe`/`getSnapshot` pair) and returns the fallback until the runtime is
ready. `useEvent` subscribes to the runtime bus with component cleanup (`useWatchEvent` is a
deprecated alias). `useFoundationApp()` returns the typed app facade (`app.services`,
`app.actions`, `app.config`, `app.has()`); `usePluginConfig(moduleId, path, fallback)` reads the
config snapshot.

## Plugin UI

`<PluginPage pathname? fallback? />` renders the plugin page registered for the current path
and passes `params` (`ui/pages/tasks/[id].tsx` receives `{ id }`); `<PluginSlot name />` renders
the components plugins placed in a slot. React providers from `ui/providers` wrap the app
automatically. `DialogHost` and `ConfirmDialog` render `dialog` and `confirm` actions through the
host's dialog primitives.

## Keyboard shortcuts

The root `ActionProvider` binds `shortcut` metadata once per registered action using
[@tanstack/hotkeys](https://tanstack.com/hotkeys/latest/docs/overview). Buttons and menu
mounting are irrelevant to execution; `actionOptions={{ shortcuts: { scopes: ['global', 'editor'] } }}`
activates scopes, `shortcuts: false` disables binding. Hidden, disabled, pending and internal
actions cannot execute. Inputs, selects, textareas and contenteditable ignore shortcuts unless
`allowInInputs: true`. `Mod` means Command on macOS and Control elsewhere. The collision policy
keeps the first registration and reports the conflict through `onError`. `StandardActionMenu`
displays shortcuts; other renderers may use `ActionShortcutLabel`, which formats after
hydration and never binds a key.

## Translation

`const t = useTranslation()` inside the provider: `t('feature.key', { name: 'Ada' }, 'Fallback')`,
`t.has(key)` and `t.getCatalog(namespace?)`. The hook follows runtime translation notifications.
Replace the translation integration through the Core `translationService` contract; there is
no second locale store. Package-owned English and German messages live in `locales/` and are
exported as `./locales/en.json` and `./locales/de.json`; compose them with
`mergePluginMessages`, where app catalogs override matching keys.

## Components and theme

The optional `./components` entry exports `Button`, `Input`, `Field`, `Label`, `Badge`,
`Dialog`, `DropdownMenu`, `Sidebar`, `NavigationMenu`, `Sheet`, `Skeleton`, `Tooltip`,
`Separator`, `PageHeader`, `AppBar`, `StandardActionMenu`, `ActionSidebarNavigation`,
`ActionNavigationMenu` and `standardFoundationUI`. These compose the host theme tokens and
contain no app, Settings or Shell behavior. `./theme.css` exports the shared theme tokens and
control geometry; generated apps import it through `src/bitakit.gen.css`.

## Client authentication

`useAuth` observes the registered `AuthService` and exposes its snapshot plus `signIn` and
`signOut`. `AuthBoundary` handles pending, authenticated, unauthenticated and error rendering
through host-supplied content; it uses the existing navigation binding for login. It has no
visual dependency and does not enforce server authorization. See
[configuration and adapter examples](../core/docs/auth.md).

## Source organization

- `components/`: `<Action>`, `ActionButton`, `ActionLink`, `ActionMenu`, `ActionBoundary`, dialog hosts, plugin pages and slots, standard primitives under `components/primitives`.
- `hooks/`: `useAction`, `useActionGroup`, `useService`, `useServiceState`, `useSetting`, `useSettingsCatalog`, `useNavigation`, `useSlot`, `useEvent`, `useFoundationApp`, `usePluginConfig`, `useTranslation`, `useAuth`.
- `providers/`: `FoundationProvider`, `ActionProvider` and the shared contexts.
- `bindings/`: keyboard shortcut registration.
- `utils/`: `mergeProps`.
- `types/`: host UI contracts and React presentation typing.
- `index.ts`, `actions/index.tsx`, `components.ts`: public exports without implementation.

Core contains no React imports or renderer entry points; this package augments Core's opaque
presentation types with React types. Run `npm test --workspace @bitakit/ui`.
