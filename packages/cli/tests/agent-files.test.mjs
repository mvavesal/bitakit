import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  agentRulesBegin,
  agentRulesEnd,
  bundledSkillFiles,
  doctor,
  findProject,
  projectAgentRules,
  readSkillFiles,
  refreshAgentRules,
  writeAppDevelopmentSkills,
} from '../src/index.mjs';
import {
  cliVersion,
  inspectSkillCopy,
  readSkillStamp,
  skillChecksum,
  stampSkill,
  unstampSkill,
} from '../src/agent-skill.mjs';
import { bitakit, catchAll, find, link, nextApp, project, write } from './helpers.mjs';

const agentsSkill = '.agents/skills/bitakit-app-development';
const claudeSkill = '.claude/skills/bitakit-app-development';
const read = (root, file) => readFile(path.join(root, file), 'utf8');
const byPath = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

/** Writes a stamped skill copy as another release would have installed `files`. */
async function writeCopy(directory, files, version) {
  const sorted = [...files].sort(byPath);
  const stamp = { version, checksum: skillChecksum(sorted) };
  for (const [file, content] of sorted) {
    const target = path.join(directory, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file === 'SKILL.md' ? stampSkill(content, stamp) : content);
  }
}
/** The bundled skill as an older release shipped it: other text and one recipe since dropped. */
async function olderSkill() {
  return [
    ...(await bundledSkillFiles()).map(([file, content]) => [
      file,
      file === 'SKILL.md' ? content.replace('# BitaKit app development', '# Old title') : content,
    ]),
    ['references/retired.md', '# A recipe this release dropped\n'],
  ];
}

test('the installed SKILL.md carries a frontmatter stamp; the source stays unchanged', async (t) => {
  const root = await project({ 'package.json': { name: 'app' } }, t);
  const results = await writeAppDevelopmentSkills(root);
  assert.deepEqual(
    results.map((result) => result.change),
    ['installed', 'installed'],
  );
  const shipped = await bundledSkillFiles();
  const text = await read(root, `${agentsSkill}/SKILL.md`);
  assert.deepEqual(readSkillStamp(text), { version: cliVersion, checksum: skillChecksum(shipped) });
  // Agent Skills frontmatter: the name first, the metadata map before the closing marker.
  assert.match(
    text,
    /^---\nname: bitakit-app-development\ndescription: .+\nmetadata:\n {2}bitakit-version: "[^"]+"\n {2}bitakit-checksum: "[0-9a-f]{64}"\n---\n/,
  );
  const source = await readFile(
    new URL('../skills/bitakit-app-development/SKILL.md', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /^metadata:/m, 'the installer owns the frontmatter metadata map');
  assert.equal(unstampSkill(text), source);
  assert.deepEqual(await readSkillFiles(path.join(root, agentsSkill)), shipped);
  assert.equal(await read(root, `${claudeSkill}/SKILL.md`), text);
  assert.equal((await inspectSkillCopy(path.join(root, agentsSkill))).state, 'current');
});

test('the bundled skill holds Markdown only, because the installer copies it as LF text', async () => {
  // An image or an executable script would lose bytes or its mode; copy those as files first.
  for (const [file] of await bundledSkillFiles()) assert.match(file, /\.md$/, file);
});

test('the checksum covers paths and content, not the stamp, line endings or dotfiles', async (t) => {
  const root = await project({ 'package.json': { name: 'app' } }, t);
  await writeAppDevelopmentSkills(root);
  const directory = path.join(root, agentsSkill);
  const { checksum } = readSkillStamp(await read(root, `${agentsSkill}/SKILL.md`));
  assert.equal(skillChecksum(await readSkillFiles(directory)), checksum);
  assert.equal(skillChecksum(await bundledSkillFiles()), checksum, 'stable across reads');

  const slots = await read(directory, 'references/slots.md');
  await write(directory, {
    'references/slots.md': slots.replaceAll('\n', '\r\n'),
    '.DS_Store': 'finder',
    'references/.slots.md.swp': 'editor',
  });
  assert.equal((await inspectSkillCopy(directory)).state, 'current');

  await write(directory, { 'references/slots.md': `${slots}\nA team rule.\n` });
  assert.notEqual(skillChecksum(await readSkillFiles(directory)), checksum);
  await write(directory, { 'references/slots.md': slots, 'references/extra.md': '' });
  assert.notEqual(skillChecksum(await readSkillFiles(directory)), checksum);
  assert.equal((await inspectSkillCopy(directory)).state, 'edited');
});

