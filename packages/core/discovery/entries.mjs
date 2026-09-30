import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

/** Shared traversal for every contribution kind. Nested modules are separate boundaries. */
export async function files(directory, boundaries = new Set()) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink contribution: ${file}`);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.foundation', '.next', 'dist'].includes(entry.name)) continue;
      if (!boundaries.has(file)) result.push(...(await files(file, boundaries)));
    } else result.push(file);
  }
  return result;
}

export const contributionKinds = {
  actions: ['form-action', 'dialog-action', 'action'],
  services: ['service'],
  interceptors: ['interceptor'],
  configs: [],
  providers: ['provider'],
  views: ['view'],
  pages: ['page'],
};

/**
 * Validates integration kinds from `foundation.config.ts`. Each names a contribution kind, the
 * folder that identifies it inside every module root, and the runtime normalizer to import.
 */
export function contributionKindSpecs(kinds = []) {
  if (!Array.isArray(kinds)) throw new Error('Discovery "kinds" must be an array.');
  const names = new Set();
  const folders = new Map(
    Object.keys(contributionKinds).map((kind) => [kind, `built-in kind "${kind}"`]),
  );
  return kinds.map((kind) => {
    const { name, directory, from, normalize } = kind ?? {};
    if (typeof name !== 'string' || !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(name))
      throw new Error(`Invalid contribution kind name: ${JSON.stringify(name)}`);
    if (names.has(name)) throw new Error(`Duplicate contribution kind "${name}".`);
    names.add(name);
    if (Object.hasOwn(contributionKinds, name))
      throw new Error(`Contribution kind "${name}" is built in.`);
    const folder =
      typeof directory === 'string' ? directory.replace(/^\.\//, '').replace(/\/+$/, '') : '';
    if (!folder || folder.split('/').some((part) => !/^[a-z0-9][a-z0-9_-]*$/i.test(part)))
      throw new Error(
        `Contribution kind "${name}" needs a relative folder name, got ${JSON.stringify(directory)}.`,
      );
    const first = folder.split('/')[0];
    if (folders.has(first))
      throw new Error(
        `Contribution kind "${name}" uses folder "${first}", already used by ${folders.get(first)}.`,
      );
    folders.set(first, `kind "${name}"`);
    if (typeof from !== 'string' || !from.trim())
      throw new Error(`Contribution kind "${name}" needs the module that exports its normalizer.`);
    if (typeof normalize !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(normalize))
      throw new Error(`Contribution kind "${name}" needs the normalizer export name.`);
    return Object.freeze({ name, directory: folder, from, normalize, types: kind.types });
  });
}

/** Folders and dots have identical meaning. Legacy suffixes are migration aliases. */
export async function discoverEntries(base, paths, kind, { directory, explicitFile } = {}) {
  const extension = typeof kind === 'object' && kind !== null;
  const suffixes = extension ? [] : contributionKinds[kind];
  if (!suffixes) throw new Error(`Unknown contribution kind: ${kind}`);
  const folder = extension ? kind.directory.split('/') : [kind];
  const label = extension ? kind.name : kind;
  const result = [];
  const seen = new Map();
  for (const file of paths) {
    if (!/\.tsx?$/.test(file) || /\.d\.ts$/.test(file)) continue;
    const relative = path.relative(base, file);
    if (!directory && !explicitFile && (relative.startsWith('..') || path.isAbsolute(relative)))
      continue;
    let segments = relative.replace(/\.tsx?$/, '').split(/[\\/.]/);
    if (segments.some((segment) => segment.startsWith('-'))) continue;
    // This discovery entry emits client-importable contributions only.
    if (segments.includes('server')) continue;
    if (explicitFile === file) segments = [path.basename(file).replace(/\.tsx?$/, '')];
    else if (directory) {
      const local = path.relative(directory, file);
      if (local.startsWith('..') || path.isAbsolute(local)) continue;
      segments = local.replace(/\.tsx?$/, '').split(/[\\/.]/);
    } else {
      if (folder.some((part, index) => segments[index] !== part)) continue;
      segments = segments.slice(folder.length);
    }
    const legacy = suffixes.includes(segments.at(-1));
    if (legacy) segments.pop();
    if (!legacy && segments.at(-1) === 'index') segments.pop();
    if (segments.some((segment) => !segment)) throw new Error(`Empty contribution path: ${file}`);
    const sourceText = await readFile(file, 'utf8');
    const syntax = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, false);
    const hasDefault = syntax.statements.some(
      (statement) =>
        (ts.isExportAssignment(statement) && !statement.isExportEquals) ||
        statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ||
        (ts.isExportDeclaration(statement) &&
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.some((element) => element.name.text === 'default')),
    );
    if (!hasDefault) continue;
    const key = segments.join('.');
    if (seen.has(key))
      throw new Error(`Duplicate ${label} path "${key}": ${seen.get(key)} and ${file}`);
    seen.set(key, file);
    result.push({ file, path: segments, source: relative });
  }
  return result;
}
