# App Shell layout proposal

Status: design for review, not an implemented API. This document describes a future implementation task; the current change is documentation only.

## Goal and implementation target

Evolve the existing `packages/shell` (`@bitakit/shell`) plugin into a small, composable application layout. Do not create another shell plugin, layout framework, provider hierarchy or discovery system.

Support three distinct needs:

1. Configure navigation placement within one standard shell: left, right or top.
2. Replace individual visual parts, such as navigation, header or mobile drawer, while keeping useful defaults.
3. Let the host select a substantially different layout component when necessary, for example an editor versus a dashboard.

A separate component is sufficient for the third case. A layout registry is deferred until independent plugins actually need to contribute layouts.

## Current implementation: verified starting point

- `src/plugin.tsx` defines the Shell plugin, registers its service and settings pages, and manages the optional theme projection through the existing runtime lifecycle.
- `src/services/shell.ts` currently exposes access to AppPreferences. It is not a layout registry.
- `src/app-shell.tsx` contains two built-in branches: sidebar and navbar. Navigation uses the existing Action groups and package bindings.
- The component already accepts brand, account and header content, a pathname and a host link component.
- Settings navigation, page and overview components also exist in this package. Their ownership is a separate decision; do not move them merely to implement layout customization.

## Smallest useful design

### Stable shell frame

Keep one content outlet at a stable position in the React tree. Placement changes should modify layout arrangement and shell chrome without reparenting or changing the key of the application content. Use existing layout primitives and central theme tokens.

Do not implement left, right and top by wrapping the entire application content in different component types. Do not use portals or a second React root simply to preserve content.

The content width and padding policy should have documented defaults and a small number of explicit options if real consumers need them. Do not introduce an unrestricted styling configuration language.

### Replaceable parts

Provide a small, typed component contract for navigation, header and mobile navigation. Existing brand/account content remains ordinary React composition. Built-in parts work without host registration or a component catalog.

Custom parts receive the relevant bound context: navigation groups, current path, host link component, placement and mobile open/close controls where applicable. They reuse existing Action bindings for execution, subscriptions, visibility and disabled/pending behavior. Shell must not create a second action store or cache copies of action state.

Use standard drawer/sidebar primitives for focus handling, keyboard behavior and mobile interaction. Custom rendering composes the existing design system rather than inventing visual controls.

### Whole-layout replacement

A host can compose its own layout component around page content using existing public navigation bindings and shell parts. This does not require registering every layout with Core.

Switching between unrelated layout component types may remount content. Do not promise preservation of arbitrary local React state in this case. State preservation is required for supported placement changes inside the standard stable shell. For route-specific layouts, retain native framework routing and layout composition.

## Illustrative usage

The following names describe the proposed API, not verified exports. Adapt them to existing public APIs during implementation.

```tsx
// Host composition: defaults require no custom renderers.
<AppShell
  placement="left"
  brand={<Brand />}
  account={<AccountMenu />}
  groups={['navigation']}
  pathname={pathname}
  linkComponent={Link}
>
  {children}
</AppShell>

// Override only the parts that need a different presentation.
<AppShell
  placement="right"
  parts={{
    Navigation: ProductNavigation,
    Header: ProductHeader,
    MobileNavigation: ProductDrawer,
  }}
  brand={<Brand />}
  account={<AccountMenu />}
  groups={['navigation']}
  pathname={pathname}
  linkComponent={Link}
>
  {children}
</AppShell>
```

The stable frame owns the content outlet; replaceable chrome does not own or reposition the children subtree. Navigation receives live Foundation bindings rather than a copied menu model. Define concrete part props from actual consumer needs before implementing them.

## Configuration, preferences and transient state

- Developer Configuration chooses supported parts and default layout behavior.
- App Preferences owns persisted user choices when the application exposes a layout selector. Shell reads and writes the same preference service; it does not create another preference store.
- A controlled placement prop and preference-driven placement must have an explicit precedence. Suggested rule: an explicit prop controls placement; otherwise use the existing layout preference, then the documented default. Do not synchronize a controlled prop back into persistence automatically.
- Drawer open state is transient UI state owned by the standard primitive/provider. Persist it only if a concrete product requirement appears.
- Preserve existing stored `sidebar`/`navbar` values. A compatibility mapping can interpret them as left/top; do not silently rename storage keys or discard saved choices. Decide how right placement is represented in the existing preference definition during migration.

The planned App Preferences rename is a separate coordinated change. Consume its actual available API and avoid conflicting edits with that implementation task.

## Foundation integration and boundaries

Reuse existing Core typed services, dependencies, ownership and cleanup. Core stays framework-independent and knows nothing about React shell parts. No new layout registry or repeated setup code is needed for ordinary host composition.

Preserve existing theme subscriptions and DOM projection behavior unless an explicit migration replaces them. Theme remains a preference projection, not a second authoritative store. Preserve package independence from authentication, databases and framework-specific routers.

Keep source organization shallow: plugin composition, service contract, shell components, navigation components and existing settings content have clear responsibilities. Reorganize only files affected by the change; avoid a broad package cleanup.

## Development sequence

1. Inspect current shell consumers, public exports, sidebar primitives and layout preference bindings. Document compatibility and any missing standard component capability.
2. Define the smallest typed placement and part contracts. Keep current default usage working; identify any necessary API migration explicitly.
3. Refactor the standard frame so left/right/top share a stable content outlet. Preserve mounted application content during placement changes.
4. Extract default visual parts and expose supported replacement points. Reuse Action bindings and existing standard controls.
5. Integrate existing preference values without a new store or implicit persistence writes. Coordinate with App Preferences changes.
6. Migrate one real host and show default placement plus one custom navigation part. Do not add a gallery or new product features.
7. Update package documentation, verified examples and the Foundation development guide to match implemented behavior.

## Acceptance and verification

The implementation should demonstrate:

- Existing default Shell usage remains functional.
- Left, right and top arrangements use central theme tokens and existing components.
- An input value and component mount identity survive supported placement changes.
- Navigation reads current Actions and preserves link semantics and execution guards.
- Customizing one part leaves the other default parts usable.
- Narrow layouts use an accessible mobile navigation surface without whole-page overflow.
- Shell consumes confirmed preferences and preserves existing saved values.
- Removing the plugin cleans up its owned subscriptions/contributions.
- No additional layout discovery, parallel runtime, navigation store or preference authority is introduced.

For the implementation handoff, run feasible unit tests, lightweight component/integration tests and affected typechecks; builds are conditional on environment support. Browser automation, end-to-end tests and deployment are outside this handoff. Report browser-dependent responsive, focus and visual checks as pending later review when they cannot be verified. A passing build is not evidence of visual correctness.

## Deferred decisions

- Plugin-contributed layout registration and discovery.
- Arbitrary nested regions, docking, drag-and-drop layout editors and layout inheritance.
- Guaranteed state preservation across unrelated custom layout components.
- Moving generic Settings page shells into another package.
- Expanding theme ownership or adding a new theme service.

Revisit these only when a concrete consumer cannot be served by placement options, replaceable parts or normal host composition.
