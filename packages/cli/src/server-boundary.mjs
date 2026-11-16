import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const sourceFile = /\.[cm]?[jt]sx?$/;
const declarationFile = /\.d\.[cm]?ts$/;
const generatedServer = /(?:^|[\\/])bitakit\.gen\.server(?:\.[cm]?[jt]sx?)?$/;
const serverEntry = /^@bitakit\/core\/server(?:\/|$)/;
const uiPackages = /^(?:react|react-dom|@bitakit\/ui)(?:\/|$)/;
/** Folders that hold no app source: dependencies and build output (dot folders are skipped too). */
const outside = new Set(['node_modules', 'dist', 'build', 'out', 'coverage']);
/** How many problems a result lists before it summarizes the rest. */
const shown = 20;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const found = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || outside.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(file)));
    else if (sourceFile.test(entry.name) && !declarationFile.test(entry.name)) found.push(file);
  }
  return found;
}

const parse = (file, code, parents = false) =>
  ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    parents,
    /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
const typeOnly = (elements) => elements.length > 0 && elements.every((item) => item.isTypeOnly);
const typeScriptFile = /\.[cm]?tsx?$/;

/** A property's name when it is written as an identifier or a string. */
const nameOf = (node) =>
  node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) ? node.text : undefined;

/** The identifier a call chain starts with: `createServerFn` in `createServerFn().handler(fn)`. */
function chainRoot(expression) {
  let current = expression;
  while (
    ts.isCallExpression(current) ||
    ts.isPropertyAccessExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  )
    current = current.expression;
  return ts.isIdentifier(current) ? current.text : undefined;
}

/** TanStack route factories whose options' `server` part Start keeps out of the browser. */
const routeFactories = new Set([
  'createFileRoute',
  'createRootRoute',
  'createRootRouteWithContext',
  'createRoute',
]);

/**
 * Whether `node` is code TanStack Start removes from the browser bundle: the `server` part of
 * route options (`createFileRoute('/x')({ server: { handlers } })`), the function of
 * `createServerFn(...).handler(fn)` and `createServerOnlyFn(fn)`, the `.server(fn)` of
 * `createIsomorphicFn()` and `createMiddleware()`, and the handlers of older Start releases'
 * `createServerFileRoute(...).methods(...)`.
 */
function inServerOnlyCode(node) {
  for (let current = node; current.parent; current = current.parent) {
    const parent = current.parent;
    if (
      ts.isPropertyAssignment(parent) &&
      parent.initializer === current &&
      nameOf(parent.name) === 'server' &&
      ts.isCallExpression(parent.parent.parent) &&
      parent.parent.parent.arguments[0] === parent.parent &&
      routeFactories.has(chainRoot(parent.parent.parent.expression))
    )
      return true;
    if (ts.isCallExpression(parent) && parent.arguments.includes(current)) {
      const callee = parent.expression;
      const method = ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
      const root = chainRoot(callee);
      if (
        (ts.isIdentifier(callee) && callee.text === 'createServerOnlyFn') ||
        (method === 'handler' && root === 'createServerFn') ||
        (method === 'methods' && root === 'createServerFileRoute') ||
        (method === 'server' && (root === 'createIsomorphicFn' || root === 'createMiddleware'))
      )
        return true;
    }
  }
  return false;
}

/** Whether an identifier sits in a type: an annotation, `typeof x` in a type, `implements`. */
function inType(node) {
  for (let current = node; current.parent; current = current.parent) {
    const parent = current.parent;
    if (ts.isExpressionWithTypeArguments(parent)) {
      const clause = parent.parent;
      // `class A extends B` needs B at run time; `implements` and interface `extends` do not.
      return !(
        ts.isHeritageClause(clause) &&
        clause.token === ts.SyntaxKind.ExtendsKeyword &&
        (ts.isClassDeclaration(clause.parent) || ts.isClassExpression(clause.parent))
      );
    }
    if (
      ts.isTypeNode(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent)
    )
      return true;
  }
  return false;
}

