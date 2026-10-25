# BitaKit landing page

The public landing page and its live playground. A separate Next.js app in this repository
(`@bitakit/landing`, private, never published). Run it with `npm run dev:landing` (port 3004)
from the repository root.

## Two apps in one project

| Route group             | What it is                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `src/app/(site)`        | The landing page at `/`. No BitaKit runtime; its own root layout and `site.css`.               |
| `src/app/(playground)`  | A real BitaKit app (Shell, App Preferences, Quick Search, next-intl) at `/dashboard`, plugin pages and `/settings`. |

The landing page shows the playground in a same-origin iframe, so Shell's `<html>` attributes
never reach the landing page. `src/components/playground/bridge.tsx` (inside the playground's
`BitaKitProvider`) applies the landing page's commands through public APIs only: the settings
store, Shell's `shell.selectTheme` Action and the host `runtime.plugins.enable/disable`
controls; it reports the resulting state back. `src/playground/protocol.ts` is the message
contract; both sides check the origin and the source of every message.
The same bridge derives one runtime snapshot and owns one command handler for both modes.
Its standalone ReturnBar passes them directly to the shared Inspector; only the framed mode
uses postMessage. Do not add a second settings store, default map or command implementation.

## The playground app

A mini CRM: `src/plugins/<name>/`, one folder per feature. Sample data lives in each plugin's
`data/*.json`, not in the services.

| Plugin      | Shows                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `dashboard` | A page that owns the `dashboard.widgets` and `dashboard.toolbar` slots     |
| `revenue`   | Area chart widget, a plugin setting, a toolbar Action with `concurrency`  |
| `pipeline`  | Deals page, bar chart widget, events, guarded and confirmed Actions       |
| `goals`     | Radial chart widget and target setting; `plugin.config.ts` depends on `pipeline` |
| `activity`  | Listens to pipeline events; a widget and a Shell header badge             |
| `contacts`  | Page, widget and a Quick Search source                                    |
| `guard`     | Interceptors: won deals cannot be deleted; tracing                        |
| `reports`   | Monthly sample reports using standard Table and locale/currency formatting |
| `tasks`     | Session-only service and Action for completion/reopening                   |
| `notes`     | Read-only sample project notes using standard Item                        |

`src/settings.ts` holds the app setting `currency`. The sidebar has two groups: Shell's main
navigation (Dashboard and Pipeline) and
the app slot `features` (`src/slots/features.ts`, rendered by `src/ui/slots/sidebar.body.tsx`
with `AppShell.NavigationGroup`); feature plugins join it with `slots: ['features']`. Settings keeps App Preferences' normal `shell.navigation` placement for horizontal layout. The native Shell layout uses its standard NavigationItem extension to omit that one item from the vertical menu, where `sidebar.footer` binds the same typed Action. Do not place Settings in `shell.header.end`, duplicate its Action or add a registry. Translations live in each plugin's
`locales/` and in the app's `locales/`; keep English and German keys in step. The inspector's
plugin list, settings and inspector descriptions are in `src/components/playground/plugins.ts` and `topics.ts`;
update them with the plugins.

## Landing page rules

- Reuse `@bitakit/ui/components` and the local shadcn Radix Vega primitives. Reicon Outline
  remains the UI icon library; `components.json` keeps Lucide only as the CLI scaffolding preset.
  Inspect registry additions with `info`, `view`, `--dry-run` and `--diff` before merging.
- `site.css` owns marketing typography, spacing and responsive layouts. `apps/brand-theme.css`
  owns the shared `.site-theme` palette for the website and standalone demo chrome; never apply
  that class to the playground root or individual feature content. Preserve the
  shared radius/squircle conventions. SiteProviders uses next-themes only for the marketing
  document (storage key `bitakit-site-theme`); the framed app keeps its own Shell settings.
- The Aceternity Resizable Navbar keeps its scroll-based resize and hover transition, with
  central tokens and standard Buttons. Its mobile navigation uses the existing Radix Sheet
  for focus trapping, Escape and accessible naming. Do not restore the upstream icon controls.
- The marketing backdrop is a static, edge-faded CSS grid with restrained warm light; no decorative orbit/arc layer or background scroll listener. Motion's reduced-motion preference disables Container Scroll.
  Preserve the original live-app entrance: 24 degrees / 0.82 scale to flat / full size on
  desktop, 0.95 to full size without tilt on phones. Do not silently reduce or remove it.
