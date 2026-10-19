import {
  lstat,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { claudeFileFor } from '@bitakit/cli';

/**
 * Entries a folder may already hold when a project is created in it: version control, editor
 * settings and agent files. Desktop agents open a folder before anything exists, so their rules
 * and skills must end up in that folder rather than in a new subfolder.
 */
export const keptEntries = new Set([
  '.git',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.DS_Store',
  'Thumbs.db',
  '.idea',
  '.vscode',
  '.agents',
  '.claude',
  '.codex',
  '.cursor',
  'AGENTS.md',
  'CLAUDE.md',
  'LICENSE',
  'skills-lock.json',
]);

const ignoreMissing = (error) => {
  if (error.code !== 'ENOENT') throw error;
  return undefined;
};

/**
 * The entries of an existing destination folder, or undefined when it does not exist yet.
 * Throws for a file, a symbolic link or a folder with any entry outside `keptEntries`.
 */
export async function existingFolder(target) {
  const stats = await lstat(target).catch(ignoreMissing);
  if (!stats) return undefined;
  if (!stats.isDirectory())
    throw new Error(`Destination already exists: ${target}. Choose a new directory.`);
  const entries = (await readdir(target)).sort();
  const unexpected = entries.filter((entry) => !keptEntries.has(entry));
  if (unexpected.length) {
    const listed = unexpected.slice(0, 10).join(', ');
    const more = unexpected.length > 10 ? `, and ${unexpected.length - 10} more` : '';
    throw new Error(
      `Destination already exists: ${target}. A project is created in an existing folder only when it holds nothing but version control, editor and agent files; this one also contains ${listed}${more}. Choose a new directory.`,
    );
  }
  return entries;
}

/**
 * Rethrows an error raised before anything reached the destination, marked with
 * `targetUnchanged: true` so the caller can say that nothing there changed.
 */
export const failUnchanged = (error) => {
  throw Object.assign(error, { targetUnchanged: true });
};

/**
 * Generates a project in a staging folder and moves it into the existing `target`. Framework
 * scaffolders refuse non-empty folders, and staging keeps `target` untouched when generation
 * fails (the error then has `targetUnchanged: true`). The staging folder is removed on success
 * and on failure. Resolves to the generated paths that were not applied because the user's own
 * file or folder stays in their place.
 */
export async function createInExistingFolder(target, generate) {
  const staging = await stagingFolder(target).catch(failUnchanged);
  try {
    // The project folder keeps the target's name: scaffolders derive the package name from it.
    const staged = path.join(staging, path.basename(target));
    await generate(staged).catch(failUnchanged);
    const kept = [];
    await moveInto(staged, target, '', { root: await realpath(target), kept });
    return kept;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/**
 * A sibling on the same filesystem, so moving the result in is a rename. Agent sandboxes often
 * allow writes only inside the open folder; then, or when the target is a mount point, the
 * staging folder goes inside the target, which is the same filesystem by definition.
 */
async function stagingFolder(target) {
  const parent = path.dirname(target);
  if ((await stat(parent)).dev === (await stat(target)).dev)
    try {
      return await mkdtemp(path.join(parent, `.${path.basename(target)}-bitakit-`));
    } catch (error) {
      if (!['EACCES', 'EPERM', 'EROFS'].includes(error.code)) throw error;
    }
  return mkdtemp(path.join(target, '.bitakit-staging-'));
}

/** Files at the project root that are merged with the user's version instead of kept as is. */
const textMerges = {
  'AGENTS.md': mergeAgentRules,
  'CLAUDE.md': (existing) => claudeFileFor(existing),
  '.gitignore': mergeIgnoreLines,
};

/**
 * Moves generated entries into `target` without replacing anything the user has: missing entries
 * move in, folders merge entry by entry and the root text files above merge, also through a
 * symbolic link to a file in the project. Every other existing file or symbolic link stays as it
 * is and is listed in `kept`. A folder that already holds a SKILL.md is a user-owned skill and
 * stays whole, as when the skill installer finds it.
 */
async function moveInto(source, target, relative, { root, kept }) {
  for (const entry of await readdir(source)) {
    const file = relative ? `${relative}/${entry}` : entry;
    // A generated project never brings its own repository into the user's.
    if (file === '.git') continue;
    const from = path.join(source, entry);
    const to = path.join(target, entry);
    const current = await lstat(to).catch(ignoreMissing);
    const real = current && Object.hasOwn(textMerges, file) && (await fileInside(root, to));
    if (!current) await rename(from, to);
    else if (real) {
      // With `AGENTS.md -> CLAUDE.md` (or the reverse) one file holds the rules; importing
      // AGENTS.md from it would import itself.
      if (file === 'CLAUDE.md' && real === (await fileInside(root, path.join(target, 'AGENTS.md'))))
        continue;
      const existing = await readFile(to, 'utf8');
      const merged = textMerges[file](existing, await readFile(from, 'utf8'));
      if (merged !== existing) await writeFile(to, merged);
    } else if (
      current.isDirectory() &&
      (await lstat(from)).isDirectory() &&
      !(await lstat(path.join(to, 'SKILL.md')).catch(ignoreMissing))
    )
      await moveInto(from, to, file, { root, kept });
    else kept.push(file);
  }
}

/**
 * The real path of `file` when it is, or links to, a regular file inside `root` (a real path).
 * Undefined for anything else, such as a folder, a dangling or looping link, or a link that
 * leads out of the project.
 */
async function fileInside(root, file) {
  const real = await realpath(file).catch((error) => {
    if (!['ENOENT', 'ELOOP'].includes(error.code)) throw error;
    return undefined;
  });
  const relative = real && path.relative(root, real);
  if (!relative || relative.split(path.sep)[0] === '..' || path.isAbsolute(relative)) return;
  return (await stat(real)).isFile() ? real : undefined;
}

/** Blocks that tools manage in AGENTS.md, such as Next.js's and BitaKit's rules. */
const managedBlock = /<!-- BEGIN:([\w-]+) -->[\s\S]*?<!-- END:\1 -->/g;

/**
 * Appends the generated AGENTS.md content to the user's: each managed block once, identified by
 * its BEGIN marker, and any other generated text unless the file already contains it.
 */
function mergeAgentRules(existing, generated) {
  const parts = [];
  let last = 0;
  for (const match of generated.matchAll(managedBlock)) {
    parts.push({ text: generated.slice(last, match.index) });
    parts.push({ text: match[0], key: `<!-- BEGIN:${match[1]} -->` });
    last = match.index + match[0].length;
  }
  parts.push({ text: generated.slice(last) });
  const added = parts
    .map(({ text, key }) => ({ text: text.trim(), key }))
    .filter(({ text, key }) => text && !existing.includes(key ?? text))
    .map(({ text }) => text);
  if (!added.length) return existing;
  return `${[existing.trimEnd(), ...added].filter(Boolean).join('\n\n')}\n`;
}

/**
 * Adds the generated .gitignore lines the user's file lacks. Generated groups (separated by blank
 * lines) keep their comments when at least one of their patterns is added. They go first: the
 * last matching pattern wins, so the user's own lines, such as `!.env.example`, keep their effect.
 */
function mergeIgnoreLines(existing, generated) {
  const present = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const groups = generated
    .split(/\n\s*\n/)
    .map((group) =>
      group
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .map((lines) => {
      const added = lines.filter((line) => !line.startsWith('#') && !present.has(line));
      return added.length
        ? lines.filter((line) => line.startsWith('#') || added.includes(line))
        : [];
    })
    .filter((lines) => lines.length);
  if (!groups.length) return existing;
  const blocks = groups.map((lines) => lines.join('\n'));
  return `${[...blocks, existing.trimEnd()].filter(Boolean).join('\n\n')}\n`;
}