/** Whether an identifier refers to a binding, rather than naming a property or declaring one. */
function isReference(node) {
  const parent = node.parent;
  if (
    ((ts.isPropertyAccessExpression(parent) || ts.isQualifiedName(parent)) &&
      (parent.name ?? parent.right) === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isImportEqualsDeclaration(parent) ||
    ts.isLabeledStatement(parent) ||
    ts.isBreakOrContinueStatement(parent) ||
    ts.isMetaProperty(parent) ||
    (ts.isBindingElement(parent) && parent.propertyName === node)
  )
    return false;
  if (ts.isExportSpecifier(parent))
    // `export { a as b }` refers to the local a; `export { a } from 'x'` to nothing here.
    return !parent.parent.parent.moduleSpecifier && (parent.propertyName ?? parent.name) === node;
  return !(
    'name' in parent &&
    parent.name === node &&
    !ts.isShorthandPropertyAssignment(parent) &&
    !ts.isJsxOpeningLikeElement(parent)
  );
}

/** Whether a top-level statement is exported (`export const`, `export function`). */
const exported = (statement) =>
  statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/**
 * Which local import bindings the browser keeps. A binding counts when an identifier refers to
 * it outside a type position (`elide`: TypeScript, SWC and esbuild drop imports used only as
 * types unless `verbatimModuleSyntax` keeps them) and, with `serverOnly`, outside code TanStack
 * Start removes (see `inServerOnlyCode`); a reference inside a top-level declaration that is not
 * exported counts only while that declaration counts, as Start's dead-code elimination drops
 * declarations nothing else uses. Shadowing is ignored, so a local of the same name counts.
 */
function usedBindings(tree, names, { elide, serverOnly }) {
  const owners = new Map();
  if (serverOnly)
    for (const statement of tree.statements) {
      if (exported(statement)) continue;
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.initializer)
            owners.set(declaration.initializer, declaration.name.text);
        }
      else if (ts.isFunctionDeclaration(statement) && statement.name && statement.body)
        owners.set(statement.body, statement.name.text);
    }
  const local = new Set(owners.values());
  /** Each reference to an import or a local declaration: `{ name, owner }`. */
  const references = [];
  const visit = (node, owner) => {
    owner = owners.get(node) ?? owner;
    if (
      ts.isIdentifier(node) &&
      (names.has(node.text) || local.has(node.text)) &&
      isReference(node) &&
      !(elide && inType(node)) &&
      !(serverOnly && inServerOnlyCode(node))
    )
      references.push({ name: node.text, owner });
    ts.forEachChild(node, (child) => visit(child, owner));
  };
  visit(tree, undefined);
  const used = new Set();
  for (let changed = true; changed; ) {
    changed = false;
    for (const { name, owner } of references)
      if (!used.has(name) && (owner === undefined || used.has(owner))) {
        used.add(name);
        changed = true;
      }
  }
  return used;
}

/**
 * The modules a source file loads at run time: static imports and re-exports, `import x =
 * require()`, `import()` and `require()` with a literal specifier. Type-only imports and exports
 * (`import type`, `import { type A }`) are left out: they disappear from the browser bundle.
 * `elide` (TypeScript files without `verbatimModuleSyntax`) also leaves out a named, default or
 * namespace import none of whose bindings is used as a value, as the compiler drops it;
 * `serverOnly` (TanStack Start) one used only in code Start keeps on the server.
 */
