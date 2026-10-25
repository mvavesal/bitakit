# Documentation design

Use upstream Fumadocs layouts and components with BitaKit's shared website palette.
The user's October 25 decision replaces the earlier neutral-color choice with navy/gold
branding while retaining the standard documentation interface. `apps/brand-theme.css`
owns the colors for landing, docs and demo chrome; Core and application theme defaults
remain independent.

## Read mode

The primary task is reading English developer documentation, finding a relevant guide,
and following a working local quickstart. Keep navigation, article content and the
table of contents in their standard Fumadocs roles. Use the existing `DocsLayout`,
`RootProvider` and MDX component mapping rather than introducing a separate visual system.

## Content and interaction

- Maintain English guides in `content/docs` with accurate titles and descriptions.
- Keep the quickstart explicitly local and pre-release, using repository-built package
  archives until public installation is available. Site startup commands live in `README.md`.
- Use the existing local Orama search and standard search dialog, keyboard behavior and
  result navigation.
- Preserve upstream responsive navigation and readable articles on mobile, including
  usable code-block scrolling without whole-page horizontal overflow.
- Preserve the standard theme switcher and readable light and dark themes.

## Styling and verification

`app/global.css` imports Fumadocs' neutral theme and preset, then maps their public
`--color-fd-*` tokens to the shared `.site-theme` palette. Light-theme link text uses the
darker gold emphasis token for contrast; dark mode uses logo gold. Sidebar-local neutral
grays are mapped to the same navy tokens. Keep upstream typography, spacing, responsive
layouts, search and components. Scrollbar-gutter and scroll-lock rules preserve layout
stability. RootProvider retains the standard theme switcher and defaults to dark.
Dark hover, focus and selected surfaces use the shared navy accent/muted tokens, including
search portals and both sidebar variants. Keep primary text and buttons gold; the sidebar's
standard active state uses the navy accent surface instead of primary/10. Light mode is unchanged.

The user requested a small code-block refinement on October 1: warm tinted surfaces,
no drop shadow and a subtle border. Central `--docs-code-background` and
`--docs-code-border` tokens apply to Fumadocs code-block figures in light and dark mode.
Preserve upstream syntax highlighting, copy controls, scrolling, typography and spacing.
The light surface is nearly neutral with a trace of warmth. Dark code blocks retain their
10% primary tint over the card surface with a subtle border, independently of navigation's
navy selection surface. Reuse the upstream theme tokens.

Check article navigation, search, narrow layouts and both themes in the rendered site
when these surfaces change. A successful build alone does not verify their appearance.

## Explanatory examples

The user requested theme-aware, interactive UI anatomy and more architecture/flow diagrams,
then (2026-10-24) unified every diagram with the diagram-design agent skill. Draw diagrams with
that skill in the BitaKit profile (`.diagram-design`): HTML sources in `diagrams/`, light and
dark SVGs from `npm run diagrams`, shown with `<Figure name>`. Interactive UI anatomy stays as
small MDX/React examples with existing code blocks/button variants. No second diagram system. The shared recipe and source locations are in
`.agents/skills/foundation-development/documentation-visuals.md`.
