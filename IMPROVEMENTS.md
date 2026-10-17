# Improvements

## Global search: identify plugins, pages and settings

Status: implemented (2026-10-02): navigation-only results with types and owners,
plugin results and independent page/settings/plugin switches (see REVIEW.md).
Categories remain open; general Action execution is a separate, future feature.

Keep the existing ActionList-based search and Settings catalog integration. Make
plugins and their pages/settings discoverable, with a clear result type and owner,
for example `Todos — Plugin`, `Tasks — Page · Todos`, and
`Notifications — Settings · Todos`.

Derive result type, plugin ownership, titles and descriptions from existing
registrations wherever possible. Do not require a second search registration or
repeated metadata from developers. Reuse existing navigation Actions, merge duplicate
destinations, and keep visibility, updates and removal tied to contribution lifecycle.
Settings remain optional contributions through the current mechanism; a plugin may
use configuration alone without publishing settings UI.

First step: define result type and ownership using the existing contracts. Later,
consider categories such as System and relationships to parent plugins; keep these
separate from result type. Search initially targets settings pages, not individual
fields. Exact visibility/category API remains to be decided.

Done: Core's `runtime.destinationOf(action)` derives the type (`plugin`, `page`,
`settings`) and owning plugin of a URL Action. A settings page names the plugin that
contributed its section (the catalog projects it through `destinationMetadata`). Another
app path is a page owned by the plugin whose page path matches, else by the plugin that
contributed the link. The application is never named as an owner. Quick search shows
`Tasks — Page · Todos`, keeps the most specific type when it merges duplicate
destinations, and matches owner names as keywords.

Plugin results: Shell's `pluginManagement` publishes `Todos — Plugin` links to each
plugin's view in its overview (`/settings/plugins?plugin=<id>`), following the
overview's visibility. Shell reads the composition through `scopePlugins(scope)`.
Quick Search shows them when `results.plugins` is on (off by default).

## Developer-first documentation and onboarding

Scope: improve the existing documentation incrementally, not a rewrite from scratch.
Preserve useful content and structure; prioritize onboarding friction, outdated examples
and sections affected by the new APIs. Avoid unrelated rewrites to keep the effort bounded.

Status: first pass done (2026-10-02); remaining items listed at the end.

- Start with the shortest verified path from a new project to a running app. Show
  only required commands and code, the file to edit, and the expected result.
- Clearly separate what the generator/Foundation does automatically from what the
  developer must write. Use working defaults; introduce optional configuration later.
- Progress gradually: running app, first plugin/page/action, services and events,
  then configuration, interceptors and advanced integration. Do not front-load
  architecture, internal types or every available option.
- Use plain English, small copy-ready examples and one concept per step. Keep
  nested generics and infrastructure wiring out of ordinary usage examples where
  the existing APIs infer them. Verify examples against the supported workflow.
- Update Quick Search's package README, relevant docs-site guides and developer
  guidance alongside the implementation. Explain that omitted configuration keeps
  existing behavior; show a minimal override for result types and document actual
  defaults, exclusions and Action-input limitations.
- Distinguish implemented workspace changes from published package capabilities.
  Do not present planned options as available or require unpublished APIs in the
  public quickstart. Keep internal planning notes out of public documentation.

Acceptance: a developer new to BitaKit can launch an app and add a first feature
by following the documented steps, without hidden setup or needing to understand
advanced internals first. Check the relevant examples, not unrelated test suites.

Done in the first pass:

- Onboarding path: the README walkthrough uses one command whose output is the same
  in 0.1 and 0.2 (`--framework next --features none --yes`), forms that work on the
  published Core (`requires: ['todos.tasks']`, `app.services`), an expected result for
  every step and a final step that shows the list. The docs-site quickstart names the
  file to edit and what you see; "Where next?" leads to the first feature, which now
  ends with a "Use it" step. Both examples were generated, strictly type-checked and
  run against the workspace build; the 0.1 forms were checked against the published
  Core.
- Published vs workspace: one marker convention ("0.2" = not on npm yet), the
  internal roadmap link removed from the README, stale "pending publication" notes
  replaced with the actual releases.
- New APIs documented where developers look: service names, startup isolation,
  `mountPlugin`, plugin pages (a route snippet that works on 0.1 and 0.2), local plugin
  switches, package configuration and Quick Search (navigation only).
- Generator README rewritten for 0.2; new CLI and DevTools READMEs; contributing
  steps fixed for the CLI dev dependency; generics removed from beginner examples;
  broken references and cross-links fixed; developer guidance updated.

Remaining:

- Translate German package READMEs on npm (better-auth, better-auth-ui, email, nodemailer).
- At the 0.2 release, review package availability and remove obsolete release markers.
- Publish a short public roadmap; the READMEs no longer link the internal `docs/TODO.md`.

Documentation consolidation is complete: API guides live in `apps/docs/content/docs`;
Core's parallel manual and the root concept copies were retired after transferring useful
content. The Core README links to the handbook instead of versioned npm documentation copies.
