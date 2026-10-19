import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  agentRulesBegin,
  agentRulesEnd,
  projectAgentRules,
  refreshAgentRules,
} from './agent-rules.mjs';
import { appDevelopmentSkillPaths, cliVersion, inspectSkillCopy } from './agent-skill.mjs';
import { exists } from './project.mjs';

/**
 * The agent files create-app and `bitakit init` write: both skill copies present and equal,
 * unedited copies current with this CLI, and the AGENTS.md BitaKit block equal to the rules init
 * writes for this app. Edited copies are the team's and only count when the two folders differ.
 * Undefined for an app without the BitaKit block or a skill folder.
 */
export async function checkAgentFiles(project) {
  const agents = await readFile(path.join(project.root, 'AGENTS.md'), 'utf8').catch(
    () => undefined,
  );
  const hasRules = Boolean(agents?.includes(agentRulesBegin));
  const folders = appDevelopmentSkillPaths.map((file) => path.dirname(file));
  const present = await Promise.all(
    folders.map((folder) => exists(path.join(project.root, folder))),
  );
  if (!hasRules && !present.includes(true)) return undefined;

  const details = [];
  let unterminated = false;
  const copies = await Promise.all(
    folders.map((folder) => inspectSkillCopy(path.join(project.root, folder))),
  );
  copies.forEach((copy, index) => {
    if (copy.state === 'missing') details.push(`${folders[index]} is missing.`);
    if (copy.state === 'outdated')
      details.push(
        `${folders[index]} is from @bitakit/cli ${copy.version}; this CLI ships ${cliVersion}.`,
      );
  });
  if (copies.every((copy) => copy.state !== 'missing') && copies[0].checksum !== copies[1].checksum)
    details.push(`${folders[0]} and ${folders[1]} differ.`);
  if (!hasRules) details.push('AGENTS.md has no BitaKit block.');
  else {
    const rules = await projectAgentRules(project);
    const refreshed = rules && refreshAgentRules(agents, rules);
    // init only replaces a complete block, so a lost end marker has to be restored first.
    unterminated = Boolean(rules) && refreshed === undefined;
    if (unterminated)
      details.push(`The BitaKit block in AGENTS.md has no ${agentRulesEnd} marker.`);
    else if (rules && refreshed !== agents)
      details.push('The BitaKit block in AGENTS.md differs from the rules of this CLI.');
  }

  if (!details.length) return { status: 'ok', title: 'Agent files are in sync' };
  const update =
    'Run "npx bitakit init --update-agent-files". It keeps skill folders you edited; delete such a folder first to get the current skill.';
  return {
    status: 'warn',
    title: 'Agent files are out of sync',
    details,
    fix: unterminated
      ? `Add the ${agentRulesEnd} line where the BitaKit block in AGENTS.md ends.\n${update}`
      : update,
  };
}