export function valueImports(file, code, { elide = false, serverOnly = false } = {}) {
  elide &&= typeScriptFile.test(file);
  const tree = parse(file, code, elide || serverOnly);
  const found = [];
  const bindings = [];
  for (const statement of tree.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (
        clause?.isTypeOnly ||
        (clause &&
          !clause.name &&
          clause.namedBindings &&
          ts.isNamedImports(clause.namedBindings) &&
          typeOnly(clause.namedBindings.elements))
      )
        continue;
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const names = !clause
        ? []
        : [
            ...(clause.name ? [clause.name.text] : []),
            ...(clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)
              ? [clause.namedBindings.name.text]
              : (clause.namedBindings?.elements ?? [])
                  .filter((item) => !item.isTypeOnly)
                  .map((item) => item.name.text)),
          ];
      // A side-effect import (`import './x'`) always loads.
      if ((elide || serverOnly) && names.length)
        bindings.push({ specifier: statement.moduleSpecifier.text, names });
      else found.push(statement.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      if (
        statement.isTypeOnly ||
        (statement.exportClause &&
          ts.isNamedExports(statement.exportClause) &&
          typeOnly(statement.exportClause.elements))
      )
        continue;
      if (ts.isStringLiteral(statement.moduleSpecifier)) found.push(statement.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      ts.isStringLiteral(statement.moduleReference.expression)
    )
      found.push(statement.moduleReference.expression.text);
  }
  if (bindings.length) {
    const used = usedBindings(tree, new Set(bindings.flatMap((item) => item.names)), {
      elide,
      serverOnly,
    });
    for (const { specifier, names } of bindings)
      if (names.some((name) => used.has(name))) found.push(specifier);
  }
  if (/\b(?:import|require)\s*\(/.test(code)) {
    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
        node.arguments[0] &&
        ts.isStringLiteralLike(node.arguments[0]) &&
        !(serverOnly && inServerOnlyCode(node))
      )
        found.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  return found;
}

/** Whether a file starts with a directive such as `'use client'` or `'use server'`. */
function startsWith(directive, file, code) {
  if (!code.includes(directive)) return false;
  for (const statement of parse(file, code).statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression))
      return false;
    if (statement.expression.text === directive) return true;
  }
  return false;
}

/**
 * Resolves a specifier to a project file the way the app's compiler does: TypeScript's module
 * resolution with the app's tsconfig.json (relative paths, `paths` aliases, index files), then
 * `@/` → the app folder and relative paths as Doctor's provider check does. Packages and
 * declaration files resolve to undefined: they are not app code. `elide` tells whether the
 * compiler drops imports used only as types (no `verbatimModuleSyntax`).
 */
function createResolver(project) {
  const configFile = path.join(project.root, 'tsconfig.json');
  let options = {};
  if (ts.sys.fileExists(configFile)) {
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
    options = ts.parseJsonConfigFileContent(config ?? {}, ts.sys, project.root).options;
  }
  options = {
    ...options,
    allowJs: true,
    moduleResolution: options.moduleResolution ?? ts.ModuleResolutionKind.Bundler,
    module: options.module ?? ts.ModuleKind.ESNext,
  };
  // TypeScript, SWC and esbuild drop imports used only as types unless the app keeps them.
  const elide = !(
    options.verbatimModuleSyntax ||
    options.preserveValueImports ||
    options.importsNotUsedAsValues === ts.ImportsNotUsedAsValues.Preserve ||
    options.importsNotUsedAsValues === ts.ImportsNotUsedAsValues.Error
  );
  const cache = ts.createModuleResolutionCache(project.root, (name) => name, options);
  const probe = (base) =>
    [
      base,
      ...extensions.map((extension) => `${base}${extension}`),
      ...extensions.map((extension) => path.join(base, `index${extension}`)),
    ].find((candidate) => ts.sys.fileExists(candidate));
  // Real paths, so a file reached through a symlinked folder (macOS /var) matches server/ folders.
  const real = (file) => file && (ts.sys.realpath?.(path.resolve(file)) ?? path.resolve(file));
  const resolve = (specifier, from) => {
    const resolved = ts.resolveModuleName(specifier, from, options, ts.sys, cache).resolvedModule;
    if (resolved)
      return resolved.isExternalLibraryImport || declarationFile.test(resolved.resolvedFileName)
        ? undefined
        : real(resolved.resolvedFileName);
    const base = specifier.startsWith('@/')
      ? path.join(project.appDirectory, specifier.slice(2))
      : specifier.startsWith('.')
        ? path.resolve(path.dirname(from), specifier)
        : undefined;
    return real(base && probe(base));
  };
  return { resolve, elide };
}

