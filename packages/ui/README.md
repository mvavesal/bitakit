# @bitakit/ui

React bindings for the headless BitaKit runtime. The optional `./components` entry provides
shared standard visual components; Core remains independent of React and UI libraries.

## First binding

In an app with the generated BitaKit provider and an existing `counter.increment` Action:

```tsx
import { Action } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';

<Action id="counter.increment">
  <Button />
</Action>;
```

The Action supplies the label and guarded execution. To define that Action first, follow the
[small Counter lesson](../../apps/docs/content/docs/concepts/actions.mdx).
The provider and binding options below are reference material.

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
`ui/settings/page.tsx`), `useNavigation(slotName)` (bound navigation items plus the router's
pathname, link and `isActive`), `useSlot(name, { payload })` (typed action/component/data items, payload, pending and error) and
`useCurrentPage()` (the current plugin page with its `layout` name). Dialog actions name a
frame kind (`dialog: { component, kind: 'sheet' }`); register frames on `FoundationProvider`
through `dialogs={{ sheet: SheetFrame }}`. Two kinds work without a registered frame: `dialog`
(the default, with a visible header) and `command`, shadcn's CommandDialog composition for a
search palette whose content leads with its own search field; the title stays available to
assistive technology.

`useServiceState(name, selector?, fallback?)` subscribes to the store a service exposes as
`state` (or a `subscribe`/`getSnapshot` pair) and returns the fallback until the service and
its owner are ready. `useEvent` subscribes to the runtime bus with component cleanup. `useFoundationApp()` returns the typed app facade (`app.services`,
`app.actions`, `app.config`, `app.has()`); `usePluginConfig(moduleId, path, fallback)` reads the
config snapshot.

## Plugin UI

`<PluginPage pathname? fallback? unavailable? />` renders the plugin page registered for the current path
and passes `params` (`ui/pages/tasks/[id].tsx` receives `{ id }`); `<PluginSlot name payload? />` renders
the components plugins placed in a slot. Declared targets read owned live attachments;
legacy targets retain the existing view path. Hiding an outlet never detaches its entries.
Both paths retain the runtime-wide readiness barrier used by service hooks. `PluginSlot`
passes the validated payload to each component. Action and data slots use `useSlot` and the
owner's renderer. React providers from `ui/providers` wrap the app
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

See [the developer theme contract](THEME.md) for one host theme shared by Shell, settings,
Quick Search, native auth/organization controls and Devtools, including typography, border
width, shadows, focus and motion. Define tokens after the generated root CSS import;
consumer apps do not patch individual plugin selectors.

The optional `./components` entry exports `Button`, `Input`, `Field`, `Label`, `Badge`,
`Dialog`, `DropdownMenu`, `Sidebar`, `NavigationMenu`, `Sheet`, `Skeleton`, `Tooltip`,
`Separator`, `PageHeader`, `AppBar`, `StandardActionMenu`, `ActionSidebarNavigation`,
`ActionNavigationMenu` and `standardFoundationUI`. These compose the host theme tokens and
contain no app, Settings or Shell behavior. `./theme.css` exports the shared theme tokens and
control geometry; generated apps import it through `src/bitakit.gen.css`.

## Testing

`renderWithFoundation(element, { plugins, config, services, ui })` from `@bitakit/ui/testing`
mounts the element inside `FoundationProvider`, wrapped in `act`, and resolves after every
plugin's `onStart`. It returns `runtime`, `container`, `events.recorded`, `rerender(element)` and
`unmount()`. `events.recorded` lists `{ type, data }` of every event emitted while mounted,
startup included, in the shape `mountPlugin` records. `plugins` are added to `config` (an
existing ID is replaced in place); `services` are host services such as a fake `auth`. A failing
start rejects with the attributed startup error and leaves nothing mounted. The helper imports
no DOM implementation: install jsdom's `window` and `document` as globals first, as
`tests/support.mjs` does, and pass your own `ui` when the standard primitives are not wanted.

