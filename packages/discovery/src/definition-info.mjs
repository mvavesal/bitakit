import { readFile } from 'node:fs/promises';
import ts from 'typescript';

/** Static hints for tooling, never runtime registration. Unreadable expressions stay unresolved.
 * Uses TypeScript's parser for the same define* leaves and dotted/nested records Discovery emits.
 * `inspect(fields, { unwrap, literal, ts })` lets a tool read non-literal fields (arrays, schemas)
 * of each object-form definition with the same ID rules; its result is merged into the entry.
 * Callers classify the nodes with the passed `ts`: SyntaxKind numbers differ between versions.
 */
export async function describeDefinitions(
  entries,
  { helper, moduleId = '', properties = [], inspect },
) {
  const definitions = [];
  const unresolved = [];
  for (const entry of entries) {
    const tree = ts.createSourceFile(
      entry.file,
      await readFile(entry.file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const variables = new Map();
    const helpers = new Set([helper]);
    let exported;
    for (const statement of tree.statements) {
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (ts.isIdentifier(declaration.name))
            variables.set(declaration.name.text, declaration.initializer);
      if (
        ts.isImportDeclaration(statement) &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      )
        for (const binding of statement.importClause.namedBindings.elements)
          if ((binding.propertyName ?? binding.name).text === helper)
            helpers.add(binding.name.text);
      if (ts.isExportAssignment(statement)) exported = statement.expression;
      if (
        ts.isExportDeclaration(statement) &&
        !statement.moduleSpecifier &&
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      )
        for (const binding of statement.exportClause.elements)
          if (binding.name.text === 'default') exported = binding.propertyName ?? binding.name;
    }
    const unwrap = (node, seen = new Set()) => {
      if (!node) return;
      if (
        ts.isAsExpression(node) ||
        ts.isSatisfiesExpression(node) ||
        ts.isParenthesizedExpression(node)
      )
        return unwrap(node.expression, seen);
      if (!ts.isIdentifier(node)) return node;
      if (seen.has(node.text)) return;
      seen.add(node.text);
      return unwrap(variables.get(node.text), seen);
    };
    const literal = (node) => {
      const value = unwrap(node);
      return value && ts.isStringLiteralLike(value) ? value.text : undefined;
    };
    const unknown = () => {
      if (!unresolved.includes(entry.file)) unresolved.push(entry.file);
    };
    const visit = (expression, path, trail = new Set()) => {
      const node = unwrap(expression);
      if (!node || trail.has(node)) return unknown();
      const next = new Set([...trail, node]);
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        helpers.has(node.expression.text)
      ) {
        const options = unwrap(node.arguments[0]);
        // A helper called with a factory (`defineService(() => ...)`) has no literal fields;
        // its ID comes from the file path alone.
        const fields = new Map();
        if (!options || !ts.isObjectLiteralExpression(options)) {
          if (!options || !ts.isFunctionLike(options)) return unknown();
          const id = [moduleId, path].filter(Boolean).join('.');
          if (!id) return unknown();
          definitions.push({ id, file: entry.file });
          return;
        }
        for (const item of options.properties) {
          // Methods (`execute() {}`) are ordinary fields without a literal value.
          const method = ts.isMethodDeclaration(item) || ts.isAccessor(item);
          if (!method && !ts.isPropertyAssignment(item) && !ts.isShorthandPropertyAssignment(item))
            return unknown();
          if (ts.isComputedPropertyName(item.name)) return unknown();
          fields.set(
            item.name.text,
            method ? item : ts.isPropertyAssignment(item) ? item.initializer : item.name,
          );
        }
        const id = fields.has('id')
          ? literal(fields.get('id'))
          : [moduleId, path].filter(Boolean).join('.');
        if (!id) return unknown();
        const info = { id, file: entry.file };
        for (const property of properties) {
          if (!fields.has(property)) continue;
          const value = literal(fields.get(property));
          if (value === undefined) unknown();
          else info[property] = value;
        }
        if (inspect) Object.assign(info, inspect(fields, { unwrap, literal, ts }));
        definitions.push(info);
        return;
      }
      if (ts.isArrayLiteralExpression(node)) {
        // File exports are leaves or records; explicit-ID arrays belong to manual composition.
        return unknown();
      }
      if (!ts.isObjectLiteralExpression(node)) return unknown();
      for (const item of node.properties) {
        if (
          (!ts.isPropertyAssignment(item) && !ts.isShorthandPropertyAssignment(item)) ||
          ts.isComputedPropertyName(item.name)
        ) {
          unknown();
          continue;
        }
        visit(
          ts.isPropertyAssignment(item) ? item.initializer : item.name,
          [path, item.name.text].filter(Boolean).join('.'),
          next,
        );
      }
    };
    visit(exported, Array.isArray(entry.path) ? entry.path.join('.') : entry.path);
  }
  return { definitions, unresolved };
}
