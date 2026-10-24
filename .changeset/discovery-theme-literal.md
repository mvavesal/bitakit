---
'@bitakit/discovery': patch
---

Emit app themes from `src/themes/*.json` as constant literals, so an app with a theme file passes
`typecheck` (`"schemaVersion": 1` stayed `number` and did not match Shell's option type).
