---
'@bitakit/core': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
---

A discovered plugin can install a contribution kind from a file: `installers/<kind>.ts` (browser) or `server/installers/<kind>.ts` (server), default-exporting `defineInstaller<'<kind>'>(…)`. Discovery turns them into the plugin's `installs`; `bitakit add installer <plugin>/<kind> [--server]` writes one.
