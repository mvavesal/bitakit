import path from 'node:path';
import { exists } from './project.mjs';

/**
 * The one identity sentence. The root README, the docs introduction, generated READMEs and agent
 * rules repeat it verbatim; a test keeps those surfaces from drifting apart.
 */
export const bitakitIdentity = 'BitaKit is a composition layer for building apps with AI agents.';

/**
 * Markers around the BitaKit block. The block between them is BitaKit-owned: `bitakit init
 * --update-agent-files` replaces it, so app rules belong above or below it.
 */
export const agentRulesBegin = '<!-- BEGIN:bitakit-agent-rules -->';
export const agentRulesEnd = '<!-- END:bitakit-agent-rules -->';

/**
 * An AGENTS.md text with its BitaKit block replaced by `rules`. Returns `text` itself when the
 * block already matches (line endings aside) and undefined when it has no complete block.
 */
export function refreshAgentRules(text, rules) {
  const start = text?.indexOf(agentRulesBegin) ?? -1;
  const end = start < 0 ? -1 : text.indexOf(agentRulesEnd, start);
  if (end < 0) return undefined;
  const next = text.slice(0, start) + rules.trimEnd() + text.slice(end + agentRulesEnd.length);
  const lf = (value) => value.replaceAll('\r\n', '\n');
  return lf(next) === lf(text) ? text : next;
}

/**
 * The rules `bitakit init` writes for an app: its framework's route folder and the Shell line when
 * `@bitakit/shell` is installed. Undefined for an app without a supported framework.
 */
export async function projectAgentRules(project) {
  if (!project.framework) return undefined;
  const dependencies = { ...project.manifest.dependencies, ...project.manifest.devDependencies };
  // The framework's own route folder: src/app or app for Next.js, src/routes for TanStack Start.
  const routes =
    project.framework === 'next'
      ? (await exists(path.join(project.root, 'src/app')))
        ? 'src/app'
        : 'app'
      : 'src/routes';
  return agentRules({ routes, shell: Boolean(dependencies['@bitakit/shell']) });
}

/**
 * Claude Code reads `CLAUDE.md`, not `AGENTS.md`, so the app's `CLAUDE.md` imports the rules with
 * `@AGENTS.md`. Returns the file to write: a new one, or `existing` with the import appended;
 * `existing` is returned unchanged when it already imports AGENTS.md.
 */
export function claudeFileFor(existing) {
  const text = existing?.trim() ? existing : undefined;
  if (!text) return '@AGENTS.md\n';
  return /^@AGENTS\.md\s*$/m.test(text) ? existing : `${text.trimEnd()}\n\n@AGENTS.md\n`;
}

/**
 * The guidance block for coding assistants in an app's AGENTS.md, shared by create-app and
 * `bitakit init`. Ordered by learning level: where each task goes first, then the rules, then
 * the advanced kinds by name only. `routes` is the framework's own route folder; `shell` adds
 * the Shell placement line. Tests hold it to one screen.
 */
export function agentRules({ routes, shell = false }) {
  return `${agentRulesBegin}

# BitaKit

${bitakitIdentity} One feature = one folder in \`src/plugins/<name>/\`;
the file path is the ID. Discovery generates \`src/bitakit.gen.*\`; there is no registry to edit.

| Task | Where it goes |
| --- | --- |
| A page | \`ui/pages/<path>.tsx\`, served at \`/<name>/<path>\` |
| A button, link or menu entry | \`actions/<file>.ts\`: \`defineAction({ title, execute })\`, ID \`<name>.<file>\` |
| Shared state or logic | \`services/<file>.ts\`: \`defineService(({ store }) => ({ ... }))\`, \`services.<name>.<file>\` |
| A user setting | \`settings.ts\`: \`defineSettings({ size: setting({ default: 20 }) })\`, \`settings.<name>.size\` |
| Tell other features something happened | \`events.ts\`: \`defineEvents({ changed: event<T>() })\`, \`<name>.changed\` |
| Let other features add UI here | \`slots/<file>.ts\`: \`defineSlot(...)\`; others fill it from \`ui/slots/<slot>.tsx\` |
| Change a feature you do not own | Listen to its events, fill its slots or read its settings from your own plugin |

- Start with a page, then a service and an Action; add files only when needed. A small plugin
  may keep one record file per kind (\`actions.ts\` exporting \`{ add, remove }\`, same IDs).
- Bind every control that runs an operation to its Action: \`<Action id="<name>.<file>" input={...}><Button /></Action>\`,
  \`ActionButton\` or \`ActionLink\`. Label, disabled, pending and confirmation come from the Action, not from
  hand-written \`disabled\`/\`onClick\` state.
- In React: \`useServiceState('<name>.<file>', (state) => ...)\`, \`useSetting('<name>.<key>')\`, \`useEvent('<name>.changed', fn)\`.
  React only under \`ui/\`. Use \`@bitakit/ui/components\` and the app theme; do not restyle locally or
  import package CSS from JavaScript (discovery writes \`src/bitakit.gen.css\`).
- Do not rebuild what BitaKit provides: no own registries, event buses, settings stores or button state.
${shell ? "- Shell: place an Action with `slots: ['shell.navigation']` or `['shell.toolbar']`; header content goes in `ui/slots/shell.header.end.tsx`.\n" : ''}- App-owned routes stay native framework routes in \`${routes}\`; layouts live in \`src/layouts/<name>.tsx\`.
- Create files with \`npx bitakit add plugin <name>\` and \`npx bitakit add <kind> <name>/<file>\` (\`events\` and
  \`settings\` take only \`<name>\`); list IDs with \`npx bitakit info --json\` and slots with \`npx bitakit slots\`; check with \`npx bitakit doctor\` and \`npm run typecheck\`.
- For feature work, use the project-local \`bitakit-app-development\` skill (\`$bitakit-app-development\` in Codex,
  \`/bitakit-app-development\` in Claude Code, otherwise read \`.agents/skills/bitakit-app-development/SKILL.md\`):
  recipes for each task above, slot and layout choice, and checking the result in the browser.
- Advanced, only when needed: interceptors, configs, providers, dialogs, \`setup.ts\`, \`plugin.config.ts\`.
- Never edit generated files: \`src/bitakit.gen.*\`.

${agentRulesEnd}
`;
}
