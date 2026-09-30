# Content Demo application structure

The application is a root Foundation module. It consumes packages and does not wrap itself in a nested plugin. Sharing action/service/config conventions with packages does not replace the host framework's routing conventions.

```text
src/
├── app/
│   ├── layout.tsx                  # Providers and document
│   ├── (workspace)/
│   │   ├── layout.tsx              # Persistent application shell
│   │   ├── page.tsx                # Application home
│   │   ├── contents/page.tsx
│   │   ├── developer/page.tsx
│   │   ├── settings/page.tsx        # Native redirect
│   │   ├── settings/[section]/page.tsx
│   │   └── [...path]/page.tsx       # Independent plugin pages only
│   └── better-auth/[[...path]]/page.tsx
├── actions/
├── services/
├── components/
│   └── workspace-layout.tsx
├── auth.tsx                       # Essential host authentication configuration
└── plugin.config.ts                # Root module identity and dependencies
```

Only create directories with actual responsibilities. Configs and interceptors may be added using shared conventions when needed. Independent local plugins may later live under src/plugins; the application itself must not be placed there.

## Routing rule and regression

App-owned pages must use native framework routes. For Next.js this means App Router page.tsx and layout.tsx files. Do not generate root pages.contents.tsx or pages.developer.tsx Foundation definitions to represent app routes. Do not use src/pages for Foundation objects: Next.js reserves it for the Pages Router.

The earlier migration incorrectly preserved plugin page discovery for application-owned pages. It has been corrected: the shared workspace renders route children, native pages render their content, and only independent plugin pages use PluginPage through the catch-all. The root module's optional page/view runtime capability remains available but is not the default host architecture.

## Preserved behavior

- Module identity and Action IDs remain stable.
- The root ActionList and providers remain singular.
- Settings reads the existing catalog; no additional registry or preference store.
- Auth pages remain outside the workspace shell.
- Workspace readiness guards service access, and its layout persists across workspace navigation.

## Validation

Run the Content Demo type check and discovery browser tests. Verify native content/developer routes, independent plugin creation/change/removal, and settings redirects. Tests must not create root Foundation page files or overwrite app-owned routes to exercise plugin discovery.

## Minimal host integration

Use the existing Foundation service and provider lifecycle. Better Auth already registers the shared authentication service; Core installs plugin-provided providers. Do not rebuild either mechanism in the host. Essential provider configuration and native routes stay explicit; reusable adapter wiring belongs in the optional package. Demo catalogs must remain separable from real authentication integration. See the minimal-host rules in AGENTS.md and the package structure standard.
