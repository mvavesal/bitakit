# Review

Previous feedback is done: service type/runtime alignment, host handling after
plugin isolation, and headless plugin setup/cleanup. Targeted checks passed.
Quick Search result classification, independent filters and plugin detail links
also passed their relevant checks.

## Resolved (2026-10-02) — keep Quick Search limited to navigation links

Confirmed decision: Quick Search finds navigable destinations, not executable
non-URL Actions. Settings already provide URL Actions through the Settings catalog.

- Remove the new non-URL Action results and the `results.actions` option. Keep
  independent `pages`, `settings` and `plugins` filters and their type/owner labels.
- Preserve current defaults without configuration: pages and settings included,
  plugin results excluded. Excluding plugin results must not hide that plugin's
  pages/settings or disable the plugin itself.
- Keep native link navigation, visibility/enabled/pending guards, internal Action
  exclusion, destination deduplication and registration cleanup.
- Reuse the existing ActionList, Settings catalog and plugin detail links; no new
  registry or extra developer registration. General Action execution is a separate
  future feature, outside this change.
- Update the Quick Search documentation and tests to match this navigation-only
  contract. Verify that non-URL Actions never appear, including when they require
  input; keep focused coverage for independent filters and plugin/settings links.

Reason: enabling the current Action results can expose an Action requiring input
and invoke it without that input. The existing test only covers an Action that
explicitly hides itself when input is absent. Restoring the navigation-only scope
removes this unsupported execution path.

Plugin results still require Shell with `pluginManagement` and its detail view.

Resolution: Action results, `results.actions`, the Action label and the
`ActionBinding` path are removed; search lists only visible URL Actions. The public
`runtime.ownerOf()` added for Action labels is private again (it only serves
`destinationOf`). Defaults are unchanged: pages and settings on, plugins off. Tests in
`packages/quick-search/tests/search.test.mjs`: every switch combination with a plugin
command present that never appears, and a navigation-only test with a command, an
Action that requires input without hiding itself, a dialog, a form and a checkbox
Action: none appear, nothing runs, and searching for one shows "No results found".
Plugin and settings links and labels keep their coverage. README, docs-site
configuration guide and developer guidance describe the navigation-only contract.

## Resolved (2026-10-02) — forms must not require a dialog

Confirmed requirement: a form may live directly on a page, in a dialog, or as a
section of a larger data-entry form. Submitting its data to an Action must not
require opening a popup. The current specialized Form Action couples its form
presentation to a dialog; ordinary Actions can already receive submitted data.

- Separate form submission from dialog presentation. Keep Dialog Actions for
  opening dialogs; make a dialog an optional host for a form.
- Reuse existing form/validation libraries and the existing Action execution and
  bindings. Do not introduce a second form engine, execution pipeline or nested
  HTML forms for independently saved sections.
- Keep the developer-facing path simple: use the form's validated data as Action
  input, with shared pending/disabled handling and errors that preserve the draft.
- Clarify the existing Form Action's scope and the intended API before changing it;
  preserve working dialog-form flows or document an explicit migration.
- Update the Actions guide incrementally with one inline page-form example and an
  optional dialog example. Verify submission without a popup, input delivery,
  pending protection, and failure/retry with the draft retained.

This is a review requirement for follow-up work, not an implemented API change.

Resolution (documentation, no API change): the Actions guide's new "Forms" section shows a
page form built with the existing react-hook-form/zod stack that runs an ordinary Action
(`defineAction<TaskInput>`) through `useAction`. The same form component is then hosted in a
Dialog Action as the optional dialog example. The guide states the Form Action's scope:
quick dialog forms with string fields and simple checks; page forms, sections, custom
validation and other value types use an ordinary Action. Sections must not nest `<form>`.
Verified in jsdom against the workspace build: the form submits without a dialog, the
validated input reaches the Action, the button is disabled while pending and a second
submit is skipped (`pending`), a failure shows the message and keeps the draft, and the
retry succeeds and resets. Existing dialog-form flows (`users.invite`) are unchanged.

Decision (2026-10-02, user): option (a). `defineFormAction` stays the documented quick
dialog form for simple string fields; no API change, no inline hosting and no deprecation.
Page forms, sections and custom validation use an ordinary Action with the form library,
optionally hosted in a Dialog Action. Rejected for now: (b) inline rendering of the Form
Action's own field engine; (c) deprecation and migration of `users.invite`.

## Resolved (2026-10-02) — explain Action groups independently of UI

Confirmed concept: an Action group is a logical grouping of Actions. It is not a
UI component, does not require rendering, and does not inherently mean a menu,
drawer, toolbar or Settings view.

- Review the group API and documentation against this separation. Explain group
  membership first, independently of UI, including use without a renderer.
