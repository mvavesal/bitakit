---
'@bitakit/cli': patch
---

`bitakit shell` shows the app's frame (the replaceable part `layout.app`): what renders, the candidates and the choice. `bitakit shell use <name>` writes the choice into `bitakit.config.ts` and generates the wiring again; `bitakit shell reset` removes it. `--part <id>` does the same for another replaceable part such as `layout.auth`. The app-development skill explains how a plugin offers a frame as a shell.
