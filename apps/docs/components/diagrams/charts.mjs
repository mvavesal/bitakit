// Shared, committed Mermaid sources. Reuse a name in MDX instead of copying a diagram.
// Sources identify the implementation to review when an API changes.
export const charts = {
  'trusted-package-flow': {
    title: 'A trusted catalog becomes an active feature',
    caption:
      'The operator chooses code for the build. The host supplies an already-authorized selection. The package adapter loads only matching catalog entries, and Core owns their lifecycle. Visible contributions still need their normal app renderers.',
    sources: [
      'packages/discovery/src/generate.mjs',
      'packages/packages/src/index.ts',
      'packages/core/src/lifecycle/reconcile.ts',
    ],
    chart: `graph TD
      Build[Operator selects reviewed code] --> Catalog[Catalog: names, versions and loaders]
      Catalog --> Adapter[Package host matches and loads entries]
      Selection[Host supplies an authorized selection] --> Adapter
      Adapter --> Runtime[Core starts and owns the plugins]
      Runtime --> App[Actions, services, pages and Settings]`,
  },
  'theme-flow': {
    title: 'From a theme file to the app',
    caption:
      'Discovery collects app JSON at build time. At runtime, the theme service reads the selected key from Core settings. Shell projects the active mode tokens onto the document; controls inherit them.',
    sources: [
      'packages/discovery/src/generate.mjs',
      'packages/shell/src/services/themes.ts',
      'packages/shell/src/ui/providers/theme.tsx',
    ],
    chart: `graph TD
      File[src/themes/ocean.json] -->|discovery and build| Catalog[Available app themes]
      Catalog --> Service[Shell theme service]
      Select[Choose Ocean in Appearance] --> Save[Core settings and storage]
      Save -->|confirmed selection| Service
      Service --> Root[Shell applies tokens to html]
      Mode[Light, Dark or System] --> Root
      Root --> Controls[App controls, menus and dialogs]`,
  },
  'theme-editing': {
    title: 'Preview first, save when ready',
    caption:
      'Customize starts a local draft. Previewing or cancelling does not change the app. Saving an original creates and selects a personal copy; subsequent saves update that copy. Failed saves leave the draft available.',
    sources: [
      'packages/shell/src/ui/settings/appearance.tsx',
      'packages/shell/src/ui/settings/theme-preview.tsx',
      'packages/shell/src/services/themes.ts',
    ],
    chart: `graph TD
      Choose[Choose a theme] --> Draft[Customize a local draft]
      Draft --> Preview[Inspect light and dark preview]
      Preview --> Draft
      Draft -->|cancel| Discard[Discard draft; app unchanged]
      Draft -->|save| Kind{Personal theme?}
      Kind -->|no| Copy[Save copy and select it]
      Kind -->|yes| Update[Update the personal copy]
      Copy --> Confirm[Core confirms the saved value]
      Update --> Confirm
      Confirm --> Apply[Shell updates the app]`,
  },
  'feature-contracts': {
    title: 'Features meet at their contracts',
    caption:
      'Illustrative connections: the auth adapter provides a service contract, Notes publishes an event and exposes a component slot. Each plugin owns its implementation; the arrows show the declared points of collaboration.',
    sources: [
      'packages/core/src/contracts.ts',
      'packages/core/src/events/service.ts',
      'packages/core/src/slots/runtime.ts',
      'apps/docs/components/illustrations/introduction-examples.tsx',
    ],
    chart: `graph TD
      Auth[Auth adapter] -->|provides| Contract[Service contract: auth]
      Contract -->|used by| Notes[Notes plugin]
      Notes -->|announces a change| Event[Event: notes.changed]
      Event -->|notifies| Activity[Activity plugin]
      Tips[Tips plugin] -->|contributes UI to| Slot[Slot: notes.footer]
      Slot -->|rendered inside| Notes`,
  },
  'architecture-layers': {
    title: 'Who owns what?',
    caption:
      'A responsibility map, not a network request path. Core stays independent of React; the host keeps native routes and trusted server integration.',
    sources: [
      'packages/core/src/runtime.ts',
      'packages/ui/src/providers/foundation-provider.tsx',
      'packages/shell/src/components/app-shell.tsx',
    ],
    chart: `graph TD
      Files[Plugin source files] --> Discovery[Discovery: imports and type maps]
      Discovery --> Host[Host: composition and native routes]
      Host --> Core[Core: execution, state and lifecycle]
      Core --> UI[UI: React bindings and subscriptions]
      UI --> Visual[Shell, App Preferences and your UI]`,
  },
  'discovery-boundary': {
    title: 'From files to a running plugin',
    caption:
      'Discovery runs in Node tooling. The generated imports are bundled by the host; browsers do not scan directories or install packages.',
    sources: ['packages/discovery/src/generate.mjs'],
    chart: `graph TD
      Files[Source files] --> Parse[Parse definitions in Node]
      Parse --> Generate[Generate imports and typed maps]
      Generate --> Bundle[Host bundles generated composition]
      Bundle --> Mount[Mount BitaKitProvider]
      Mount --> Start[Core starts the plugins]`,
  },
  'action-bindings': {
    title: 'One operation, several controls',
    caption:
      'Buttons, menu items and shortcuts reference one Action. Each invocation has its own input. A slot chooses placement, not a second executor.',
    sources: ['packages/core/src/actions/action-list.ts', 'packages/ui/src/hooks/use-action.ts'],
    chart: `graph TD
      Button[Button] --> Action[counter.increment]
      Menu[Menu item] --> Action
      Shortcut[Shortcut] --> Action
      Action --> Service[Service method]
      Service --> State[Shared state]`,
  },
  'execution-flow': {
    title: 'From click to updated UI',
    caption:
      'The binding invokes the Action. After input validation and execution guards, the handler calls the service. Subscribers read current state; no copied UI state is needed.',
    sources: ['packages/core/src/actions/execution.ts', 'packages/ui/src/hooks/use-action.ts'],
    chart: `graph TD
      Control[Bound control] --> Check[Validate input and check guards]
      Check --> Execute[Action handler]
      Execute --> Method[Service method]
      Method --> Store[Update service store]
      Store --> Readers[Refresh subscribed UI and Action presentation]`,
  },
  'action-interceptors': {
    title: 'Gate or observe an Action',
    caption:
      'For an otherwise runnable Action, before hooks run in order and may be awaited. False skips. after and onError observe without replacing the outcome. Other execution guards may also skip an Action.',
    sources: [
      'packages/core/src/actions/execution.ts',
      'packages/core/src/actions/interceptors.ts',
      'packages/core/src/runtime.ts',
    ],
    chart: `graph TD
      Ready[Runnable Action] --> Before[Ordered before hooks]
      Before -->|continue| Execute[execute]
      Before -->|false| Skip[Skipped]
      Before -->|throw or reject| Error[onError: observe failure]
      Execute -->|success| After[after: observe result]
      Execute -->|throw or reject| Error`,
  },
  'service-interceptors': {
    title: 'Observe a service call',
    caption:
      'Service hooks cannot gate or replace execution. Their return values are ignored and async observers are not awaited. The caller receives the original value, promise or error; internal self-calls bypass the wrapper.',
    sources: ['packages/core/src/interceptors/service-observers.ts'],
    chart: `graph TD
      Caller[Consumer calls the wrapped service] --> Before[before: observe arguments]
      Before --> Method[Original method]
      Method -->|value or resolution| After[after: observe result]
      Method -->|throw or rejection| Error[onError: observe failure]`,
  },
  'service-state': {
    title: 'One store, several readers',
    caption:
      'A service owns the current value. Both the page and Action presentation react to its store. Use an event for a notification, not as a replacement for reading current state.',
    sources: [
      'packages/core/src/store.ts',
      'packages/ui/src/hooks/use-service.ts',
      'packages/core/src/runtime.ts',
    ],
    chart: `graph TD
      Action[Action calls increment] --> Store[Service updates its store]
      Store --> Page[Page: current count]
      Store --> Binding[Action: enabled and title]`,
  },
  'event-delivery': {
    title: 'Notify other plugins',
    caption:
      'Exact-name listeners run first, then matching wildcard groups. Normal emit does not await async handlers or replay earlier events. Listener failures do not stop the other listeners. Subscriptions end with their owner.',
    sources: ['packages/core/src/events/service.ts'],
    chart: `graph TD
      Owner[Counter declares incremented] --> Emit[Counter emits count]
      Emit --> Bus[One runtime event bus]
      Bus --> Audit[Audit subscriber]
      Bus --> Other[Another subscriber]`,
  },
  'service-lifecycle': {
    title: 'Own startup and cleanup',
    caption:
      'Startup follows required dependencies. Teardown stops dependents first and awaits cleanup before reuse. A rejected disposer blocks replacement; repeated stop calls share completion.',
    sources: [
      'packages/core/src/services.ts',
      'packages/core/src/scope.ts',
      'packages/core/src/runtime.ts',
    ],
    chart: `graph TD
      Resolve[Resolve required services] --> Create[Create instance and owned scope]
      Create --> Start[Await onStart]
      Start --> Ready[Publish readiness]
      Ready --> Stop[Stop: gate, abort and drain owned work]
      Stop --> Dispose[Await cleanup: dependents before providers]`,
  },
  'slot-flow': {
    title: 'A definition is not a renderer',
    caption:
      'The slot owner declares a contract. A contribution targets that ID. Core validates and attaches it; the React outlet selects entries for its payload and renders them using the owner’s UI.',
    sources: [
      'packages/core/src/slots/runtime.ts',
      'packages/ui/src/hooks/use-slot.ts',
      'packages/ui/src/components/plugin-slot.tsx',
    ],
    chart: `graph TD
      Definition[Owner: defineSlot] --> Core[Core: validate and attach]
      Contribution[Plugin: Action or widget placement] --> Core
      Core --> Outlet[Owner: useSlot or PluginSlot]
      Outlet --> Render[Render the selected entries]`,
  },
  'action-placement': {
    title: 'Follow a toolbar Action',
    caption:
      'The target ID joins the declaration to the outlet. An actions slot supplies Action references; the page chooses its standard Button renderer.',
    sources: ['apps/docs/content/docs/concepts/slots.mdx'],
    chart: `graph TD
      Declare[Define counter.toolbar: accepts actions] --> Attach[Attach counter.increment]
      Target[Action: slots counter.toolbar] --> Attach
      Attach --> Read[Counter page: useSlot counter.toolbar]
      Read --> Button[Render Increment with Action and Button]`,
  },
  'settings-flow': {
    title: 'One declaration, one value owner',
    caption:
      'The declaration supplies defaults and catalog metadata. App Preferences derives navigation and fields. Changes pass through the runtime and settings.storage; server storage applies its own trusted validation and access rules.',
    sources: ['packages/app-preferences/src/catalog.ts', 'packages/core/src/settings/store.ts'],
    chart: `graph TD
      Definition[settings.ts] --> Catalog[Settings catalog]
      Catalog --> Navigation[Navigation Action]
      Catalog --> Fields[Generated page and fields]
      Fields -->|read and write| Runtime[Core settings store]
      Runtime --> Storage[settings.storage contract]`,
  },
  'lifecycle-flow': {
    title: 'Update compatible plugin owners',
    caption:
      'For supported compatible updates, unrelated owners remain mounted. Cleanup failure blocks reuse; a timeout does not release the barrier. Structural changes return restart-required.',
    sources: ['packages/core/src/runtime.ts', 'packages/ui/src/providers/foundation-provider.tsx'],
    chart: `graph TD
      Analyze[Analyze composition changes] --> Compatible{Compatible update?}
      Compatible -->|no| Replace[Report restart-required]
      Compatible -->|yes| Gate[Gate affected work]
      Gate --> Stop[Drain and await cleanup]
      Stop -->|success| Start[Start affected owners]
      Stop -->|failure| Block[Keep replacement blocked]
      Start --> Ready[Publish readiness]`,
  },
  'runtime-states': {
    title: 'From startup to shutdown',
    caption:
      'Common whole-runtime transitions. starting awaits startup; stopping awaits cleanup. A failure is not proof that resources have been released. Inspect cleanup separately before replacement. Per-plugin isolation and compatible updates have their own flow.',
    sources: ['packages/core/src/lifecycle/state.ts', 'packages/core/src/runtime.ts'],
    chart: `stateDiagram-v2
      direction TB
      [*] --> idle
      idle --> starting: mount
      starting --> ready: startup completes
      starting --> failed: startup fails
      starting --> stopping: stop requested
      ready --> stopping: stop requested
      failed --> stopping: teardown after startup failure
      stopping --> stopped: cleanup completes
      stopping --> failed: cleanup fails`,
  },
};
