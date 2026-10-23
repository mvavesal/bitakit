# Developer theme contract

For the step-by-step guide and built-in Appearance manager, read
[Themes and appearance](../../apps/docs/content/docs/concepts/theming.mdx).
The [Theme reference](../../apps/docs/content/docs/reference/theming.mdx) covers JSON files,
runtime selection and how they combine with this CSS contract.

A host defines its theme once. Shared controls, Shell, App Preferences, Quick Search,
Better Auth UI/organization screens and Devtools consume the same CSS variables. Core has
no CSS or React dependency. This contract uses ordinary CSS custom properties, Tailwind
theme variables and the existing native visual adapters.

## One root entry

Keep the generated app's CSS entry and put the host theme after the generated import:

```css
@layer theme, base, components, utilities;
@import 'tailwindcss';
@import '../bitakit.gen.css';
@import './theme.css';
```

In `theme.css`, declare tokens on `:root` and their dark variants on `:root.dark`. Tokens
inherit through the document, including menus, dialogs and notifications rendered in
portals. A scoped theme on a page wrapper does not reach portals outside that wrapper.
There is no second theme state or component registry. Shell continues to own saved
appearance preferences; an explicit square-corner or density choice remains meaningful.

```css
:root {
  --primary: oklch(0.48 0.12 235);
  --primary-foreground: white;
  --font-sans: Georgia, serif;
  --radius: 0.5rem;
  --border-width: 2px;
  --focus-ring-width: 3px;
  --theme-shadow-surface: 0 2px 8px rgb(0 0 0 / 12%);
  --theme-shadow-overlay: 0 8px 24px rgb(0 0 0 / 20%);
  --theme-shadow-control: 0 1px 2px rgb(0 0 0 / 12%);
  --theme-shadow-field: inset 0 1px 2px rgb(0 0 0 / 8%);
  --theme-control-gradient: none;
  --theme-motion-duration: 160ms;
  --theme-motion-ease: ease-out;
}
:root.dark {
  --primary: oklch(0.8 0.1 235);
  --primary-foreground: oklch(0.18 0.02 235);
}
```

No imports for individual auth buttons, plugin selectors or `!important` patches are
needed. Omitted optional finish/motion tokens keep the component's established default.
For a distributable theme, use a package's `bitakit.theme` entry and export its stylesheet
and `./package.json`; declare dependencies on the visual packages it intentionally maps.
Ordinary `bitakit.styles` entries cannot redefine the platform baseline. Host overrides
still belong after the generated package entry.

## Supported customization

| Axis            | Tokens                                                                                                                                                                                                                                                                       | Scope                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette         | `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--input`, `--border`, `--ring` | Existing semantic color roles; native auth colors map to these roles. Preserve readable foreground/background pairs.                                       |
| Navigation      | `--light--sidebar*`, `--dark--sidebar*`                                                                                                                                                                                                                                      | Existing separate sidebar palettes, including foreground, accent, primary, border and ring.                                                                |
| Typography      | `--font-sans`, `--font-heading`, Tailwind `--text-xs`, `--text-sm`, `--text-base`, etc., and `--font-weight-*`                                                                                                                                                               | Shared and native typography, including Quick Search. Font assets are supplied by the host.                                                                |
| Geometry        | `--radius`, `--corner-shape`                                                                                                                                                                                                                                                 | Shared radius scale and supported squircle surfaces; text inputs and functional circular controls retain their round-curve exceptions.                     |
| Borders/focus   | `--border-width`, `--focus-ring-width`, `--border`, `--input`, `--ring`                                                                                                                                                                                                      | Component border strokes, surface rings and keyboard-focus width. Borderless internal controls stay borderless.                                            |
| Surface shadows | `--theme-shadow-surface`, `--theme-shadow-overlay`                                                                                                                                                                                                                           | Cards/Shell surfaces and floating menus/dialogs/toasts respectively.                                                                                       |
| Control shadows | `--theme-shadow-control`, `--theme-shadow-field`                                                                                                                                                                                                                             | Button/toggle depth and surfaced text fields. Focus/validation rings are composed separately and remain visible.                                           |
| Hover/pressed   | `--theme-control-hover-shadow`, `--theme-control-hover-mix`, `--theme-control-pressed-shadow`, `--theme-control-pressed-scale`, `--theme-control-pressed-offset`                                                                                                             | The existing button interaction finishes. Disabled states and native interaction semantics remain upstream.                                                |
| Gradients       | `--theme-control-gradient`                                                                                                                                                                                                                                                   | Filled control backgrounds; `none` gives flat controls. Existing `--control-*` palette/depth tokens remain available.                                      |
| Motion          | `--theme-motion-duration`, `--theme-motion-ease`                                                                                                                                                                                                                             | Component transitions and entry/exit motion. Defaults retain their existing per-component timings. Reduced-motion preference forces this duration to zero. |

Layout dimensions, icon sizes, data visualizations and domain-specific illustrations are
not a universal appearance API. Arbitrary external widgets do not become compatible merely
by being installed; visual adapters must map their native theme API to these roles. CSS
outside the supported integration is not isolated by this contract.

## Verification and upstream updates

`scripts/fixtures/generated-theme.mjs` supplies one deliberately different host theme to
the packed `next-auth` generated-app scenario. It checks representative computed colors,
typography, strokes, shadows, focus, motion and portal inheritance across supported visual
packages in development and production, alongside the default-theme checks. Keep this
coverage when updating upstream components; never replace the mappings with local app CSS.

The underlying mechanisms are documented by
[Tailwind theme variables](https://tailwindcss.com/docs/theme) and
[HeroUI's theme variables](https://heroui.com/en/docs/react/migration/styling).

Empty surfaces (`data-slot="empty"`) share a subtle dashed border using `--border-width`
and `--border`. This default lives in the components layer, so host utilities or theme rules
can customize it without changing package components.

Native scroll containers inherit the central base-layer thin scrollbar rule. Optional
`--scrollbar-thumb` and `--scrollbar-track` override the default border/transparent colors.
Radix ScrollArea remains the standard custom scroll component for constrained tables;
ordinary settings pages need no local scrollbar CSS. Native geometry remains browser-owned.

The standard Checkbox uses `--radius-checkbox`, derived from `--radius` at 55%. It retains
the shared corner shape, so the default squircle is softly rounded and square themes remain square.
