# Unified Foundation app access

Status: local discovery and namespaced app access implemented. No commit or push.
The user authorized implementation after reviewing the initial proposal.

## Minimal Next host

```ts
// next.config.ts
import { withFoundation } from '@bitakit/next/config';
export default withFoundation({});
```

```tsx
// src/components/providers.tsx
'use client';
import { FoundationProvider } from '@bitakit/next';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <FoundationProvider>{children}</FoundationProvider>;
}
```

The adapter connects discovery, native navigation, standard UI and default labels.
Foundation owns the sole ActionProvider, or reuses an existing outer provider.
App Preferences supplies its own SettingsProvider when no host provider exists.
The native root layout and central theme/style imports remain host responsibilities.

No empty contribution folders, manual generated imports or default foundation.config.ts
are required. Build hooks write .foundation and foundation-env.d.ts internally.
An optional foundation.config.ts remains available for customization.

## Local plugin example

```text
src/plugins/documents/
  services/documents.ts
  actions/create.ts
```

```ts
// services/documents.ts
import { defineService } from '@bitakit/core';
export default defineService({
  create: () => ({
    createDraft(title: string) {
      return { title, status: 'draft' as const };
    },
  }),
});
```

```ts
// actions/create.ts
import { defineAction } from '@bitakit/core';
export default defineAction({
  execute: ({ app }) => app.services.documents.createDraft('New document'),
});
```

```tsx
const app = useFoundationApp();
return <ActionButton action={app.actions.documents.create}>Create</ActionButton>;
```

The plugin folder supplies its ID. Service names use relative service paths; Action IDs
combine plugin and relative action paths. Explicit IDs override inferred names.
No manifest, manual registration, service-key declaration or generic annotation is needed
for this example. Optional plugin.config.ts customizes plugin metadata; foundation.config.ts
can change the default plugin directory. Optional setup.ts retains the existing scoped setup
contract and cleanup ownership.

Generated types preserve service method inputs, outputs and promises. Action references
retain existing input/result contracts and guards, and can execute directly through
app.actions.documents.create.execute(). UI bindings reject references from another ActionList.
No new action-parameter system is introduced.

## Plugin selection and public services

Direct npm dependencies explicitly marked with Foundation package metadata can supply
a default plugin factory. Discovery emits imports and public-service types; the runtime
continues to own service creation, ordering and cleanup. Factories are evaluated per
provider composition, not as a global app singleton. Ordinary npm dependencies do not
become plugins merely because they are installed.

Plugins expose selected existing service keys through publicServices. An installed
Documents plugin can therefore provide this API with generated completion:

```tsx
const app = useFoundationApp();
const documents = app.optional.services.documents;
if (!documents) return null;
// Use the plugin's actual Documents contract here.
```

Required access through app.services.documents reports a FoundationServiceError when unavailable.
Optional access returns undefined. app.services projects existing service instances;
app.actions provides typed references backed by the existing ActionList. app.config projects immutable plugin snapshots from the existing configuration service. Public names are checked for collisions.

Service initialization still occurs on mount: use optional access or app.ready during
initial rendering. Service values require their existing subscription hooks; the app hook
only subscribes to runtime readiness. After runtime disposal, new reads cannot return its
disposed service instances. Previously retained service references must not be reused.

Generated types describe build-selected packages. Dynamic removal still requires optional
access or runtime error handling. TypeScript may reject statically absent properties before
execution; a runtime error cannot replace compiler or missing-import diagnostics.
For manually composed plugin tuples, use useFoundationApp<typeof plugins>() to retain their
public contracts. Broad Plugin annotations erase those specific public property types.

## Content Demo migration

- One visible FoundationProvider; no host ActionList or separate SettingsProvider.
- No direct .foundation import and no default foundation.config.ts.
- Preferences discovery comes from the installed package's metadata.
- Better Auth's existing composition helper also connects organization services and UI
  to the same auth client when its organizations option is supplied.
- Storage namespace, German labels, Shell options, auth choices and current toast wiring
  remain explicit application choices. Existing preference keys and routes are preserved.

## Boundaries and remaining product decisions

- Core stays independent of React, Next, visual libraries and Better Auth.
- Optional packages are not enabled indiscriminately. Preferences defaults to device-local browser storage; configured
  Shell/Auth composition and server persistence remain explicit; installing client UI never configures a backend.
- Toast unification, replaceable translation contracts and the broader TODO list remain
  separate work. This change does not switch libraries or add backend providers.
- The project generator CLI remains future work. Its scope is unavoidable native framework
  files, style imports and selected integration configuration, using these existing APIs.
  No CLI command or published package availability is claimed.

See the Core, UI, Next, App Preferences and Better Auth UI READMEs for the implemented
contracts and source responsibility maps. Validation is focused on types, provider ownership,
SSR/hydration, discovery and service lifecycle; a full application build or browser review
is not implied.

## Config, Settings and interceptor access

Config files support `defineConfig({ defaults: { pageSize: 20 } })`, with an optional schema.
Read `app.config.documents.editor.pageSize`; scoped reads still use runtime.configuration.
Settings definitions may omit the collection ID. Discovery derives it from the plugin and file
path and generates `app.settings.documents.editor.autosave`. An explicit ID replaces the prefix.
The handle supports get/set and existing SettingToggle/useSetting bindings, all backed by the
same AppPreferences instance. Binding initial renders use the existing static contribution snapshot.

App Preferences now opts into package composition with a browser-local default storage instance.
A configured additionalPlugins entry with the same plugin ID replaces the default in Next.
This does not configure authenticated storage or synchronize user identities automatically.
Interceptors already use the shared discovery and plugin-local execution pipeline; no second
interceptor registry or manual binding was added.
