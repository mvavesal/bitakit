# @bitakit/ui

React bindings for the headless Foundation runtime. The optional `./components` entry provides shared standard visual components; Core remains independent of React and UI libraries.

- Main entry: FoundationProvider, generic form/dialog host, plugin rendering, and configuration hooks.
- `/actions`: ActionProvider, useAction, ActionBinding, and unstyled control/group bindings.

FoundationProvider owns the root ActionProvider by default and reuses an existing outer
provider during migration. `actionOptions` configures an owned provider; an outer provider
keeps ownership of its options. Generic UI and labels remain explicit here. The optional
Next adapter supplies its standard visual defaults and native navigation.

`useFoundationApp()` returns the existing runtime's public facade and subscribes to readiness.
Use `app.optional.services.documents` before mount or for an optional capability. Required
`app.services.documents` reports a structured FoundationServiceError when unavailable. Service data
still uses its own subscription hooks. Generated local and installed-plugin types drive completion;
manual compositions can use `useFoundationApp<typeof plugins>()` with a precisely typed
plugin tuple. `useFoundation()` remains available for low-level runtime/UI access.

`ActionButton`, `ActionBinding` and `useAction` also accept typed references such as
`app.actions.documents.create`. They use the same ActionList and existing execution
guards; references from another provider instance are rejected.


```tsx
import { ActionButton } from '@bitakit/ui/actions';
import { Button } from './components/ui/button';

<ActionButton action="content.create" as={Button} />
```


Core contains no React imports or renderer entry points. This adapter augments Core's opaque presentation types with React types. Runtime service registration and action execution stay in Core.

Migration: replace core/react imports with this package and core/actions/react with this package's /actions entry. Old ui/button, ui/label, and other primitive subpaths are removed; import your app's components directly. UI regression tests moved here from Core. Run npm test --workspace @bitakit/ui.


## Source organization

- `components/`: Action controls, menu rendering, dialogs and plugin views. These compose host controls; they do not vendor a design system.
- `hooks/`: React subscriptions and focus/config access.
- `providers/`: Shared React contexts and lifecycle providers.
- `bindings/`: Host component lookup and action projection.
- `types/`: Host UI contracts and React presentation typing.
- `index.ts` and `actions/index.tsx`: Stable public exports, without implementation.

Prefer reusable components with optional overrides over host factories and repeated setup code.

The optional `./components` entry exports StandardActionMenu, Button and DropdownMenu primitives. StandardActionMenu supplies standard controls to the generic ActionMenuView. Apps import it directly; Shell does not own a separate menu implementation. These components contain no app, Settings or Shell behavior and inherit central host theme tokens.

## Shared navigation and application headers

The optional `./components` entry also provides standard sidebar and navigation-menu primitives,
AppBar with left/center/right/bottom React content, and ActionSidebarNavigation/ActionNavigationMenu.
The action-aware renderers read the existing Foundation groups; they do not own an ActionList or
Shell preferences. Sidebar dependencies and the responsive hook are maintained once in this package.

`standardFoundationUI` supplies the standard Foundation visual mapping directly. Minimal hosts can
pass it to FoundationProvider without copying a component catalog. Field, Label, Badge and Dialog
are also available from the same visual entry.

## Stateful Action bindings

`useAction(app.actions.documents.save)` includes the inferred read-only custom state,
ActionStatus and the last execution error. ActionButton and ActionBinding continue using
the existing pending/visibility/enabled guards; no manual button status checks are needed.
Use the hook only for additional presentation, such as a saved-document counter.

```tsx
const action = app.actions.documents.save;
const save = useAction(action);
return <>
  <ActionButton action={action} input={{ title: 'My document' }}>Save</ActionButton>
  <span>{save?.state.savedCount ?? 0}</span>
</>;
```


### Action keyboard shortcuts

The existing root ActionProvider binds shortcuts once per registered Action using
[@tanstack/hotkeys](https://tanstack.com/hotkeys/latest/docs/overview). Buttons and menu mounting
are irrelevant to execution. Core declares vendor-independent `ActionShortcut` metadata; browser
registration lives in `src/bindings/action-shortcuts.ts`. `shortcuts={false}` disables it.

```tsx
const save = defineAction<void, void>({
  id: 'document.save',
  shortcut: { keys: 'Mod+Shift+S', scope: 'editor' },
  execute() { /* Save through the domain service. */ },
});
<ActionProvider shortcuts={{ scopes: ['global', 'editor'] }}>{children}</ActionProvider>
```

Unscoped actions use `global`, the only default active scope. Hosts may supply an element `target`
to restrict the keyboard surface. Scope changes and provider disposal remove owned bindings;
registration changes update the existing handle. Hidden, disabled, pending and internal Actions
cannot execute. The original ActionList remains responsible for final execution and interceptors.
Errors go to the existing `onError` callback without changing the Action rejection.

Inputs, selects, textareas and contenteditable ignore shortcuts by default. Explicit
`allowInInputs: true` opts in. Repeated keydowns, composition and already-handled events are ignored.
`Mod` means Command on macOS and Control elsewhere. Browser/OS-reserved combinations may never
reach the page; choose application combinations deliberately. No global search binding is added.

The library's `error` collision policy retains the first registration on a target and reports the
conflict through `onError`; no second action executes. Removing the owner lets the next registered
Action acquire the binding. The existing sidebar Mod+B shortcut uses the same manager and policy.
Avoid declaring a second owner for it. Separate app roots should use separate element targets.

StandardActionMenu displays the metadata with its existing DropdownMenuShortcut primitive.
Other renderers may opt in with `ActionShortcutLabel`; formatting is library-owned and begins after
hydration to avoid server/client platform mismatch. Rendering a label never binds a key.

### Translation

Use `const t = useTranslation()` from `@bitakit/ui` inside FoundationProvider.
Call `t('feature.key', { name: 'Ada' }, 'Fallback')`; values and fallback are optional.
`t.has(key)` delegates to the active translator. The hook follows runtime translation
notifications even when the provider keeps the same function identity. Replace the
translation integration through the existing Core `translationService` contract;
there is no global translator or second locale store.

`t.getCatalog(namespace?)` exposes raw grouped messages for native integrations and reacts to the same language notifications. Outside Foundation, the hook returns fallback text and no catalog.

### Translation catalogs

Package-owned English and German messages live in `locales/` and are exported as
`./locales/en.json` and `./locales/de.json`. Compose them in the host request configuration
with `mergePluginMessages`; app catalogs override matching keys in the same locale.

### Shared application theme

`./theme.css` exports the existing Foundation theme tokens and control geometry. The
examples' `apps/theme.css` is now an import facade; generated apps import the package
stylesheet directly. This is the same CSS, not a second theme or a new component package.

### Shared host composition

`StandardFoundationProvider` in the optional `./components` entry supplies standard
visuals, default labels and ordered `additionalPlugins` overrides for both host adapters.
It delegates lifecycle to the existing generic FoundationProvider. Next and TanStack own
their router/query providers and generated-config imports. Do not add framework imports,
a second runtime or query-state storage to UI. Core remains React-free.
Implementation: `src/components/standard-foundation-provider.tsx` and `foundation-labels.ts`.
