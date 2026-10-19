import { access, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The one identity sentence. The root README, the docs introduction, generated READMEs and agent
 * rules repeat it verbatim; a test keeps those surfaces from drifting apart.
 */
export const bitakitIdentity = 'BitaKit is a composition layer for building apps with AI agents.';

/** Markers around the BitaKit block, so a later run can find and leave it alone. */
export const agentRulesBegin = '<!-- BEGIN:bitakit-agent-rules -->';
export const agentRulesEnd = '<!-- END:bitakit-agent-rules -->';
/**
 * Where the app-authoring skill is installed: `.agents/skills` is read by Codex and most other
 * agents (Cursor, Copilot, Gemini CLI), `.claude/skills` by Claude Code.
 */
export const appDevelopmentSkillPaths = [
  '.agents/skills/bitakit-app-development/SKILL.md',
  '.claude/skills/bitakit-app-development/SKILL.md',
];
const skillSource = fileURLToPath(new URL('../skills/bitakit-app-development', import.meta.url));

/**
 * Install the bundled app-authoring skill (SKILL.md and its references/) for every agent folder.
 * A folder that already has a SKILL.md is user-owned and left whole, so an edited team copy is
 * never mixed with newer files; callers report it as preserved. The README next to the source is
 * for people browsing the package and is not installed.
 */
export async function writeAppDevelopmentSkills(root) {
  const files = [];
  for (const relative of appDevelopmentSkillPaths) {
    const file = path.join(root, relative);
    try {
      await access(file);
      files.push({ file, created: false });
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await cp(skillSource, path.dirname(file), {
      recursive: true,
      filter: (source) => path.relative(skillSource, source) !== 'README.md',
    });
    files.push({ file, created: true });
  }
  return files;
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
  \`settings\` take only \`<name>\`); list IDs with \`npx bitakit info --json\`; check with \`npx bitakit doctor\` and \`npm run typecheck\`.
- For feature work, use the project-local \`bitakit-app-development\` skill (\`$bitakit-app-development\` in Codex,
  \`/bitakit-app-development\` in Claude Code, otherwise read \`.agents/skills/bitakit-app-development/SKILL.md\`):
  recipes for each task above, slot and layout choice, and checking the result in the browser.
- Advanced, only when needed: interceptors, configs, providers, dialogs, \`setup.ts\`, \`plugin.config.ts\`.
- Never edit generated files: \`src/bitakit.gen.*\`.

${agentRulesEnd}
`;
}
