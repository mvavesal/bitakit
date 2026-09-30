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

Check article navigation, search, narrow layouts and both themes in the rendered site
when these surfaces change. A successful build alone does not verify their appearance.
