import path from 'node:path';
import ts from 'typescript';

const options = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmit: true,
  skipLibCheck: true,
  types: [],
};

/**
 * The names a package entry exports, read from its installed type declarations as TypeScript
 * resolves them from `root`. Returns `undefined` when the entry cannot be resolved (for example
 * when the package is not installed), so callers can report instead of guessing.
 */
export function exportedNames(root, specifier) {
  const from = path.join(root, 'index.ts');
  const resolved = ts.resolveModuleName(specifier, from, options, ts.sys).resolvedModule;
  if (!resolved) return undefined;
  const program = ts.createProgram([resolved.resolvedFileName], options);
  const file = program.getSourceFile(resolved.resolvedFileName);
  const checker = program.getTypeChecker();
  const symbol = file && checker.getSymbolAtLocation(file);
  if (!symbol) return undefined;
  return new Set(checker.getExportsOfModule(symbol).map((item) => item.name));
}

/** `@bitakit/ui` entries that re-exported all of Core before 0.2. */
const uiEntries = new Set(['@bitakit/ui', '@bitakit/ui/actions']);

/** True when the file has a named import from an entry that used to re-export Core. */
export const importsFromUi = (source) => /from\s+['"]@bitakit\/ui(?:\/actions)?['"]/.test(source);

/**
 * Moves Core names out of `@bitakit/ui` imports: 0.2 `@bitakit/ui` exports only React bindings.
 * A specifier moves when Core exports it and the UI entry does not; everything else stays.
 * `core` and `ui` map an entry to its exported names (see `exportedNames`).
 */
export function moveCoreImports(source, { core, ui, tsx = false }) {
  const file = ts.createSourceFile(
    'file.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edits = [];
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !uiEntries.has(statement.moduleSpecifier.text)
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings) || statement.importClause.name) continue;
    const entry = statement.moduleSpecifier.text;
    const exported = ui.get(entry);
    const moves = (element) => {
      const name = (element.propertyName ?? element.name).text;
      return core.has(name) && !exported?.has(name);
    };
    const moved = bindings.elements.filter(moves);
    if (!moved.length) continue;
    const kept = bindings.elements.filter((element) => !moves(element));
    const quote = source[statement.moduleSpecifier.getStart(file)];
    const typeOnly = statement.importClause.isTypeOnly ? 'type ' : '';
    const list = (elements) => elements.map((element) => element.getText(file)).join(', ');
    const coreImport = `import ${typeOnly}{ ${list(moved)} } from ${quote}@bitakit/core${quote};`;
    edits.push({
      start: statement.getStart(file),
      end: statement.end,
      text: kept.length
        ? `import ${typeOnly}{ ${list(kept)} } from ${quote}${entry}${quote};\n${coreImport}`
        : coreImport,
    });
  }
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
}
