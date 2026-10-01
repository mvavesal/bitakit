# BitaKit packages

BitaKit is the product name. Source package names use `@bitakit/`;
public npm publication is pending.

| Package                                      | Responsibility                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| [core](core/README.md)                       | Headless runtime, Actions, typed services, plugin lifecycle and Node-only discovery |
| [ui](ui/README.md)                           | React providers, reactive bindings and optional standard themed components          |
| [next](next/README.md)                       | Next.js routing, nuqs adapter and build integration                                 |
| [tanstack](tanstack/README.md)               | Experimental TanStack Router/Start integration                                      |
| [app-preferences](app-preferences/README.md) | Settings definitions, catalog, confirmed values and persistence                     |
| [shell](shell/README.md)                     | Application layout, navigation surfaces and settings presentation                   |
| [quick-search](quick-search/README.md)       | Search across public Actions and an optional App Bar contribution                   |
| [next-intl](next-intl/README.md)             | Translation integration and optional language preferences                           |
| [better-auth](better-auth/README.md)         | Authentication/organization integration and server mail hooks                       |
| [better-auth-ui](better-auth-ui/README.md)   | Optional account and organization interfaces                                        |
| [organizations](organizations/README.md)     | Shared organization service contracts and a local test adapter                      |
| [email](email/README.md)                     | Provider-independent message and sending contract                                   |
| [nodemailer](nodemailer/README.md)           | Server-side SMTP implementation of the email contract                               |
| [create-app](create-app/README.md)           | Native frontend scaffolding with installed BitaKit packages                         |

## Dependency boundaries

Core has no React or framework-router dependency. React bindings belong in UI;
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
- `@bitakit/core/discovery`: Node/build-time discovery.
- `@bitakit/ui`: React runtime composition and hooks.
- `@bitakit/ui/actions`: reactive Action bindings.
- `@bitakit/ui/components`: optional standard visual components.

There is one root ActionList. Settings uses its own catalog and confirmed-value store;
optional Actions forward writes to that same source of truth. No second plugin registry,
preference store or authentication session store is required in the host.

## Development and release status

See each package's README for its API and verification commands. The generator supports
Next.js and experimental TanStack Start, with optional App Preferences, Shell and Quick
Search. It can consume locally packed archives before public npm publication.

The reference web app still has application-specific Better Auth integration. Its
historical domain examples are not a requirement for applications built with BitaKit.

See the [repository README](../README.md), [roadmap](../docs/TODO.md) and
[package structure standard](../docs/architecture/package-structure-standard.md).

Core now provides runtime-local events backed by mitt. Action setup and service
creation receive automatically scoped event subscriptions; React's `useWatchEvent`
binding belongs to UI. See [the event guide](core/docs/events.md). These additions
are workspace changes pending publication.

## Client authentication and page states

The [client authentication guide](core/docs/auth.md) covers the shared service contract,
external paths, Better Auth options and an adapter template. UI owns useAuth/AuthBoundary;
Shell owns standalone page presentation through `@bitakit/shell/pages`. These additions
are workspace APIs pending release. Auth.js and Clerk implementations remain future work.
