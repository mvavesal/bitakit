# Developer documentation visuals

Use the existing Fumadocs site, MDX and theme. Visuals belong directly in their subject sections:
Actions, Settings, slots and layouts. Do not add a standalone Visual guide/gallery or repeat an
example in a separate collection below the explanation. `/docs/concepts/patterns` remains the
existing mechanism comparison, not a second illustration gallery.
This guide is the shared style and authoring recipe, not an application design system.

The Introduction explains what BitaKit is, why to use it, and its composition philosophy before
the **Start here** guide. Its approved additive preview lets readers add UI pieces, inspect
their exact source and reset; retain additions across selections. Group choices so beginners
see only a few at once. Use existing Fumadocs controls/popovers, the shared preview styles and
real slot contracts. The model is explicitly illustrative; it does not execute editable code,
install plugins or implement another runtime. Link each example to its detailed subject page.
Number its three steps. Selecting a step must immediately show its own first example, preview
and code, not only change a row of buttons while retaining another step's source. Show one file
at a time: slot declaration, outlet and contributor are separate selections, as are event
declaration, emitter and listener. Keep additions while changing the selected explanation.
The Introduction starts with an explicit `definePlugin` in optional `plugin.config.ts`, showing
its identity and purpose; adding a page is a separate choice. Explain in-app/package locations.
For this overview, show optional Action/slot IDs with a short path-inference comment, and Action
titles, meaningful descriptions and matching icons. Slots have no title/description API; use a
brief purpose comment instead. Keep the detailed Counter learning path's minimal page-first flow.
Settings catalog links belong in Settings navigation, not automatically in Shell navigation.
Use `AppPreviewWindow` for app-window illustrations: central theme surfaces, a small shadow,
the Your app title and three decorative window dots. Do not make them fake working controls.
Use verified Reicon icons and keep preview icons aligned with the code that declares them.
Give page previews a recognizable heading and body; Settings uses a separate navigation pane
and a short set of labeled default values. Illustrative fields are static shapes, not working
form controls or a second settings store. Any extra visual context absent from the snippet
(such as the Notes writing area) must be labeled as illustrative.
Keep the Notes page visibly page-sized: at least 20rem tall on narrow screens and 24rem on
wider screens, with a flexible writing area beneath its header. Preserve the existing window,
sidebar and source-browser styling rather than presenting the page as a short horizontal strip.
Apply that page silhouette to the initial plugin-only state too: a heading and a tall, bounded
page placeholder, explicitly labeled as not yet added. Increasing only the outer app content
height leaves the inner preview looking like a button; verify the initial/reset state itself.
For the Introduction source view, reuse `Explanation` with its optional `files` list:
`SourceTree` composes Fumadocs `Files`/`Folder`/`File` beside `DynamicCodeBlock`, separated by
a border. Notes files are present from the start; other plugins and the app interceptor appear
only after their example is introduced. Selecting a file shows its code and adds the prerequisite
pieces to the illustrative preview. Folders can expand/collapse. External
step/preview selections reveal the current file's ancestors; file clicks preserve expanded
folders and keyboard focus. Deduplicate shared paths and show the latest added version (the
page with its outlet replaces the initial page). Code remains read-only; no editor, filesystem
actions or separate file-browser dependency. The tree stacks above code on narrow screens.
Keep the source browser compact (22rem on desktop) with independently scrollable tree and code
panes. On mobile, bound each stacked pane separately. Verify with every folder expanded and
scroll to the last file; a short selected path alone does not exercise overflow. Open folder
panels use natural height so nested content can grow; the outer tree pane owns scrolling.
Use Fumadocs' fd-scroll-container utility for its thin scrollbar and transparent track.
Actions should perform feature work through services. Demonstrate logging in an interceptor,
and use a concrete change event with a meaningful payload and a state-owning subscriber.
Use App sidebar and Your plugin page to label the placement illustration. Keep header start,
center and the trailing toolbar/end content on one row, matching Shell. A separate full-width
header row is shell.header.rows. Qualify Settings region labels so page titles, extension slots
and navigation cannot be confused. Keep all six numbered beginner steps under Start here;
moving a sidebar entry must preserve the existing document URL.

## Use standard tools

| Need | Tool | Editable source |
| --- | --- | --- |
| Architecture, execution, events or lifecycle | Mermaid syntax, rendered on the server with `beautiful-mermaid` | `apps/docs/components/diagrams/charts.mjs` |
| Show which code adds UI in which place | Small React example embedded in MDX | `apps/docs/components/illustrations/` |
| Slot labels and accepted contribution types | One shared metadata file | `apps/docs/components/illustrations/regions.json` |
| Highlighted example code and destination buttons | Fumadocs `DynamicCodeBlock` and `buttonVariants` | Existing package components |

