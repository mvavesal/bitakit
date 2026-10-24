---
'@bitakit/cli': patch
---

`bitakit add layout <family>[/<variant>]` writes a candidate of `layout.<family>`, with
`--plugin <id>` into an app plugin's `ui/layouts/`. `bitakit slots` shows which candidate renders
each replaceable part (`--json`: `selection`), and doctor checks that replaceable parts are
decided and that `choose` names single slots. The app skill gains the recipe
`layouts-and-screens.md`, and agents are told to read each package's `AGENTS.md`.
