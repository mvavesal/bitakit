# BitaKit packages

BitaKit is the product name. Published on npm under `@bitakit/` (0.1.x).

| Package                                      | Responsibility                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [core](core/README.md)                       | Headless runtime, Actions, typed services and plugin lifecycle                              |
| [discovery](discovery/README.md)             | Node-only discovery: scans plugin folders and packages, generates `src/bitakit.gen.*` (0.2) |
| [ui](ui/README.md)                           | React providers, reactive bindings and optional standard themed components                  |
| [next](next/README.md)                       | Next.js routing, nuqs adapter and build integration                                         |
| [tanstack](tanstack/README.md)               | Experimental TanStack Router/Start integration                                              |
| [app-preferences](app-preferences/README.md) | Settings UI: generated pages, controls, the settings route and plugin overview              |
| [shell](shell/README.md)                     | Application frame: compound AppShell, layouts, slots, notifications, appearance             |
| [quick-search](quick-search/README.md)       | Search across public Actions and an optional App Bar contribution                           |
| [next-intl](next-intl/README.md)             | Translation integration and optional language preferences                                   |
| [better-auth](better-auth/README.md)         | Authentication/organization integration and server mail hooks                               |
| [better-auth-ui](better-auth-ui/README.md)   | Optional account and organization interfaces                                                |
| [organizations](organizations/README.md)     | Shared organization service contracts and a local test adapter                              |
| [email](email/README.md)                     | Provider-independent message and sending contract                                           |
| [nodemailer](nodemailer/README.md)           | Server-side SMTP implementation of the email contract                                       |
| [create-app](create-app/README.md)           | Native frontend scaffolding with installed BitaKit packages                                 |
| [cli](cli/README.md)                         | `bitakit` CLI: add plugins and contributions, doctor, build plugin packages (0.2)           |
| [devtools](devtools/README.md)               | Live Inspector for one plugin: pages, actions, services, events and config (0.2)            |

## Dependency boundaries

Core has no React or framework-router dependency, and the Node-only discovery that needs
`typescript` and `jiti` lives in `@bitakit/discovery`. React bindings belong in UI;
framework-specific navigation and query adapters belong in their optional integration
packages. The host selects the integration matching the router controlling that surface.
Installing another router does not switch the integration automatically.

Provider plugins use the existing runtime and shared typed service keys. Missing or
duplicate services are reported by the container. Server credentials and email
transports stay on the server. Installing the email contract alone does not enable sending.

Apps contain product behavior, native framework routes and essential configuration.
Plugins own their behavior, views and translations. Host translation catalogs contain
product text and intentional overrides, rather than copies of every plugin's messages.

## Public entry points

- `@bitakit/core`: runtime, plugin definitions and Actions.
- `@bitakit/core/actions`: headless Action API.
- `@bitakit/discovery`: Node/build-time discovery (`@bitakit/core/discovery` re-exports it for one release).
- `@bitakit/ui`: React runtime composition and hooks.
- `@bitakit/ui/actions`: reactive Action bindings.
- `@bitakit/ui/components`: optional standard visual components.

There is one root ActionList. Setting values live in Core's settings store and reach every
context as typed handles; App Preferences only renders them. No second plugin registry,
preference store or authentication session store is required in the host.

## Development and release status

See each package's README for its API and verification commands. The generator supports
Next.js and experimental TanStack Start, with optional App Preferences, Shell and Quick
Search. It can also install locally packed archives (`--packages-dir`) for release checks.

The reference web app still has application-specific Better Auth integration. Its
historical domain examples are not a requirement for applications built with BitaKit.

See the [repository README](../README.md) and
[package structure standard](../docs/architecture/package-structure-standard.md).

Core provides runtime-local events, declared once per plugin in `events.ts`. Services and
actions receive automatically scoped subscriptions; React's `useEvent` binding belongs to UI.
See [the event guide](../apps/docs/content/docs/concepts/events.mdx).

## Client authentication and page states

The [client authentication guide](../apps/docs/content/docs/reference/authentication.mdx) covers the shared service contract,
external paths, Better Auth options and an adapter template. UI owns useAuth/AuthBoundary;
Shell owns standalone page presentation through `@bitakit/shell/pages`. Available since
Core 0.1.1 and UI/Shell/Better Auth 0.1.0. Auth.js and Clerk implementations remain future work.
