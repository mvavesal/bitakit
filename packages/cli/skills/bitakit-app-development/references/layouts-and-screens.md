# Layouts, screens and other replaceable parts

Use this when the user wants another look for a group of pages (sign-in, onboarding, error
pages), a different frame for the whole app, their own 404 or error screen, or a part of a
feature that other plugins may replace. One mechanism covers all of them: a **single slot** is a
replaceable part. Its owner renders a default; a file in your app or plugin replaces it.

## Which part to replace

| The user wants                                 | Part (single slot)                   | File                                                          |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Another frame for sign-in, sign-up and similar | `layout.auth`                        | `src/layouts/auth.tsx`                                        |
| Another frame for every normal page            | `layout.app`                         | `src/layouts/app.tsx`                                         |
| Another frame for error pages                  | `layout.error`                       | `src/layouts/error.tsx`                                       |
| A new kind of page, such as onboarding         | `layout.onboarding`                  | `src/layouts/onboarding.tsx` (declared automatically)         |
| Their own 404 page                             | `screen.not-found`                   | `src/ui/slots/screen.not-found.tsx` or a plugin's `ui/slots/` |
| Their own error page                           | `screen.error`                       | `ui/slots/screen.error.tsx`                                   |
| Their own access-denied or loading page        | `screen.forbidden`, `screen.loading` | `ui/slots/screen.<name>.tsx`                                  |
| A part of a feature that others may replace    | `<plugin>.<part>`                    | `slots/<part>.ts` with `policy: 'single'`                     |

The `layout.*` and `screen.*` parts come from `@bitakit/shell`; its `AGENTS.md` lists the
defaults. Run `npx bitakit slots` to see every part and which candidate renders it.

## Put pages into a layout family

A page names its family; the family's layout wraps it.

```tsx
// src/plugins/account/ui/pages/login.tsx — served at /account/login
'use client';
import { PageHeader } from '@bitakit/ui/components';

export const layout = 'auth';

export default function LoginPage() {
  return <PageHeader title="Sign in" subtitle="Welcome back." />;
}
```

- Shell ships defaults for `auth` (a centered column with the brand), `error` and
  `full-page`; `app` (or no export) is the normal frame and `blank` renders the page bare.
- Any other name is a new family: add `src/layouts/<family>.tsx`, and discovery declares it.
  A page that names a family nobody provides stops startup with the files to add.

## Replace a layout

```sh
npx bitakit add layout auth/split
```

```tsx
// src/layouts/auth/split.tsx — a variant of the auth family
import type { ReactNode } from 'react';

// The sign-in frame: a brand panel next to the form on wide screens.
export default function AuthSplitLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden bg-primary lg:block" />
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
```

- A layout receives the page as `children`; give `children` an optional type.
- `src/layouts/auth.tsx` is the variant `default`; `src/layouts/auth/<variant>.tsx` adds named
  variants. A plugin keeps its layouts in `ui/layouts/` (`--plugin <id>`).
- One candidate renders automatically. With several, choose one:

  ```ts
  // bitakit.config.ts
  import { defineBitaKit } from '@bitakit/discovery';

  export default defineBitaKit({ choose: { 'layout.auth': 'split' } });
  ```

## Replace the whole frame

`src/layouts/app.tsx` replaces Shell's sidebar or navbar frame for every normal page. Compose
Shell's parts so navigation, slots and the page spacing keep working:

```tsx
// src/layouts/app.tsx
'use client';
import type { ReactNode } from 'react';
import { AppShell } from '@bitakit/shell';

// The frame of every normal page: the sidebar and the page, without the header bar.
export default function AppFrame({ children }: { children?: ReactNode }) {
  return (
    <>
      <AppShell.Sidebar />
      <AppShell.Content>{children}</AppShell.Content>
    </>
  );
}
```

Parts: `AppShell.Sidebar`, `AppShell.TopBar`, `AppShell.Content` (takes `topBar`),
`AppShell.Surface`, `AppShell.Footer`, `AppShell.AuthLayout`, `AppShell.ErrorLayout`. A header
widget of another plugin keeps working as long as the frame renders its slot (`TopBar` renders
`shell.header.end` and `shell.toolbar`); check the pages that use header slots after replacing
the frame.

## Replace a screen

```tsx
// src/plugins/brand/ui/slots/screen.not-found.tsx
'use client';
import { Button } from '@bitakit/ui/components';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@bitakit/shell/pages';

// Replaces Shell's not-found screen in every place it appears.
export default function NotFoundScreen() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>Nothing here</EmptyTitle>
        <EmptyDescription>The page moved or never existed.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <a href="/">Go to the start page</a>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
```

The error screen receives `reset` when the framework can retry:

```tsx
// src/plugins/brand/ui/slots/screen.error.tsx
'use client';
import type { SlotProps } from '@bitakit/ui';
import { Button } from '@bitakit/ui/components';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@bitakit/shell/pages';

// Replaces Shell's error screen; reset retries when the framework offers it.
export default function ErrorScreen({ payload }: SlotProps<'screen.error'>) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>That did not work</EmptyTitle>
        <EmptyDescription>Try again in a moment.</EmptyDescription>
      </EmptyHeader>
      {payload.reset && (
        <EmptyContent>
          <Button onClick={payload.reset}>Try again</Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
```

- Screens render wherever Shell's page states render: the catch-all route for unknown paths,
  `src/app/(app)/error.tsx` and `src/app/not-found.tsx`.
- If a replacement throws, the default renders instead and the console names it.
- Never render raw error messages; they can leak server details.

## Make a part of your feature replaceable

Declare the part as a single slot and render it with your default:

```ts
// src/plugins/billing/slots/plan-card.ts
import { defineSlot } from '@bitakit/core';

// A replaceable part: one plugin may render the plan card instead of billing's default.
export default defineSlot({ accepts: 'component', policy: 'single' });
```

```tsx
// in src/plugins/billing/ui/pages/index.tsx
<PluginSlot name="billing.plan-card" fallback={<DefaultPlanCard />} />
```

Another plugin replaces it with `ui/slots/billing.plan-card.tsx`; the billing folder stays
unchanged. Add `payload` to the slot when the replacement needs data, and memoize the payload
object at the outlet.

## Who wins

1. `choose` in `bitakit.config.ts` (`'<plugin>'`, `'<plugin>:<variant>'` or `'<variant>'`).
2. The app's own file (`src/layouts/...`, `src/ui/slots/...`) beats plugins and packages.
3. The only remaining candidate.
4. Several candidates and no decision: the owner's default renders, the console reports the
   candidates once and `npx bitakit doctor` asks for a decision.

## Check it

1. `npm run typecheck`, `npx bitakit slots` (each part says which candidate renders) and
   `npx bitakit doctor` ("Replaceable parts are decided").
2. Open a page of the family (`/account/login`), an unknown path (`/nowhere`) for the
   not-found screen, and every page that uses header slots after replacing the frame.

## Explain it to the user

Name the part and the file: "the sign-in pages use the `auth` layout family; `src/layouts/
auth/split.tsx` replaces Shell's default, chosen in `bitakit.config.ts`." Say what still uses
the default and how to switch back: delete the file (or the `choose` entry) and Shell's
default returns.