- Explain rendering as an optional consumer: a drawer, menu bar or another UI
  component can read a group and decide how to display it. Different consumers
  may present the same group differently; presentation belongs to the consumer.
- Revise the Actions guide's UI-centric "Placement" introduction. Start with a
  small logical-group example, then show a separate optional rendering example.
  Distinguish membership from display ordering and separators.
- Verify the examples against the existing Core group API and UI bindings. Reuse
  the existing registry; this clarification is not a request for another grouping
  mechanism or for replacing the Settings catalog.

Resolution: a new docs page, "Action groups" (Core concepts, after Actions), explains groups
in plain terms: a group is a name for related actions and only groups them. Sections: put
actions in a group (`groups`), show a group (the same group as an `ActionMenu` and as a custom
toolbar through `ActionGroupBinding`), a table of how components use groups (ActionMenu,
ActionGroupBinding, navigation components and Shell with `navigation`, Quick Search headings,
App Preferences categories), group titles, and further options: order and separators as
display hints, one group with a different input per place, `attach` and `add` from setup, and
reading a group in code. The Actions guide keeps a short "Groups" section that links there;
the word "membership" is no longer used. All examples run against the existing Core group API
and UI bindings; no new mechanism.

Fixed (2026-10-02, approved): a group's title no longer depends on registration order. The
runtime keeps the first title given for a group ID, even when the plain name or a configured
`groups` entry came first, and `useGroupTitle` (navigation, Quick Search) falls back to that
title for untitled group objects in snapshots. Groups stay matched by ID. Covered by a Core and
a UI test; all 292 package tests pass.

## Resolved (2026-10-02) — review Action API complexity and documentation emphasis

Audit actual implementation, usages and tests before proposing removals. The
number of documented properties alone does not prove they are unnecessary.

- Explain one simple default path first; put advanced lifecycle/reactivity options
  (`watch`, events, `setup`, state) and discovery/configuration escape hatches in
  clearly separate reference sections. Check their distinct use cases and any
  genuine overlap; do not invent another abstraction just to shorten examples.
- Keep `description` and `tooltip` separate: a description can be longer explanatory
  content; a tooltip is a short hover hint. Do not merge them.
- Keep the distinct meanings of enabled, visible and pending clear.
- Explain `dependsOn` as availability dependency: disabling a referenced Action
  disables the dependent Action. It neither executes prerequisites nor checks
  whether they previously succeeded. Missing dependencies and cycles disable it.
- Improve existing documentation incrementally. Any API simplification proposal
  must identify a concrete redundancy and its compatibility impact first.

These are follow-up review items; no API removal or implementation is approved
by this note alone.

Resolution (documentation): the guide now opens with "Start here" (define, bind, run from
code), splits the property table into common and advanced properties, and moves
lifecycle/reactivity (`watch`, events, `setup`, `initialState`) and identity/discovery/config
(`id`, `replaces`, `conventions`, `configPath`) into two "Advanced" sections at the end. A
table explains which of `resolve`, `watch`, `onEvent`, `setup` and `initialState` fits which
change; the genuine overlap is stated: `watch` re-evaluates `resolve` per binding, while
`onEvent` and `setup` write one shared value. `description` and `tooltip` stay separate. A
table distinguishes `enabled`, `visible` and runtime-owned `pending`. `dependsOn` is described
as an availability dependency that never runs prerequisites, ignores earlier success and is
disabled by a missing ID or a cycle (tested). All 66 code blocks are type-checked; the
actions run in a mounted runtime and the page form runs in jsdom.

Audit result, proposals only. Usage outside Core: `watch`, `tooltip` and the common
properties are used by apps or packages; `internal` is set by Core's form adapter.
`dependsOn`, `unavailable`, `replaces`, `conventions` and `initialState` are used only in
tests. `configPath` is used
nowhere and has no test; it is the only way to align `config.action` for manually registered
actions (verified: with `configPath: ['list']` the action reads `actions.list`, without it
`actions.todos.list`). Proposal: add a Core test for it rather than remove it. None of the
properties is redundant with another except one: `defineAction` accepts `state`, which
registration drops (verified: only `initialState` seeds state). Proposal: remove `state` from
the definition input types and keep it on snapshots and update patches. Compatibility:
type-only; no runtime change; no usage in the repo. One binding gap (not a redundancy):
ActionButton on a link-only Action (`href`, no `execute`) does nothing, while settings
navigation and Shell plugin results register such Actions on purpose and render them as
links.

Fixed (2026-10-02, approved): ActionButton and ActionLink showed `description` as hover
text and overwrote an explicit `title` prop. Both now use the `title` prop, then `tooltip`,
then `description`, like menu items and ActionBinding. ActionButton reads the snapshot for
its own `input`, so a tooltip, icon or checked state from `resolve` applies to that button.
Covered by a new UI test; all 290 package tests pass.
