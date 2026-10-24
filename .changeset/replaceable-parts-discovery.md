---
'@bitakit/discovery': patch
---

Layout files are candidates of `layout.<family>`: the app's `src/layouts/<family>.tsx` and
`src/layouts/<family>/<variant>.tsx`, and a plugin's `ui/layouts/...`. Families that no package,
plugin or app declares become app-owned single slots. `choose` in `bitakit.config.ts` picks the
occupant of single slots and reaches the runtime configuration. `describeBitaKit` lists
`layouts` (`{ family, variant, file }`) per module and returns `choose`.