The Mermaid renderer follows [Fumadocs' documented integration](https://www.fumadocs.dev/docs/markdown/mermaid).
Keep the wrapper small: server-render committed chart text, inherit `fd` theme tokens, provide
an accessible description and allow local horizontal scrolling. Do not build a layout engine,
canvas editor, illustration DSL, duplicated light/dark assets or another docs runtime.
Only reviewed repository content reaches the SVG renderer; do not feed it user-supplied strings.

## Reuse in MDX

```mdx
<Diagram name="action-interceptors" />
<SlotIllustration />
<SettingsIllustration />
<ExtensionIllustration />
<EventIllustration />
<InterceptorIllustration kind="actions" />
```

Reuse a chart name on every page that needs it. Change its source once; do not copy SVGs
or the Mermaid text into multiple pages. Each chart keeps its title, caption and implementation
source references together. `components/mdx.tsx` exposes these ordinary MDX components.

## Preserve the approved style

The user approved the existing neutral mock UI, dashed slot outlines, highlighted selection,
and code beneath the selected region. Keep these across future examples. Reuse `shared.tsx`
(`Frame`, `Target`, `Explanation`, `targetStyle`) and Fumadocs controls; do not restyle each topic.
Split topic components into focused files under `components/illustrations/`.

For non-UI topics, keep the same select-and-explain pattern: event participants show publisher
and subscriber files; interceptor target choices highlight the example operations they match.
These are authored illustrations, not another matcher, event bus or simulated application runtime.
Clearly distinguish Action interception from service observation, and owned event subscriptions
from invoking an Action. Pair flow diagrams with the step they clarify; avoid a repeated gallery.

The user also approved the existing architecture composition and numbered Action-loop graphics
from `scripts/readme-diagrams.mjs`. Preserve their visual language: recognizable layers, short
labels, numbered execution arrows and a distinct return path for state updates. They belong in
Architecture and Actions respectively; Patterns links to the Action loop instead of duplicating it.
Maintain these existing assets through their authoring script and export both themes to
`docs/assets/readme` and `apps/docs/public/diagrams`. In docs, select the image using the site's
light/dark classes, not the operating-system preference alone. Use Mermaid for new general flows;
do not create another illustration engine.

## Make a UI example useful

- Use an explicit placeholder such as Your action for generic placement demos, or a concrete
  product task when the lesson requires one. Do not use Help for a
  placement demo: readers may mistake it for a documentation help control. Keep title, ID, route
  and source filenames consistent when renaming a sample.
- Show one recognizable application surface using the existing documentation theme tokens.
  Keep the real region order; do not suggest arbitrary DOM injection.
- Make the relationship explicit: **file or declaration → target → visible result**.
  Selecting a region shows its real ID, accepted contribution type and highlighted code.
- Distinguish Actions, component widgets, generated fields and metadata. A navigation Action
  is not a component slot; a Settings category is not another registration. Preserve the
  automatic settings catalog and the single runtime value owner.
- Use neutral context, one selected region and dashed slot outlines. Text and pressed state
  convey selection as well as color. Use standard spacing, typography and shapes.
- Use native keyboard-operable buttons. Preview selection is local component state; it is
  not URL navigation or a second settings store. Label the preview as illustrative.
- Begin with the smallest example; reveal payload, order or replacement only for the selected
  case that requires it. Include exact paths and expected results.
- Explain new terms before the first example and link to the relevant reference. For extension
  points, distinguish the owner's component, its empty outlet and another plugin's widget.
  Preview-only slot outlines must be labeled as illustration, not built-in UI.
- Use flowcharts for steps and state diagrams for transitions. Label their scope and failure
  paths from implementation evidence; keep the architecture map discoverable from the learning path.

## Reusable authoring prompt

```text
Explain {learning_outcome} in the BitaKit documentation.
Verify the API and region order against {implementation_sources}.
Use the existing MDX components and the central Fumadocs theme.

For a flow: add one short Mermaid definition to charts.mjs, with a title, caption and
source references. Show only the decisions and branches needed for this lesson.
For UI placement: reuse or minimally extend the existing React illustrations. Show the
source file, real slot contract and resulting UI region together. Do not add a new engine.

Match the existing neutral surfaces, selected-region treatment and dashed slot outlines.
Use short English labels, readable code and keyboard-accessible controls. Do not invent APIs,
layouts, colors or controls. Keep descriptions available without depending on color or images.
Place the result in the relevant lesson, with its explanation and code together. Preserve
the existing clickable-region/code-below style; extend shared components instead of redesigning them.
Keep optional detail out of the first sample. Verify light/dark themes, mobile scrolling and the actual interaction.
```

## Maintain and verify

When an API changes, follow the `sources` references in `charts.mjs`, update the relevant
example and shared metadata, and review the explanation. No tool automatically proves a
flow diagram's semantics. The slot-contract test detects renamed slots or changed accepts/policy
using the existing discovery parser; it does not add a second parser or runtime registry.

From the repository root:

```sh
npm run test --workspace @bitakit/docs
npm run types:check --workspace @bitakit/docs
npm run build:docs
npm run dev:docs
```

Check the changed subject pages at desktop and mobile widths in both themes.
Select each changed region and check its source. Diagrams may scroll inside their own frame;
the entire page must not overflow. Keep captions, native keyboard focus and readable labels.
Keep the approved README graphics and their docs exports aligned; do not revive the retired
coordinate-based help generator.
