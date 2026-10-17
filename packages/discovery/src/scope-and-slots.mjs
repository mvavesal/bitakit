import ts from 'typescript';

const contributionKeys = new Set(['component', 'data', 'actionId']);
const runtimeHelpers = new Set(['definePlugin', 'createRuntime', 'createRuntimeController']);

const propertyName = (property, tree) =>
  property.name ? property.name.getText(tree).replace(/^['"]|['"]$/g, '') : undefined;
const isFunction = (node) =>
  !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node));

/**
 * Rewrites the 0.2 API spellings in one TypeScript/TSX source on its syntax tree:
 * - a BitaKit `setup` function's `{ app }` parameter becomes `{ scope: app }`, so its body keeps
 *   working (setup in `definePlugin`/`createRuntime` options or plugin objects with an `id`,
 *   functions typed `Setup`, and the default export of a `setup.ts`);
 * - `name` becomes `slot` on the direct object elements of a `defineAction` `slots` array;
 * - `….slots.attach(name, { component | data | actionId, … })` becomes
 *   `….slots.attach({ slot: name, … })`.
 * Returns the code and the lines of old-form calls it could not rewrite safely.
 */
export function rewriteScopeAndSlots(source, { setupFile = false, tsx = true } = {}) {
  const tree = ts.createSourceFile(
    tsx ? 'source.tsx' : 'source.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    tsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const edits = [];
  const unresolved = [];
  const line = (node) => tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;

  const aliasApp = (fn) => {
    const parameter = fn?.parameters?.[0]?.name;
    if (!parameter || !ts.isObjectBindingPattern(parameter)) return;
    for (const element of parameter.elements)
      if (!element.propertyName && ts.isIdentifier(element.name) && element.name.text === 'app')
        edits.push({ start: element.name.getStart(tree), end: element.name.getEnd(), text: 'scope: app' });
  };
  const setupOf = (object) => {
    for (const property of object.properties) {
      if (propertyName(property, tree) !== 'setup') continue;
      if (ts.isMethodDeclaration(property)) aliasApp(property);
      else if (ts.isPropertyAssignment(property) && isFunction(property.initializer))
        aliasApp(property.initializer);
    }
  };
  const callee = (node) => (ts.isIdentifier(node.expression) ? node.expression.text : undefined);

  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const parent = node.parent;
      const isRuntimeOptions =
        ts.isCallExpression(parent) && runtimeHelpers.has(callee(parent)) && parent.arguments[0] === node;
      const isPluginObject = node.properties.some((property) => propertyName(property, tree) === 'id');
      if (isRuntimeOptions || isPluginObject) setupOf(node);
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.type &&
      ts.isTypeReferenceNode(node.type) &&
      node.type.typeName.getText(tree) === 'Setup' &&
      isFunction(node.initializer)
    )
      aliasApp(node.initializer);
    if (setupFile && ts.isExportAssignment(node) && !node.isExportEquals && isFunction(node.expression))
      aliasApp(node.expression);
    if (
      setupFile &&
      ts.isFunctionDeclaration(node) &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
    )
      aliasApp(node);

    // Placements: direct object elements of a defineAction `slots` array.
    if (ts.isCallExpression(node) && callee(node) === 'defineAction') {
      const options = node.arguments[0];
      const slots =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.find((property) => propertyName(property, tree) === 'slots')
          : undefined;
      if (slots && ts.isPropertyAssignment(slots) && ts.isArrayLiteralExpression(slots.initializer))
        for (const element of slots.initializer.elements) {
          if (!ts.isObjectLiteralExpression(element)) continue;
          if (element.properties.some((property) => propertyName(property, tree) === 'slot')) continue;
          for (const property of element.properties)
            if (propertyName(property, tree) === 'name') {
              if (ts.isShorthandPropertyAssignment(property))
                edits.push({ start: property.getStart(tree), end: property.getEnd(), text: 'slot: name' });
              else if (ts.isPropertyAssignment(property))
                edits.push({ start: property.name.getStart(tree), end: property.name.getEnd(), text: 'slot' });
            }
        }
    }

    // attach(name, contribution) -> attach({ slot: name, ...contribution }).
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'attach' &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'slots' &&
      node.arguments.length >= 2
    ) {
      const [target, contribution] = node.arguments;
      const isContribution =
        ts.isObjectLiteralExpression(contribution) &&
        contribution.properties.some((property) => contributionKeys.has(propertyName(property, tree)));
      if (isContribution) {
        const text = contribution.getText(tree);
        const inner = text.slice(1, -1);
        const name = target.getText(tree);
        const merged = /^\s*\n/.test(inner)
          ? `{\n${/\n([ \t]*)\S/.exec(inner)?.[1] ?? '  '}slot: ${name},${inner}}`
          : inner.trim()
            ? `{ slot: ${name}, ${inner.trim()} }`
            : `{ slot: ${name} }`;
        edits.push({ start: target.getStart(tree), end: contribution.getEnd(), text: merged });
      } else if (ts.isStringLiteralLike(target)) unresolved.push(line(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);

  let code = source;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return { code, unresolved };
}
