import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { sourceTrees } from './source-trees.mjs';

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

/** A contribution path's segments: folders and dots mean the same (`a/b.c.ts` → a, b, c). */
export const contributionSegments = (relative) => relative.replace(/\.tsx?$/, '').split(/[\\/.]/);

/**
 * Where each built-in kind lives. UI kinds live under `ui/`; their old root folders are still
 * read with a migration warning. Legacy filename suffixes (`x.action.ts`) are accepted the same way.
 */
export const contributionKinds = {
  actions: { folder: 'actions', suffixes: ['form-action', 'dialog-action', 'action'] },
  services: { folder: 'services', suffixes: ['service'] },
  interceptors: { folder: 'interceptors', suffixes: ['interceptor'] },
  installers: { folder: 'installers', suffixes: [] },
  configs: { folder: 'configs', suffixes: [] },
  slotDefinitions: { folder: 'slots', suffixes: [] },
  pages: { folder: 'ui/pages', legacy: 'pages', suffixes: ['page'] },
  slots: { folder: 'ui/slots', legacy: 'views', suffixes: ['view'] },
  providers: { folder: 'ui/providers', legacy: 'providers', suffixes: ['provider'] },
};
export const builtInKindNames = Object.keys(contributionKinds);
/** The built-in kinds a module's `server/` folder holds; everything else under `server/` is its own code. */
export const serverKindNames = ['actions', 'services', 'interceptors', 'installers'];
/**
 * Where an integration kind's files run: `client` (the default) in `contributions/<dir>`,
 * `server` in `server/contributions/<dir>` (only in the server file), `both` in
 * `contributions/<dir>` (in both files).
 */
export const kindRuntimes = ['client', 'server', 'both'];

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
    const runtime = kind.runtime ?? 'client';
    if (!kindRuntimes.includes(runtime))
      throw new Error(
        `Contribution kind "${name}" has runtime ${JSON.stringify(kind.runtime)}; use "client", "server" or "both".`,
      );
    return Object.freeze({ name, directory: folder, from, normalize, types: kind.types, runtime });
  });
}

/** Package kinds and `kinds` of bitakit.config.ts, validated; the config wins by name. */
export const mergedKindSpecs = (installed, configured) =>
  contributionKindSpecs([
    ...new Map(
      [...contributionKindSpecs(installed), ...contributionKindSpecs(configured)].map((kind) => [
        kind.name,
        kind,
      ]),
    ).values(),
  ]);

function hasDefaultExport(syntax) {
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
 *
 * `side: 'client'` (the default) never reads `server/`. `side: 'server'` reads only `server/`:
 * after its leading segment the same rules apply to `actions`, `services`, `interceptors` and
 * `contributions/<dir>` of server kinds, without legacy folders or suffixes; every other file
 * there is the module's own code and is skipped silently. A file of an integration kind on the
 * wrong side (a server kind in `contributions/<dir>`, a client or both kind in
 * `server/contributions/<dir>`) is an error naming the path it belongs at. So is a contribution
 * (a file with a default export) of a server kind in the old root folder `<dir>/`, which the
 * client side still reads for the other kinds; other files there get the usual warning.
 */
export async function discoverEntries(
  base,
  paths,
  kind,
  { directory, explicitFile, relativeTo = base, legacy = true, side = 'client' } = {},
) {
  const extension = typeof kind === 'object' && kind !== null;
  const spec = extension ? null : contributionKinds[kind];
  if (!extension && !spec) throw new Error(`Unknown contribution kind: ${kind}`);
  const server = side === 'server';
  if (server && !extension && !serverKindNames.includes(kind))
    throw new Error(`Kind "${kind}" has no server folder (${serverKindNames.join(', ')} do).`);
  const label = extension ? kind.name : kind;
  const suffixes = extension || server ? [] : spec.suffixes;
  const runtime = extension ? (kind.runtime ?? 'client') : undefined;
  // This side holds no files of the kind; any it finds belong to the other side.
  const misplaced = extension && (server ? runtime !== 'server' : runtime === 'server');
  const roots = extension
    ? [
        { folder: `contributions/${kind.directory}`.split('/'), legacy: false },
        // A server kind's old root folder is read too, so switching a kind's runtime loses no file.
        ...(server
          ? []
          : [{ folder: kind.directory.split('/'), legacy: `contributions/${kind.directory}/` }]),
      ]
    : [
        { folder: spec.folder.split('/'), legacy: false },
        ...(spec.legacy && legacy && !server
          ? [{ folder: spec.legacy.split('/'), legacy: `${spec.folder}/` }]
          : []),
      ];
  const entries = [];
  const warnings = [];
  const seen = new Map();
  for (const file of paths) {
    if (!/\.tsx?$/.test(file) || /\.d\.ts$/.test(file)) continue;
    const relative = path.relative(base, file).split(path.sep).join('/');
    if (!directory && !explicitFile && (relative.startsWith('..') || path.isAbsolute(relative)))
      continue;
    let segments = contributionSegments(relative);
    if (segments.some((segment) => segment.startsWith('-'))) continue;
    // Server files never reach the client bundle; the server side reads only them.
    if ((segments[0] === 'server') !== server) continue;
    if (server) segments = segments.slice(1);
    let legacyLocation = false;
    if (explicitFile === file) segments = [path.basename(file).replace(/\.tsx?$/, '')];
    else if (directory && !server) {
      const local = path.relative(directory, file);
      if (local.startsWith('..') || path.isAbsolute(local)) continue;
      segments = contributionSegments(local);
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
    const sourceText = await readFile(file, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    // An editor can remove a file between directory traversal and parsing.
    if (sourceText === null) continue;
    const shown = path.relative(relativeTo, file).split(path.sep).join('/');
    const syntax = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
    // The old root folder may hold unrelated code; only a contribution there is misplaced.
    if (misplaced && (!legacyLocation || hasDefaultExport(syntax))) {
      // `server/` and `server.` have the same length: drop or add the leading segment. The old
      // root folder `<dir>/` names the kind's folder itself, so `contributions/` goes before it.
      const target = server
        ? relative.slice('server/'.length)
        : `server/${legacyLocation ? 'contributions/' : ''}${relative}`;
      const shownTarget = path
        .relative(relativeTo, path.join(base, target))
        .split(path.sep)
        .join('/');
      const where =
        runtime === 'server'
          ? 'is server-only, so its files live under server/'
          : `runs ${runtime === 'both' ? 'on both sides' : 'in the browser'}, so its files live in contributions/`;
      throw new Error(
        `${shown} belongs to the contribution kind "${label}", which ${where}: move it to ${shownTarget}.`,
      );
    }
    if (!hasDefaultExport(syntax)) {
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
    const entry = { file, path: segments, source: relative };
    // describeDefinitions reuses this parse for the static field rules.
    sourceTrees.set(entry, syntax);
    entries.push(entry);
  }
  return { entries, warnings };
}
