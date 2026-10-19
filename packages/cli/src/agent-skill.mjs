import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Where the app-authoring skill is installed: `.agents/skills` is read by Codex and most other
 * agents (Cursor, Copilot, Gemini CLI), `.claude/skills` by Claude Code.
 */
export const appDevelopmentSkillPaths = [
  '.agents/skills/bitakit-app-development/SKILL.md',
  '.claude/skills/bitakit-app-development/SKILL.md',
];
const skillSource = fileURLToPath(new URL('../skills/bitakit-app-development', import.meta.url));
/** The release whose skill this CLI installs; installed copies record it. */
export const { version: cliVersion } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

// The install stamp is a spec-valid frontmatter `metadata` map at the end of the frontmatter.
// Its checksum covers the files as shipped, so an unedited copy can be told apart from a team's
// edit and replaced safely. Text is compared with LF line endings, so a Git checkout with CRLF
// does not count as an edit.
const lf = (text) => text.replaceAll('\r\n', '\n');
const frontmatter = /^---\n[\s\S]*?\n(?=---\n)/;
const stampBlock =
  /^metadata:\n {2}bitakit-version: "([^"\n]*)"\n {2}bitakit-checksum: "([0-9a-f]{64})"\n/m;

/** A SKILL.md as shipped with the install stamp added to its frontmatter. */
export function stampSkill(text, { version, checksum }) {
  const head = frontmatter.exec(text)?.[0];
  if (head === undefined) throw new Error('The bundled SKILL.md has no frontmatter.');
  return `${head}metadata:\n  bitakit-version: "${version}"\n  bitakit-checksum: "${checksum}"\n${text.slice(head.length)}`;
}

/** The install stamp of a SKILL.md, `{ version, checksum }`, or undefined when it has none. */
export function readSkillStamp(text) {
  const match = stampBlock.exec(frontmatter.exec(lf(text))?.[0] ?? '');
  return match ? { version: match[1], checksum: match[2] } : undefined;
}

/** A SKILL.md without its install stamp, with LF line endings: the text as shipped. */
export function unstampSkill(text) {
  const normalized = lf(text);
  const head = frontmatter.exec(normalized)?.[0];
  if (head === undefined) return normalized;
  return head.replace(stampBlock, '') + normalized.slice(head.length);
}

/**
 * The files of a skill folder as shipped: `[path, content]` pairs sorted by relative POSIX path,
 * with LF line endings and the stamp removed from SKILL.md. Compare an installed copy with
 * `bundledSkillFiles()` through this rather than byte by byte. Dotfiles (`.DS_Store`, editor swap
 * files) are not part of a skill and are ignored.
 */
export async function readSkillFiles(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'),
    )
    .filter((file) => !file.split('/').some((part) => part.startsWith('.')))
    .sort();
  return Promise.all(
    files.map(async (file) => {
      const content = lf(await readFile(path.join(directory, file), 'utf8'));
      return [file, file === 'SKILL.md' ? unstampSkill(content) : content];
    }),
  );
}

/**
 * The files a skill source folder installs: everything but its README, which is for people
 * browsing the package. Defaults to the skill bundled with this CLI.
 */
export async function bundledSkillFiles(source = skillSource) {
  return (await readSkillFiles(source)).filter(([file]) => file !== 'README.md');
}

/** The `bitakit-checksum` of `[path, content]` pairs from `readSkillFiles`: sha256, hex. */
export function skillChecksum(files) {
  const hash = createHash('sha256');
  for (const [file, content] of files) hash.update(`${file}\0${content}\0`);
  return hash.digest('hex');
}

/** Whether `version` is a newer release than `than`, by major.minor.patch. */
function newerRelease(version, than) {
  const [a, b] = [version, than].map((value) => value.split('-')[0].split('.').map(Number));
  const index = a.findIndex((part, position) => part !== b[position]);
  return index >= 0 && a[index] > b[index];
}

/**
 * How the skill copy in `directory` relates to the bundled skill. `state` is `missing`,
 * `current` (the files as shipped; `stamped` says whether its stamp records that), `outdated`
 * (stamped and unedited, from an older or the same release, so it can be replaced), `newer`
 * (stamped and unedited, from a newer CLI) or `edited` (changed since it was installed, or
 * unstamped and different: it is never replaced). `version` is the release in the stamp and
 * `checksum` the one recomputed from the files.
 */
export async function inspectSkillCopy(directory) {
  const text = await readFile(path.join(directory, 'SKILL.md'), 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (text === undefined) return { state: 'missing' };
  const checksum = skillChecksum(await readSkillFiles(directory));
  const stamp = readSkillStamp(text);
  const copy = { checksum, version: stamp?.version, stamped: stamp?.checksum === checksum };
  if (checksum === skillChecksum(await bundledSkillFiles())) return { ...copy, state: 'current' };
  if (!copy.stamped) return { ...copy, state: 'edited' };
  return { ...copy, state: newerRelease(stamp.version, cliVersion) ? 'newer' : 'outdated' };
}

/**
 * Installs the bundled app-authoring skill (SKILL.md and its references/) for every agent folder
 * and stamps the installed SKILL.md with this CLI's version and the checksum of the files as
 * shipped. An existing copy is left alone unless `update` is set: then an unedited older copy is
 * replaced whole and a current unstamped one gets its stamp. An edited copy is always kept whole,
 * so a team's changes are never mixed with newer files. Skill files are written as LF text, which
 * is why the bundled skill holds Markdown only (a test enforces it).
 * Returns, per SKILL.md path, the copy as found (`inspectSkillCopy`) plus `change`: `installed`,
 * `updated`, `stamped` or undefined when nothing was written.
 */
export async function writeAppDevelopmentSkills(root, { update = false } = {}) {
  const files = await bundledSkillFiles();
  const stamp = { version: cliVersion, checksum: skillChecksum(files) };
  const results = [];
  for (const relative of appDevelopmentSkillPaths) {
    const file = path.join(root, relative);
    // A team may link one copy to the other so both agents share a folder: write through the link
    // so it stays a link and the second copy then reads as up to date.
    const directory = await realpath(path.dirname(file)).catch(() => path.dirname(file));
    const copy = await inspectSkillCopy(directory);
    let change;
    if (copy.state === 'missing') change = 'installed';
    else if (update && copy.state === 'outdated') change = 'updated';
    else if (update && copy.state === 'current' && !copy.stamped) change = 'stamped';
    // The whole folder goes, so files an older release shipped and this one dropped do not linger.
    if (change === 'updated') await rm(directory, { recursive: true, force: true });
    for (const [name, content] of change ? files : []) {
      if (change === 'stamped' && name !== 'SKILL.md') continue;
      const target = path.join(directory, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, name === 'SKILL.md' ? stampSkill(content, stamp) : content);
    }
    results.push({ file, ...copy, change, created: change === 'installed' });
  }
  return results;
}
