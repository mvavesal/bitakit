# Classic

Offers Shell's sidebar frame as a candidate for `layout.app`.

## Public contracts

- `ui/layouts/app.tsx`: `AppShell.Sidebar` with a label in its footer, and `AppShell.Content`
  with `AppShell.TopBar`. Candidate name: `classic`.

## Checks

With `choose: { 'layout.app': 'classic' }` in `bitakit.config.ts`, pages show the sidebar and
"Frame: the classic plugin"; without it, the app's own `src/layouts/app.tsx` renders.
