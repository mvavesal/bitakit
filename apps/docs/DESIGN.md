# Documentation design

The design authority for this workspace is upstream Fumadocs. The user selected its
standard documentation interface: use the neutral theme and preset, native layouts,
and default MDX components. This decision applies to `apps/docs`; it does not change
the Foundation applications' design system.

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

`app/global.css` imports Fumadocs' neutral theme and preset. Its scrollbar-gutter and
scroll-lock rules address layout stability; they do not establish a custom palette,
typography, spacing or component style. Keep future changes within upstream public
configuration and components.

The user requested a small code-block refinement on October 1: warm tinted surfaces,
no drop shadow and a subtle border. Central `--docs-code-background` and
`--docs-code-border` tokens apply to Fumadocs code-block figures in light and dark mode.
Preserve upstream syntax highlighting, copy controls, scrolling, typography and spacing.
The light surface is nearly neutral with a trace of warmth. In dark mode, match the
selected sidebar item's background: 10% primary over the card surface, with a subtle
neutral border. Reuse the upstream theme tokens for this match.

Check article navigation, search, narrow layouts and both themes in the rendered site
when these surfaces change. A successful build alone does not verify their appearance.

## Explanatory examples

The user requested theme-aware, interactive UI anatomy and more architecture/flow diagrams.
Use the standard Fumadocs Mermaid integration (`beautiful-mermaid`, server rendering) and
small MDX/React examples with existing code blocks/button variants. Reuse the central theme;
no separate visual system or diagram engine. The shared recipe and source locations are in
`.agents/skills/foundation-development/documentation-visuals.md`.