/**
 * Doctor's server boundary, two rules:
 *
 * 1. Browser code never reaches server code. The walk starts at every file the generated client
 *    files import (`bitakit.gen.tsx`, `bitakit.gen.config.ts`; before the first generation, the
 *    client files discovery would import), every file with a `'use client'` directive and, in
 *    TanStack apps (no directive), every route file under `src/routes`. It follows value imports
 *    transitively (relative, `@/` and tsconfig `paths`), as the bundler would: type-only imports
 *    and, unless `verbatimModuleSyntax` keeps them, imports used only as types are skipped; in
 *    TanStack, so are imports used only in code Start keeps on the server (route `server`
 *    handlers, `createServerFn(...).handler`); in Next, a `'use server'` module is not followed,
 *    because the browser gets references to its functions, never its code. Reaching a file under
 *    any module's `server/` folder, `bitakit.gen.server` or `@bitakit/core/server` is an error.
 *    Files no client root reaches, such as route handlers, server components or a contribution
 *    only server code imports, are not checked.
 * 2. Server code renders nothing: a file under `server/` importing `react`, `react-dom`,
 *    `@bitakit/ui` or its own module's `ui/` folder is an error. Another module's `ui/` is not
 *    checked: it may hold plain helpers (KnightCMS keeps some there).
 */
