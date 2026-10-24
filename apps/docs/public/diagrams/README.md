# Documentation diagrams

Generated files: do not edit. Each `<name>-light.svg` and `<name>-dark.svg` is exported from
`apps/docs/diagrams/<name>.html` by `npm run diagrams` (repository root), which uses the
diagram-design skill's exporter with system fonts. `layers` is also copied to `docs/assets/readme`
for the root README. Pages show them with `<Figure name="<name>" />`; titles and captions live in
`apps/docs/components/diagrams/figures.json`.
