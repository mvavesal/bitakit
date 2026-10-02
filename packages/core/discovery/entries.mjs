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
      if (
        [
          'node_modules',
          '.git',
          '.foundation',
          '.next',
          '.tanstack',
          '.output',
          'dist',
          'coverage',
        ].includes(entry.name)
      )
        continue;
      if (!boundaries.has(file)) result.push(...(await files(file, boundaries)));
    } else result.push(file);
  }
  return result;
}

/**
 * Where each built-in kind lives. UI kinds live under `ui/`; their old root folders are still
 * read with a migration warning. Legacy filename suffixes (`x.action.ts`) are accepted the same way.
 */
export const contributionKinds = {
  actions: { folder: 'actions', suffixes: ['form-action', 'dialog-action', 'action'] },
  services: { folder: 'services', suffixes: ['service'] },
  interceptors: { folder: 'interceptors', suffixes: ['interceptor'] },
  configs: { folder: 'configs', suffixes: [] },
  pages: { folder: 'ui/pages', legacy: 'pages', suffixes: ['page'] },
  slots: { folder: 'ui/slots', legacy: 'views', suffixes: ['view'] },
  providers: { folder: 'ui/providers', legacy: 'providers', suffixes: ['provider'] },
};
export const builtInKindNames = Object.keys(contributionKinds);

/**
 * Validates integration kinds from `bitakit.config.ts`. Each names a contribution kind, the
 * folder that identifies it inside `contributions/` of every module, and the runtime normalizer.
 */
export function contributionKindSpecs(kinds = []) {
  if (!Array.isArray(kinds)) throw new Error('Discovery "kinds" must be an array.');
  const names = new Set();
  const folders = new Map();
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
    if (folders.has(folder))
      throw new Error(
        `Contribution kind "${name}" uses folder "${folder}", already used by ${folders.get(folder)}.`,
      );
    folders.set(folder, `kind "${name}"`);
    if (typeof from !== 'string' || !from.trim())
      throw new Error(`Contribution kind "${name}" needs the module that exports its normalizer.`);
    if (typeof normalize !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(normalize))
      throw new Error(`Contribution kind "${name}" needs the normalizer export name.`);
    return Object.freeze({ name, directory: folder, from, normalize, types: kind.types });
  });
}

function hasDefaultExport(file, sourceText) {
  const syntax = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, false);
  return syntax.statements.some(
    (statement) =>
      (ts.isExportAssignment(statement) && !statement.isExportEquals) ||
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword) ||
      (ts.isExportDeclaration(statement) &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause) &&
        statement.exportClause.elements.some((element) => element.name.text === 'default')),
  );
}

/**
 * The contribution files of one kind inside a module. Folders and dots in file names have the
 * same meaning. Returns `{ entries, warnings }`: warnings name ignored files (no default export)
 * and legacy locations or suffixes that `bitakit migrate` rewrites.
 */
export async function discoverEntries(
  base,
  paths,
  kind,
  { directory, explicitFile, relativeTo = base } = {},
) {
  const extension = typeof kind === 'object' && kind !== null;
  const spec = extension ? null : contributionKinds[kind];
  if (!extension && !spec) throw new Error(`Unknown contribution kind: ${kind}`);
  const label = extension ? kind.name : kind;
  const suffixes = extension ? [] : spec.suffixes;
  const roots = extension
    ? [
        { folder: `contributions/${kind.directory}`.split('/'), legacy: false },
        { folder: kind.directory.split('/'), legacy: `contributions/${kind.directory}/` },
      ]
    : [
        { folder: spec.folder.split('/'), legacy: false },
        ...(spec.legacy ? [{ folder: spec.legacy.split('/'), legacy: `${spec.folder}/` }] : []),
      ];
  const entries = [];
  const warnings = [];
  const seen = new Map();
  for (const file of paths) {
    if (!/\.tsx?$/.test(file) || /\.d\.ts$/.test(file)) continue;
    const relative = path.relative(base, file).split(path.sep).join('/');
    if (!directory && !explicitFile && (relative.startsWith('..') || path.isAbsolute(relative)))
      continue;
    let segments = relative.replace(/\.tsx?$/, '').split(/[/.]/);
    if (segments.some((segment) => segment.startsWith('-'))) continue;
    // Server files never reach the client bundle.
    if (segments[0] === 'server') continue;
    let legacyLocation = false;
    if (explicitFile === file) segments = [path.basename(file).replace(/\.tsx?$/, '')];
    else if (directory) {
      const local = path.relative(directory, file);
      if (local.startsWith('..') || path.isAbsolute(local)) continue;
      segments = local.replace(/\.tsx?$/, '').split(/[\\/.]/);
    } else {
      const root = roots.find(({ folder }) =>
        folder.every((part, index) => segments[index] === part),
      );
      if (!root) continue;
      // Everything under ui/ that is not a UI kind folder is a plain component, never a contribution.
      segments = segments.slice(root.folder.length);
      legacyLocation = root.legacy;
    }
    const legacySuffix = suffixes.includes(segments.at(-1));
    if (legacySuffix) segments.pop();
    if (!legacySuffix && segments.at(-1) === 'index') segments.pop();
    if (segments.some((segment) => !segment)) throw new Error(`Empty contribution path: ${file}`);
    const sourceText = await readFile(file, 'utf8');
    const shown = path.relative(relativeTo, file).split(path.sep).join('/');
    if (!hasDefaultExport(file, sourceText)) {
      warnings.push(
        `${shown} is in a ${label} folder but has no default export, so it is ignored. Export the contribution as default, or prefix the file name with "-" for helpers.`,
      );
      continue;
    }
    if (legacyLocation)
      warnings.push(
        `${shown}: move it under ${legacyLocation}; the old location is deprecated (run "bitakit migrate").`,
      );
    if (legacySuffix)
      warnings.push(
        `${shown}: drop the ".${suffixes.find((suffix) => shown.includes(`.${suffix}.`)) ?? label}" suffix; folders are the one convention (run "bitakit migrate").`,
      );
    const key = segments.join('.');
    if (seen.has(key))
      throw new Error(`Duplicate ${label} path "${key}": ${seen.get(key)} and ${file}`);
    seen.set(key, file);
    entries.push({ file, path: segments, source: relative });
  }
  return { entries, warnings };
}
