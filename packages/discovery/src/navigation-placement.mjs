import ts from 'typescript';

/** An explicitly chosen migration target; never infer slot placement from logical grouping. */
export function navigationPlacement(source, target) {
  const tree = ts.createSourceFile(
    'actions.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const helpers = new Set();
  for (const statement of tree.statements)
    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === '@bitakit/core') {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const entry of bindings.elements)
          if ((entry.propertyName?.text ?? entry.name.text) === 'defineAction')
            helpers.add(entry.name.text);
    }
  const edits = [],
    missing = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      helpers.has(node.expression.text)
    ) {
      const object = node.arguments[0];
      if (object && ts.isObjectLiteralExpression(object)) {
        const property = (name) =>
          object.properties.find(
            (entry) =>
              ts.isPropertyAssignment(entry) &&
              entry.name.getText(tree).replace(/['"]/g, '') === name,
          );
        const groups = property('groups')?.initializer;
        if (
          !property('slots') &&
          groups &&
          ts.isArrayLiteralExpression(groups) &&
          groups.elements.some(
            (entry) => ts.isStringLiteralLike(entry) && entry.text === 'navigation',
          )
        ) {
          const line = tree.getLineAndCharacterOfPosition(object.getStart(tree)).line + 1;
          const safe = !object.properties.some(ts.isSpreadAssignment);
          missing.push({ line, safe });
          if (target && safe)
            edits.push({
              at: object.getStart(tree) + 1,
              text: ` slots: [${JSON.stringify(target)}],`,
            });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  let code = source;
  for (const edit of edits.sort((a, b) => b.at - a.at))
    code = code.slice(0, edit.at) + edit.text + code.slice(edit.at);
  return { code, changed: edits.length, missing };
}
