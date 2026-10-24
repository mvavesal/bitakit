# Layouts: frames and screens

Pages in different frames and the app's own error screens, each from one file.

## Run it

```sh
npm install
npm run dev
```

pnpm, Yarn and Bun work the same way (`pnpm install`, `pnpm run dev`). Open the address the
terminal prints. Coding agent? Run `npx bitakit init --update-agent-files` once to install the
BitaKit skill next to `AGENTS.md`.

## Try it

The start page links to each case:

| Page             | Frame                                     | File                                            |
| ---------------- | ----------------------------------------- | ----------------------------------------------- |
| `/account/login` | `auth` family, the app's split variant    | `src/layouts/auth/split.tsx`                    |
| `/welcome`       | A new `onboarding` family                 | `src/layouts/onboarding.tsx`                    |
| `/lab`           | Shell's `full-page` family                | `export const layout = 'full-page'` in the page |
| `/lab/crash`     | Breaks on purpose; the app's error screen | `src/ui/slots/screen.error.tsx`                 |
| `/nowhere`       | Unknown page; the app's not-found screen  | `src/ui/slots/screen.not-found.tsx`             |

A page joins a family with `export const layout = '<family>'`. The app's own file replaces
Shell's default; delete it and the default returns. `npx bitakit slots` shows which file
renders each part.

Guide: [Use a custom layout or screen](https://github.com/mvavesal/bitakit/blob/main/apps/docs/content/docs/guides/layouts-and-screens.mdx).
