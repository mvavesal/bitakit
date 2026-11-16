---
'@bitakit/create-app': patch
---

Start an app from a template: `--template <directory>` copies a template folder's files into the new app, adds its packages to `package.json` and its environment names to `.env.example`. A template is described by `bitakit.template.json` (name, frameworks, features, dependencies, env, next) and is checked before anything is written.