- Keep the hero in one vertical reading flow: the existing audience label, unchanged headline, three compact selling
  points with native list bullets and the two existing CTAs below them. The copy is Open source. MIT licensed.;
  Fully type-safe.; AI-friendly by design. Do not duplicate Open source in a badge
  or add a supporting paragraph, technology strip or right-hand copy column. Preserve deliberate vertical spacing before the playground.
- The gold accent is #EBB759 from the actual logo; its navy is #122F4D. Buttons use navy
  text on gold in both schemes. Light-mode gold text uses a darker shade for contrast.
- Dark hover, focus and selected control surfaces use the shared navy accent/muted/input
  tokens, including the inspector's portalled Select content. Keep gold primary buttons and
  active topic tabs. Preserve light colors and use the standard component states.
- Section entrances run once through Motion. Pointer hover/press never shifts or scales
  landing controls, labels, icons or cards. Use paint-only feedback (color, border, glow,
  shadow); the marketing root configures the standard pressed offset to 0 and scale to 1.
  Navbar hover surfaces fade in place. Preserve selection-driven tab Motion, scroll parallax
  and native switch/check state changes; never disable transforms globally.
  Capability cards remain stationary: the original Aceternity Spotlight fades in/out over 700ms
  with spaced, subdued warm-gold dots behind the content and a stronger gold outline/glow. Lazy-load WebGL, pause after fade-out and
  omit it for reduced motion; standard Card owns geometry and spacing.
- The live preview uses light-neutral desktop window chrome with decorative, non-interactive
  window dots in both marketing schemes. Rebind standard control-surface tokens inside its
  title bar; Customize uses standard outline/default Button variants, never brown secondary.
  The visual entrance finishes at 160px from the viewport top and reverses naturally with
  page scrolling. The app is always interactive, including while tilted: no inert state,
  pointer-event gate, alignment latch, floating activation button or overlay. Scrolling is
  native in each document; do not add wheel forwarding or interception. The existing Try it
  live CTA points to #playground-app for native keyboard/anchor entry. Do not restore the removed
  Focus live demo control.
- The preview heading is Try it yourself with an accessible 6px green live-demo circle,
  a visible expanding/fading halo and a gentle core pulse. Use standard Tailwind ping/pulse;
  reduced motion hides the halo and leaves the core static. Preserve the accepted 16px halo
  expanding to 32px over 2s; changing the core size must not shrink or dim the halo. This denotes an interactive demo,
  not backend connectivity. Do not restore the right-side sentence, below-app caption/continuation
  row or repetitive three-item principle strip. The substantive plugin example follows directly.
- The inspector keeps its properties and explanation, with only Close in the header. Its compact
  footer centers one small Reset to default button and appears only when the authoritative runtime snapshot differs
  from the existing reset defaults (settings, theme, language or enabled plugins). Manual return
  to all defaults and successful Reset hide the footer. Route browsing is not a configuration
  change. Do not add a dirty flag, duplicate defaults, status/count text or change-summary state.
  Use 8px footer vertical padding, a top border matching the header separator, and no Card
  bottom padding when the footer exists. Override the standard border-triggered top padding
  explicitly; the resulting footer is 41px high, not the earlier 32px tight version.
  Runtime inventory still drives feature availability through the bridge's existing APIs.
- The demo bridge initializes an absent browser color-mode preference to light through the
  existing Core storage/runtime APIs, once per mount. Preserve explicit saved light/dark/system
  choices. Reset uses light. The hello handshake reports current state when the frame or parent
  mounts, including slow hydration; both sides retain origin/source checks.
- The playground topic strip keeps Radix selection/keyboard behavior and one shared Motion
  layoutId indicator scoped by LayoutGroup. Gold/navy marks active; inactive text is muted.
  Reduced motion changes selection instantly. Never replace it with tab/icon hover lifts.
  The playground topic strip has no scroll container. Desktop uses one row, phones use
  two rows with visible labels. Verify scrollHeight equals clientHeight and focus is visible.