```js
import { renderWithFoundation } from '@bitakit/ui/testing';

const view = await renderWithFoundation(<PluginPage pathname="/notes" />, { plugins: [notes] });
await act(async () => view.container.querySelector('button').click());
assert.deepEqual(view.events.recorded, [{ type: 'notes.added', data: { title: 'Write tests' } }]);
await view.unmount();
```

Headless services, actions and events are tested without React through `mountPlugin` from
`@bitakit/core/testing`.

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
- `testing/`: `renderWithFoundation`, the `@bitakit/ui/testing` entry (needs `react-dom`; imports no DOM).
- `types/`: host UI contracts and React presentation typing.
- `index.ts`, `actions/index.tsx`, `components.ts`: public exports without implementation.

Core contains no React imports or renderer entry points; this package augments Core's opaque
presentation types with React types. Run `npm test --workspace @bitakit/ui`.

### Awaited runtime replacement

`FoundationProvider` uses Core's startup controller for fail-fast and isolation policies.
Changing configuration waits for the previous runtime's complete async cleanup, including
when intermediate configurations are skipped. Cleanup failure prevents automatic replacement.
`renderWithFoundation(...).unmount()` awaits this cleanup; recorded events include
`runtime.lifecycle`. Runtime state is available through `runtime.lifecycle.get()/watch()`.

Placed Action items expose `item.action`; pass that control to `Action`, `ActionButton` or `ActionLink` to preserve the outlet's mapped input. Groups remain logical queries. `PluginSlot` passes the validated outlet payload to contributed components.

Slot outlets accept `entryKey` to select a keyed component and return only entries whose optional
`when({ payload })` predicate matches that occurrence. Render with `item.key`; outlet filtering
never detaches the shared entry. `PluginSlot` forwards the parsed payload. The existing catalog
also carries each page's opaque `boundary`, including inheritance for additional pages.

`ActionControl.linkProps({ href })` lets a renderer adapt a URL for its route base/query while
retaining safe URL checks, disabled guards and consistent native/client navigation.

### Host updates and inspection

`useFoundation().runtime.reconcilePlugins(nextPlugins)` supports explicit compatible plugin
updates. Await its result from host management code. It preserves unrelated service instances
and keeps unaffected pages/widgets mounted. `useFoundationReady()` means initial readiness;
pass a plugin ID to observe that owner. `useService` and `useServiceState` follow ready instances
without detaching unchanged sources. `PluginPage` accepts an `unavailable` fallback; `useSlot`
exposes its declared owner's `phase`, with failed/blocked distinct from `pending`.
Affected pages/projections can remount; affected dialogs close before replacement. Provider
config prop changes still replace the whole runtime. This does not promise file-HMR state retention.

```tsx
import { useRuntimeInventory } from '@bitakit/ui';
function RuntimeStatus() {
  const snapshot = useRuntimeInventory();
  return <output>{snapshot.live?.phase}</output>;
}
```

The hook reads Core's shared versioned inventory with stable snapshots. It owns no application
values. Use ordinary Action/service hooks for interactive operations. App Preferences and
Devtools use this same inventory; static CLI fields may be explicitly unavailable.


### Isolate a widget render failure

`PluginSlot` isolates each component automatically. Healthy siblings remain mounted; its default
fallback names the plugin/slot and uses the existing host Button for retry. Override one outlet
with `errorFallback={({ error, retry }) => ...}` when needed. `SlotRenderError` includes `slot`,
`plugin`, `contribution` and `cause`; default UI never prints raw causes or stacks. Reporting uses
the existing provider `actionOptions.onError` callback.

Custom `useSlot` renderers can wrap each entry in `SlotErrorBoundary` with `slot`, `plugin`,
`contribution` and `children`. Keep the entry key stable and place the boundary inside access
controls. Explicit retry or a changed owner definition/component resets an error; unrelated
updates and equivalent stabilized payload objects do not. Context revalidation/hiding may unmount an occurrence and discard its local error. Retry does not restart services or attach twice.

This client render boundary uses `react-error-boundary`; it does not handle slot payload/binding
errors, server rendering, event handlers or later async failures. Suspense stays with the host.
A failing custom fallback propagates normally. Core lifecycle and shared inventory are unchanged.
