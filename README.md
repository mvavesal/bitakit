<p align="center">
  <img src="docs/assets/readme/bitakit-banner.png" alt="BitaKit — Your app. Your building blocks." width="1024">
</p>

# BitaKit

Build an application one feature at a time. A plugin groups the feature's files;
BitaKit connects them to your framework and manages their lifecycle.

## Start with one page

In a configured BitaKit app, create `src/plugins/counter/ui/pages/index.tsx`:

```tsx
'use client';
import { PageHeader } from '@bitakit/ui/components';

export default function CounterPage() {
  return <PageHeader title="Counter" />;
}
```

Open **`/counter`**. That is a complete plugin. Add other files only when the feature needs them.

## Learn one step at a time

| Step | Build                              | Guide                                                    |
| ---- | ---------------------------------- | -------------------------------------------------------- |
| 1    | An empty Next.js app               | [Quickstart](apps/docs/content/docs/quickstart.mdx)      |
| 2    | The one-file Counter page          | [Plugins](apps/docs/content/docs/concepts/plugins.mdx)   |
| 3    | One value and one method           | [Services](apps/docs/content/docs/concepts/services.mdx) |
| 4    | A button that increments it        | [Actions](apps/docs/content/docs/concepts/actions.mdx)   |
| 5    | A toolbar other plugins can extend | [Slots](apps/docs/content/docs/concepts/slots.mdx)       |
| 6    | One saved preference and its page  | [Settings](apps/docs/content/docs/concepts/settings.mdx) |

The lessons grow the same Counter. You have a working feature after step 4; the rest can wait.

These guides describe the **0.2 API in this checkout**. Use matching BitaKit package versions.
For unpublished source changes, [create an app from local packages](apps/docs/content/docs/local-development.mdx).
No publication is needed for that workflow.

## Read the documentation locally

Requirements: Node.js 24 and npm 10 or newer. From this repository:

```sh
npm ci
npm run dev:docs
```

Open [localhost:3002/docs](http://localhost:3002/docs). The site includes code highlighting,
search, short lessons and separate API references.

## Choose more when you need it

| Need                                     | Where to look                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Action inputs, confirmation or shortcuts | [Action reference](apps/docs/content/docs/reference/actions.mdx)             |
| Service dependencies and cleanup         | [Service reference](apps/docs/content/docs/reference/services.mdx)           |
| Contextual menus and custom widgets      | [Slot reference](apps/docs/content/docs/reference/slots.mdx)                 |
| Additional Settings pages                | [Settings reference](apps/docs/content/docs/reference/settings.mdx)          |
| Plugin updates and diagnostics           | [Runtime management](apps/docs/content/docs/concepts/runtime-management.mdx) |
| Shell, auth, organizations or email      | [Packages](packages/README.md)                                               |
| Trusted build-included package activation | [Package host adapter](packages/packages/README.md) |
| Headless runtime composition             | [Core](packages/core/README.md)                                              |
| CLI commands                             | [CLI](packages/cli/README.md)                                                |

## Boundaries

- Core runs without React; UI bindings and framework integrations are separate packages.
- Next.js is the main application walkthrough. TanStack Start is experimental.
- Plugins are trusted application code; discovery is not a remote installer or sandbox.
- Service stores are in memory. Settings use their storage contract. Domain persistence is yours.
- Explicit compatible plugin updates preserve unrelated services; structural changes need a
  runtime replacement. File HMR does not promise state preservation.
- Server Actions and protocol adapters remain separate work. Enforce permissions on the server.

## Contributing

Use the [contributor guide](apps/docs/content/docs/contributing.mdx) and the nearest `AGENTS.md`.
Keep public examples small, tested and in English. Private working analyses remain outside Git.

BitaKit is [MIT licensed](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for dependencies.
