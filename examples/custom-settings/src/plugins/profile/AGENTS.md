# Profile

A profile made only of settings, saved on the server.

## Public contracts

- `settings.ts`: `profile.displayName` and `profile.bio` (zod schemas), `profile.plan` (cards),
  `profile.channels` (checkboxes), `profile.digest` (radio), `profile.mutedWords` (list) and
  `profile.tips` (device scope). Page `/settings/profile`, category account, Alt+Shift+P.
- `ui/settings/page.tsx`: a live preview above the generated fields (`SettingsFields`).
- Actions: `profile.open` (navigation), `profile.pause` (writes `channels` and `digest`).

## Data

The app's storage service `src/services/settings-storage.ts` sends `profile.*` user settings to
`src/app/api/settings/route.ts`, which validates them against this `settings.ts` with
`parseSetting` and saves them in `data/settings.db`. `profile.tips` and every other plugin's
settings stay in browser storage.

## Checks

On `/settings/profile`, set the display name to "A": the field says "Use at least 2
characters." Set it to "Grace" and reload: still "Grace". Delete the data folder: back to "Ada
Lovelace".
