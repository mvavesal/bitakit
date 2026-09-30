# Action groups and application renderers

Actions describe behavior. Groups are typed, stable extension points. The app chooses the presentation using the single root ActionList.

1. Define an `Action<Input>` or `URLAction`.
2. Register it once, with all its `groups`, and keep its cleanup handle.
3. Pass groups and context to `ActionMenu`, `ActionDrawer` or `ActionNavigationMenu`.

```tsx
const contribution = actions.register(new ExportMember(), {
  groups: [actionGroups.member],
  order: 50,
});
<ActionMenu
  groups={[actionGroups.member]}
  context={{ organizationId, member, canManage, refresh }}
  trigger={<Button aria-label="Member actions">…</Button>}
/>;
// Plugin/owner removal:
contribution.unregister();
```

The application renderers are under `apps/web/src/components/navigation`. They use `ActionGroupBinding` and `ActionMenuItem` from the package. Each menu sees current title, icon, tooltip, visibility, enabled and pending state. Shared action instances receive each row's context at execution; they never retain mutable row selection.

`src/actions/groups.ts` exports the built-in group handles. The root `src/actions/register.ts` registers navigation, account, preference and organization actions. Trusted plugin contributions use that same list. No second provider, registry or plugin loader is needed.

`Action`, `URLAction`, registration, execution, lifecycle and bindings live in `packages/core/src/actions`. Drawer-specific, user-menu-specific and SettingsAction classes have been removed. Settings remain independently registered in `src/settings/standard-settings.ts`.

## Execution

`ActionList.use()` registers cancellable asynchronous pre-execution checks. The app uses one interceptor for confirmation and to reject commands belonging to an organization that is no longer active. The server still enforces membership, suspension and roles.

`subscribeExecution()` observes started/completed/skipped/failed outcomes. Hosts can attach logging without modifying actions. This is a client execution stream; durable security auditing must record the verified server actor and server-confirmed result. Do not log whole input objects or credentials.

Native links retain new-tab, middle-click and copy-link behavior. They do not also invoke the command handler. Imperative URL execution reads the current href; navigation dispatch completion is not route-load completion. Only safe internal and HTTP(S) URLs are accepted.

## Active organization settings

The app has one shared `OrganizationProvider` backed by Better Auth. `useActiveOrganization()` exposes that current context throughout the application. The overview shows only the active organization; the switcher selects another or opens the create dialog.

Organization sections belong to a separate Settings scope: General and Members, with current/pending tabs. They use the same dialog/direct-page shell as personal settings. A section can set `showHeader: false` when its custom content supplies the shared PageHeader, allowing trailing actions without duplicate headings. The General page edits details directly.

Settings fetch the verified active organization's data from `/api/organizations/active`. Switching organizations unmounts the old forms and cancels old loads; late responses are checked against the requested organization. Legacy organization-detail links lead to the active organization's member settings and never silently switch organizations.

See [Actions quickstart](../packages/core/ACTIONS.md) and [Settings architecture](settings-architecture.md).
