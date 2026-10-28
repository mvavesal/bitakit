# Custom settings: validated, grouped and saved on a server

Settings beyond the basics: zod rules, cards, checkboxes and list controls in groups, a custom
settings page with a live preview, and a storage service that saves them in SQLite on the
server while device settings stay in the browser.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. You need Node.js 24: SQLite comes with it as `node:sqlite`. Coding agent? Run
`npx bitakit init --update-agent-files` once to install the BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Profile**, then **Edit profile** (or press Alt+Shift+P anywhere). The page under
   Settings → Account has three groups and a live preview on top.
2. Set **Display name** to "A": the field says "Use at least 2 characters." and nothing is saved.
   Set it to "Grace Hopper": the preview follows.
3. Reload, or open the app in another browser: still "Grace Hopper". The value lives in
   `data/settings.db` on the server.
4. On **Profile**, press **Pause notifications**: an Action writes two settings at once.
5. **Show tips on this device** is device-scoped: it stays in this browser and never reaches the
   server.

Delete the `data` folder to go back to the defaults.

## How it fits together

| Part                   | File                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| The settings and rules | `src/plugins/profile/settings.ts`                                |
| The custom page body   | `src/plugins/profile/ui/settings/page.tsx`                       |
| Reading and writing    | `ui/pages/index.tsx` (`useSetting`), `actions/pause.ts`          |
| Where values are kept  | `src/services/settings-storage.ts` (`provides: settingsStorage`) |
| The server             | `src/app/api/settings/route.ts`, `src/server/database.ts`        |

The storage service replaces browser storage for every setting with one file. It sends the
profile's user settings to the API route and leaves everything else, such as Shell's
appearance, in the browser. The route never trusts the browser: it reads the same
`settings.ts`, accepts only those keys and checks each value with `parseSetting`, so a bad
value gets the same message as in the field. Without sign-in, every visitor shares one
profile; with authentication, the route keys values by the signed-in user.

Basics first? See the [settings](../settings) sample.