test('updating classifies each copy: stale ones are replaced, edited and newer ones kept', async (t) => {
  const root = await project({ 'package.json': { name: 'app' } }, t);
  const older = await olderSkill();
  await writeCopy(path.join(root, agentsSkill), older, '0.1.0');
  await writeCopy(path.join(root, claudeSkill), older, '99.0.0');
  // Without the flag nothing existing changes, even a stale copy.
  let results = await writeAppDevelopmentSkills(root);
  assert.deepEqual(
    results.map(({ state, change }) => [state, change]),
    [
      ['outdated', undefined],
      ['newer', undefined],
    ],
  );
  results = await writeAppDevelopmentSkills(root, { update: true });
  assert.deepEqual(
    results.map(({ state, change, version }) => [state, change, version]),
    [
      ['outdated', 'updated', '0.1.0'],
      ['newer', undefined, '99.0.0'],
    ],
  );
  // The whole folder was replaced: the dropped recipe is gone.
  assert.deepEqual(await readSkillFiles(path.join(root, agentsSkill)), await bundledSkillFiles());
  assert.equal(readSkillStamp(await read(root, `${agentsSkill}/SKILL.md`)).version, cliVersion);

  // An unstamped copy with the shipped files only gains the stamp.
  await rm(path.join(root, claudeSkill), { recursive: true });
  await write(path.join(root, claudeSkill), Object.fromEntries(await bundledSkillFiles()));
  results = await writeAppDevelopmentSkills(root, { update: true });
  assert.deepEqual(
    results.map(({ state, change }) => [state, change]),
    [
      ['current', undefined],
      ['current', 'stamped'],
    ],
  );
  assert.equal(
    await read(root, `${claudeSkill}/SKILL.md`),
    await read(root, `${agentsSkill}/SKILL.md`),
  );

  // An unstamped copy that differs cannot be told apart from a team's edit.
  await write(path.join(root, claudeSkill), { 'SKILL.md': '# Team skill\n' });
  results = await writeAppDevelopmentSkills(root, { update: true });
  assert.deepEqual(
    results.map(({ state, change }) => [state, change]),
    [
      ['current', undefined],
      ['edited', undefined],
    ],
  );
  assert.equal(await read(root, `${claudeSkill}/SKILL.md`), '# Team skill\n');
});

test('updating a copy that links to the other refreshes the shared folder and keeps the link', async (t) => {
  const root = await project({ 'package.json': { name: 'app' } }, t);
  await writeCopy(path.join(root, claudeSkill), await olderSkill(), '0.1.0');
  await mkdir(path.join(root, '.agents/skills'), { recursive: true });
  await symlink(`../../${claudeSkill}`, path.join(root, agentsSkill), 'dir');
  const results = await writeAppDevelopmentSkills(root, { update: true });
  assert.deepEqual(
    results.map(({ state, change }) => [state, change]),
    [
      ['outdated', 'updated'],
      ['current', undefined],
    ],
  );
  assert.ok((await lstat(path.join(root, agentsSkill))).isSymbolicLink());
  assert.deepEqual(await readSkillFiles(path.join(root, claudeSkill)), await bundledSkillFiles());
});

test('the BitaKit block of AGENTS.md is replaced in place; everything around it stays', () => {
  const rules = `${agentRulesBegin}\n\nCurrent rules.\n\n${agentRulesEnd}\n`;
  const old = `# Team rules\n\n${agentRulesBegin}\nOld rules.\n${agentRulesEnd}\n\nMore team rules.\n`;
  assert.equal(
    refreshAgentRules(old, rules),
    `# Team rules\n\n${rules.trimEnd()}\n\nMore team rules.\n`,
  );
  const current = `# Team rules\r\n\r\n${rules.replaceAll('\n', '\r\n')}`;
  assert.equal(refreshAgentRules(current, rules), current, 'line endings are not a change');
  assert.equal(refreshAgentRules(`${agentRulesBegin}\nNo end marker.\n`, rules), undefined);
  assert.equal(refreshAgentRules(undefined, rules), undefined);
});

