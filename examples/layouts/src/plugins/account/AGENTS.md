# Account

A demo sign-in page at `/account/login`. It sends nothing.

## Public contracts

- `ui/pages/login.tsx` exports `layout = 'auth'`, so the app's `src/layouts/auth/split.tsx`
  frames it.
- `account.open` links to `/account/login` in `shell.navigation`.

## Constraints and checks

No authentication is configured. Open `/account/login` on a wide window: the brand panel from
the split layout shows next to the form.
