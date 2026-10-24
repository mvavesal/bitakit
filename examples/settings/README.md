# Settings: saved preferences

A Greeting plugin whose page is controlled by four settings (text, switch, select, radio),
an app-wide setting, a custom Settings page body and an Action that resets everything.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

1. Open **Greeting**: it says "Hello, friend!".
2. Turn on **Formal greeting** right on the page.
3. Open **All greeting settings**, set your name and **Large** text, then go back and reload:
   the choices stay (saved in this browser).
4. Press **Reset greeting settings**.
5. Open **Settings → Company** and change the company name: the home page follows.

## What to look at

| File                                        | Role                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `src/plugins/greeting/settings.ts`          | Four settings in one declaration; generates `/settings/greeting`    |
| `src/settings.ts`                           | An app-wide setting with a plain key, `companyName`                 |
| `src/plugins/greeting/ui/pages/index.tsx`   | Reads settings with `useSetting`; renders one `SettingField` inline |
| `src/plugins/greeting/ui/settings/page.tsx` | Replaces the body of the generated settings page                    |
| `src/plugins/greeting/actions/reset.ts`     | Writes settings from an Action                                      |

Guide: [Add settings](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/guides/settings.mdx).
