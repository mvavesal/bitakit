# Using actions

The package owns reusable classes, registration, execution, subscriptions and UI bindings. The application supplies business behavior and a registration list.

## Three steps

1. Extend `Action<Input>` and implement `execute(input)`, or instantiate an existing class such as `URLAction`.
2. Add instances to `createActionList()` and pass the list to `ActionProvider`.
3. Use `ActionButton`, `ActionCheckbox`, `ActionRadioGroup` or `ActionLink`. Use `as` for your UI library or the single `useAction` binding hook for custom controls.

See [the package quickstart](../packages/core/ACTIONS.md) for complete examples.

## Application entry points

- `apps/web/src/actions/register.ts`: registers app actions and their groups.
- `apps/web/src/providers/actions-provider.tsx`: provides the localized app list using the package's Next.js adapter. No navigation, theme or authentication effects live here.
- `apps/web/src/actions`: application-specific behavior (theme, locale, sign-out, navigation entries and historical examples).
- `apps/web/src/settings/standard-settings.ts`: built-in settings catalog.
- `apps/web/src/settings/sections`: each section's content and contribution.
- `apps/web/src/components/settings/base`: product settings shell, navigation and routes.
- `apps/web/src/components/navigation`: product sidebar/user-menu layout using package bindings.

There is no app-level ActionButton/ActionLink/ActionMenuItem wrapper, no `lib/actions`, no `bootstrap` and no action-specific hooks folder. Historical page-owned demos use the package's shared registration lifecycle rather than separate per-demo hooks. The UI binding remains `useAction`; list/collection access and optional scoped registration are separate advanced operations, not extra steps for ordinary actions.

Theme and locale actions declare their setting and presentation. The optional `@bitakit/app-preferences/actions` adapter receives the existing AppPreferences once and owns their shared synchronization logic. The ActionProvider manages connection cleanup. Better Auth session actions keep their separate authentication subscription; the app adds no per-action bootstrap effects.

## Package internals

Small modules separate the observable Action class, list registration, execution lifecycle, external-instance subscriptions, reusable base classes, React integration and UI controls. `core.ts` is now an export entry point, not the implementation of the entire package.

## Adding settings

Add a SettingsSection under `settings/sections`, then include it in `standard-settings.ts`. The independent AppPreferences catalog owns settings; it does not require ActionProvider. Optional app actions subscribe to settings and forward writes. See `settings-architecture.md`.