- The playground's five topics (Plugins, Themes, Layout, Language and Code) drive the same iframe
  bridge. App-specific settings stay in the real app's Settings pages, not an outer Settings
  topic. Removed topic selections fall back to Plugins. The inspector is beside the
  app on desktop and in normal document flow above it on narrow screens. The iframe remains
  mounted while the real source is shown. Fumadocs owns the install command and package-manager tabs.
- Numbers come from `apps/docs/components/diagrams/measurements.json` (`npm run measure:onboarding`);
  always retain the measured/estimated qualification. Do not add invented performance claims.
- The full-page demo uses the standard AppBar with the website card surface and gold separator and a native return link to `/#playground`; it is absent inside iframes. The single `View live` link above the preview opens it in the same tab. SettingsRoute sets `backHref="/dashboard"`, since `/` belongs to marketing. AppBar height offsets the existing fixed sidebar and settings viewport through central demo CSS.
- The standalone banner reads the existing website theme through next-themes with
  `attribute="data-site-theme"` and `enableColorScheme={false}`; Shell retains the app's own
  class/color-scheme. Customize is a standard primary Button with `data-slot="button"` preserved
  through SheetTrigger so the central 3D finish applies; Back uses the standard outline variant.
  The button opens a standard Sheet with the shared Inspector
  and its four configuration topics. The Code view remains in the landing page. Sheet owns
  focus trapping, Escape and focus restoration; the inspector's existing Close is the only
  close control. Its runtime stays mounted across language, layout and theme changes.
  AppBar automatically renders app-bar.end inside a BitaKit provider: the banner hides its
  duplicate `.quick-search-trigger` using that package's public CSS hook. Shell retains the
  real search trigger and keyboard shortcut. No manual registry or additional provider.
- The app document owns its background, color-scheme and thin native scrollbar colors; never inherit the dark marketing track into a light iframe. Auto-hide follows browser/OS behavior.
- Chart colors for the default app theme stay in `playground.css` (gold, slate, copper, sage, taupe); alternate themes can override them. Each plugin uses semantic chart tokens.
- Code-tab folders and files are read from the real plugin directories. Its selector uses that loaded inventory; the bridge automatically includes new feature plugins while keeping foundation plugins protected and the original dependent startup order.
- KPI tiles stay in `src/components/ui/stat-card.tsx`; marketing styles must not reach that document. All three stat plugins use the shared
  StatCard: container queries move the sparkline below narrow metrics; values wrap in normal
  flow rather than truncate. Format values with next-intl's active locale.
- `NEXT_PUBLIC_DOCS_URL` sets where the docs links point; it defaults to the local docs server.
- Both root layouts use `apps/brand-icons.ts` for browser/home-screen metadata. Preserve the
  supplied SVG marks in `public/brand`; native `prefers-color-scheme` media selects the browser
  variant independently of the site's theme switch. The transparent 192px fallback and 180px
  Apple PNGs come from the light SVG via Sharp contain sizing. Keep full wordmarks in existing
  navigation/footer surfaces; no favicon observer or separate theme state is needed.

## Hosting

The `bitakit` Vercel project serves this app with the standard Next.js runtime, including
the locale cookie and Server Action. Its root directory is `apps/landing`; the build command
from there is `cd ../.. && npm run build:actions && npm run build:landing` with Node 24.
The install command is `cd ../.. && npm ci --include=dev`: package compilation requires
the complete workspace's development dependencies, not only the app's dependency subset.
Production `NEXT_PUBLIC_DOCS_URL` is `https://mvavesal.github.io/bitakit`.
Do not statically export the live demo or replace its locale/settings ownership.
The project currently deploys through authenticated Vercel CLI; Git integration requires
the account's GitHub integration. Use the verified project/team, never an implicit CLI target.
`.vercelignore` keeps local environments, private work and development output out of uploads.
Use `NEXT_BUILD_DIR=.next-build` for production checks alongside the stable 3104 preview.

## Checks

`next.config.ts` disables Next.js `devIndicators` so the development badge does not obscure
the demo's bottom Settings link in either the iframe or full-page view.

`npm run typecheck --workspace @bitakit/landing` and `npm run build:landing`. For visible
changes, open `/` and walk every topic, both site and app color schemes, and a narrow window.
Check a plugin toggle, a setting, language, code state retention, the mobile menu and keyboard focus.
When the default port is occupied, use the workspace command:
`npm run dev --workspace @bitakit/landing -- --port <port>`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
