---
'@bitakit/shell': patch
---

Layouts and screens are replaceable parts. Shell declares `layout.app` (the whole frame),
`layout.auth` (new default: a centered column with the brand), `layout.error`, `layout.full-page`
and the screens `screen.not-found`, `screen.error` (payload `{ reset }`), `screen.forbidden` and
`screen.loading`. A file in the app or a plugin replaces a default: `src/layouts/auth.tsx`,
`ui/slots/screen.not-found.tsx`. `AppShell` gains a `layout` prop for framework files, and
`ShellAuthLayout`/`ShellErrorLayout` (`AppShell.AuthLayout`/`.ErrorLayout`) are exported.
