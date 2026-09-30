# Discovery: define a feature, let the build connect it

A growing application should not need another handwritten registration list every
time you add an action or service. BitaKit discovery uses supported file conventions
to generate imports, registration, and TypeScript declarations for your configured host.

```text
Contribution files + opted-in installed packages
                     │
                     ▼
          Build-time discovery
                     │
                     ▼
       Generated configuration and types
                     │
                     ▼
        Runtime mounts the selected plugins
```

## What becomes simpler?

In a configured Next.js or TanStack integration, local plugin folders group feature
contributions. Supported action and service files supply definitions; discovery
connects them and can infer IDs from their paths. You keep writing feature behavior
without maintaining a parallel list of every discovered contribution.

Installed packages participate only when they expose the required BitaKit metadata
and public exports. Installing an arbitrary npm dependency does not activate it as
a plugin. Host configuration can disable package contributions or override discovery
conventions. Explicit registration remains available, as in the To-do tutorial.

## What about settings?

App Preferences supplies discovery descriptors for settings, sections, and renderers.
When that discovery integration is configured, those definitions can join the generated
composition. The Settings catalog remains the owner of the registered sections.

Discovery does not invent settings, persistence, or permissions. You still define the
contributions and configure their storage. Server-backed settings also need server
registration and authorization; finding a UI file does not grant access to data.

## Where does it run?

Discovery runs at build time in Node, not by scanning the filesystem in the browser.
Framework development integration can watch contribution files; production changes
need a rebuild and deployment. Core installation alone does not enable a watcher.

Start with the [To-do example](../../packages/core/docs/todo-tutorial.md), then follow
[the file conventions](../../packages/core/docs/file-contributions.md) when moving to
a discovery-enabled host.