export async function checkServerBoundary(project, description) {
  const root = description.root;
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');
  const appRoot = path.resolve(root, description.app.directory);
  const moduleRoots = [
    appRoot,
    ...description.plugins.map((plugin) => path.resolve(root, plugin.directory)),
  ];
  const serverFolders = moduleRoots.map((module) => path.join(module, 'server') + path.sep);
  const isServer = (file) => serverFolders.some((folder) => file.startsWith(folder));
  /** The `ui/` folder of the module whose `server/` holds `file` (the innermost, for child plugins). */
  const ownUi = (file) => {
    const module = moduleRoots
      .filter((item) => file.startsWith(path.join(item, 'server') + path.sep))
      .sort((a, b) => b.length - a.length)[0];
    return path.join(module, 'ui') + path.sep;
  };
  const framework = description.framework ?? project.framework;
  const { resolve, elide } = createResolver({ root, appDirectory: appRoot });
  // Only Start strips server code from routes; with TanStack Router alone, all of it is bundled.
  const imports = { elide, serverOnly: framework === 'tanstack' && Boolean(project.start) };
  const sources = new Map();
  const read = async (file) => {
    if (!sources.has(file)) sources.set(file, await readFile(file, 'utf8').catch(() => undefined));
    return sources.get(file);
  };

  const roots = new Set();
  for (const name of ['bitakit.gen.tsx', 'bitakit.gen.ts', 'bitakit.gen.config.ts']) {
    const file = path.join(appRoot, name);
    if (ts.sys.fileExists(file)) roots.add(file);
  }
  const clientKinds = [
    'actions',
    'services',
    'pages',
    'slots',
    'slotDefinitions',
    'providers',
    'configs',
    'interceptors',
    'events',
    'settings',
    'layouts',
  ];
  for (const module of [description.app, ...description.plugins.filter((item) => item.enabled)]) {
    for (const kind of clientKinds)
      for (const entry of module[kind] ?? []) roots.add(path.resolve(root, entry.file));
    if (module.settingsPage) roots.add(path.resolve(root, module.settingsPage));
  }
  const projectFiles = await walk(root);
  for (const file of projectFiles) {
    const code = await read(file);
    if (code !== undefined && startsWith('use client', file, code)) roots.add(file);
  }
  // TanStack has no directive: every route is browser code, except what Start strips from it.
  if (framework === 'tanstack') {
    const routes = path.join(root, 'src', 'routes');
    for (const file of projectFiles) {
      const route = path.relative(routes, file);
      // Files and folders starting with "-" are not routes (TanStack's ignore prefix).
      if (
        !route.startsWith('..') &&
        !path.isAbsolute(route) &&
        !route
          .replace(sourceFile, '')
          .split(/[\\/.]/)
          .some((token) => token.startsWith('-'))
      )
        roots.add(file);
    }
  }
  // Next gives the browser references to a 'use server' module's functions, never its code.
  const serverFunctionFiles = new Map();
  const serverFunctions = async (file) => {
    if (framework !== 'next' || !sourceFile.test(file)) return false;
    if (!serverFunctionFiles.has(file)) {
      const code = await read(file);
      serverFunctionFiles.set(file, code !== undefined && startsWith('use server', file, code));
    }
    return serverFunctionFiles.get(file);
  };

  const importer = new Map();
  const chain = (file) => {
    const files = [file];
    while (importer.has(files[0])) files.unshift(importer.get(files[0]));
    return files.map(relative).join(' → ');
  };
  const leaks = new Set();
  const queue = [...roots];
  const seen = new Set(queue);
  for (const file of queue) {
    if (isServer(file)) {
      leaks.add(`${chain(file)} is browser code inside a server/ folder.`);
      continue;
    }
    const code = await read(file);
    if (code === undefined || (await serverFunctions(file))) continue;
    for (const specifier of valueImports(file, code, imports)) {
      if (serverEntry.test(specifier)) {
        leaks.add(`${chain(file)} imports ${specifier}.`);
        continue;
      }
      const target = resolve(specifier, file);
      if (generatedServer.test(target ?? specifier)) {
        leaks.add(`${chain(file)} imports the generated server file (${specifier}).`);
        continue;
      }
      if (!target || seen.has(target) || (await serverFunctions(target))) continue;
      if (isServer(target)) {
        leaks.add(`${chain(file)} → ${relative(target)}`);
        continue;
      }
      if (!sourceFile.test(target)) continue;
      seen.add(target);
      importer.set(target, file);
      queue.push(target);
    }
  }

  const results = [
    leaks.size
      ? {
          status: 'error',
          title: 'Browser code imports server code',
          details: summarize([...leaks]),
          fix: 'Files under server/ (and @bitakit/core/server) never reach the browser. Move code both sides need out of server/, or keep it on the server and call it from the button with remote.<plugin>.<name>(). Type-only imports (import type) are fine.',
        }
      : {
          status: 'ok',
          title: `Browser code never imports server code (${seen.size} client file${seen.size === 1 ? '' : 's'} checked)`,
        },
  ];

  const serverFiles = projectFiles.filter(isServer);
  if (!serverFiles.length) return results;
  const rendering = new Set();
  for (const file of serverFiles) {
    const code = await read(file);
    if (code === undefined) continue;
    for (const specifier of valueImports(file, code)) {
      if (uiPackages.test(specifier)) {
        rendering.add(`${relative(file)} imports ${specifier}.`);
        continue;
      }
      const target = resolve(specifier, file);
      if (target?.startsWith(ownUi(file)))
        rendering.add(`${relative(file)} imports ${relative(target)}.`);
    }
  }
  results.push(
    rendering.size
      ? {
          status: 'error',
          title: 'Server code imports React or UI code',
          details: summarize([...rendering]),
          fix: 'Server Actions and services return data; the page under ui/ renders it. Move the React code to ui/ and call the operation from there through its button.',
        }
      : { status: 'ok', title: 'Server code imports no React or UI code' },
  );
  return results;
}

const summarize = (lines) =>
  lines.length > shown ? [...lines.slice(0, shown), `… and ${lines.length - shown} more.`] : lines;

/**
 * The project's source files that import the generated server file (`bitakit.gen.server`), such
 * as the RPC route: `{ file, code }`, the file relative to the root. Generated files are skipped.
 */
export async function generatedServerImporters(root) {
  const found = [];
  for (const file of await walk(root)) {
    if (/(?:^|[\\/])bitakit\.gen\./.test(file)) continue;
    const code = await readFile(file, 'utf8').catch(() => undefined);
    if (
      code?.includes('bitakit.gen.server') &&
      valueImports(file, code).some((specifier) => generatedServer.test(specifier))
    )
      found.push({ file: path.relative(root, file).split(path.sep).join('/'), code });
  }
  return found;
}
