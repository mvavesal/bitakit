---
'@bitakit/core': patch
'@bitakit/ui': patch
'@bitakit/discovery': patch
'@bitakit/cli': patch
'@bitakit/create-app': patch
'@bitakit/next': patch
'@bitakit/tanstack': patch
'@bitakit/packages': patch
'@bitakit/shell': patch
'@bitakit/app-preferences': patch
'@bitakit/quick-search': patch
'@bitakit/devtools': patch
'@bitakit/organizations': patch
'@bitakit/email': patch
'@bitakit/nodemailer': patch
'@bitakit/next-intl': patch
---

Every package ships an `AGENTS.md`: a guide for coding agents that use the package in an app,
with what it provides, how to extend or replace it, its rules and a minimal example. The app
development skill points agents to `node_modules/@bitakit/<name>/AGENTS.md`.