test('init --update-agent-files refreshes the AGENTS.md block and the skill copies, reports each, and doctor follows', async (t) => {
  const root = await project(
    nextApp({
      ...catchAll,
      'AGENTS.md': `# Team rules\n\n${agentRulesBegin}\nOld rules.\n${agentRulesEnd}\n\nMore team rules.\n`,
      'CLAUDE.md': '# Claude\n',
    }),
    t,
  );
  // init writes bitakit.config.ts, which doctor then loads.
  await link(root, '@bitakit/discovery', 'packages/discovery');
  await writeCopy(path.join(root, agentsSkill), await olderSkill(), '0.1.0');

  const plain = await bitakit(root, 'init');
  assert.equal(plain.code, 0, plain.stderr);
  assert.match(plain.stdout, /\+ \.claude\/skills\/bitakit-app-development\/SKILL\.md\n/);
  assert.match(
    plain.stdout,
    /- AGENTS\.md \(already has the BitaKit rules; --update-agent-files refreshes them\)/,
  );
  assert.match(
    plain.stdout,
    new RegExp(
      `- \\.agents/skills/bitakit-app-development/SKILL\\.md \\(already exists; preserved; --update-agent-files updates it from 0\\.1\\.0 to ${cliVersion.replaceAll('.', '\\.')}\\)`,
    ),
  );

  let report = await doctor({ cwd: root });
  const stale = find(report.results, /^Agent files/);
  assert.equal(stale.status, 'warn');
  assert.deepEqual(stale.details, [
    `${agentsSkill} is from @bitakit/cli 0.1.0; this CLI ships ${cliVersion}.`,
    `${agentsSkill} and ${claudeSkill} differ.`,
    'The BitaKit block in AGENTS.md differs from the rules of this CLI.',
  ]);
  assert.match(stale.fix, /npx bitakit init --update-agent-files/);

  const updated = await bitakit(root, 'init', '--update-agent-files');
  assert.equal(updated.code, 0, updated.stderr);
  assert.match(updated.stdout, /~ AGENTS\.md \(refreshed the BitaKit rules\)/);
  assert.match(
    updated.stdout,
    /~ \.agents\/skills\/bitakit-app-development\/SKILL\.md \(updated from 0\.1\.0\)/,
  );
  assert.match(
    updated.stdout,
    /- \.claude\/skills\/bitakit-app-development\/SKILL\.md \(up to date\)/,
  );
  assert.match(updated.stdout, /- CLAUDE\.md \(already imports AGENTS\.md\)/);
  const rules = await projectAgentRules(await findProject(root));
  assert.equal(
    await read(root, 'AGENTS.md'),
    `# Team rules\n\n${rules.trimEnd()}\n\nMore team rules.\n`,
  );
  assert.equal(await read(root, 'CLAUDE.md'), '# Claude\n\n@AGENTS.md\n');
  assert.deepEqual(await readSkillFiles(path.join(root, agentsSkill)), await bundledSkillFiles());
  report = await doctor({ cwd: root });
  assert.deepEqual(find(report.results, /^Agent files/), {
    status: 'ok',
    title: 'Agent files are in sync',
  });
  assert.ok(
    report.results.every((result) => result.status === 'ok'),
    JSON.stringify(report.results, null, 2),
  );

  // An edited copy stays; a deleted one comes back.
  const edited = `${await read(root, `${claudeSkill}/references/slots.md`)}\nA team rule.\n`;
  await write(root, { [`${claudeSkill}/references/slots.md`]: edited });
  await rm(path.join(root, agentsSkill), { recursive: true });
  const again = await bitakit(root, 'init', '--update-agent-files');
  assert.equal(again.code, 0, again.stderr);
  assert.match(again.stdout, /\+ \.agents\/skills\/bitakit-app-development\/SKILL\.md\n/);
  assert.match(
    again.stdout,
    new RegExp(
      `- \\.claude/skills/bitakit-app-development/SKILL\\.md \\(edited locally; kept\\. Delete its folder and run again to get ${cliVersion.replaceAll('.', '\\.')}\\)`,
    ),
  );
  assert.match(again.stdout, /- AGENTS\.md \(the BitaKit rules are up to date\)/);
  assert.equal(await read(root, `${claudeSkill}/references/slots.md`), edited);
  assert.deepEqual(await readSkillFiles(path.join(root, agentsSkill)), await bundledSkillFiles());
});

test('doctor checks agent files only where they were written, and names each problem', async (t) => {
  const root = await project(nextApp(catchAll), t);
  assert.equal(find((await doctor({ cwd: root })).results, /^Agent files/), undefined);

  await writeAppDevelopmentSkills(root);
  await rm(path.join(root, claudeSkill), { recursive: true });
  let check = find((await doctor({ cwd: root })).results, /^Agent files/);
  assert.deepEqual(check.details, [
    `${claudeSkill} is missing.`,
    'AGENTS.md has no BitaKit block.',
  ]);

  await writeAppDevelopmentSkills(root);
  await write(root, { 'AGENTS.md': await projectAgentRules(await findProject(root)) });
  check = find((await doctor({ cwd: root })).results, /^Agent files/);
  assert.deepEqual(check, { status: 'ok', title: 'Agent files are in sync' });

  // A copy from a newer CLI is not stale; this app's CLI is just behind.
  await rm(path.join(root, agentsSkill), { recursive: true });
  await writeCopy(path.join(root, agentsSkill), await olderSkill(), '99.0.0');
  check = find((await doctor({ cwd: root })).results, /^Agent files/);
  assert.deepEqual(check.details, [`${agentsSkill} and ${claudeSkill} differ.`]);

  // init cannot refresh a block without its end marker, so the fix starts with restoring it.
  await rm(path.join(root, agentsSkill), { recursive: true });
  await writeAppDevelopmentSkills(root);
  await write(root, { 'AGENTS.md': `# Team rules\n\n${agentRulesBegin}\nOld rules.\n` });
  check = find((await doctor({ cwd: root })).results, /^Agent files/);
  assert.deepEqual(check.details, [
    `The BitaKit block in AGENTS.md has no ${agentRulesEnd} marker.`,
  ]);
  assert.match(check.fix, new RegExp(`^Add the ${agentRulesEnd} line`));
});
