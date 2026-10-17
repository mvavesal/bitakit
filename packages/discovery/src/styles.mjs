import { readFile, stat, readdir } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import values from 'postcss-value-parser';
import selectors from 'postcss-selector-parser';
import enhancedResolve from 'enhanced-resolve';
import ts from 'typescript';
import { isBuiltin } from 'node:module';

export const styleLayers = 'theme, base, components, utilities';
export const stylePrelude = `@layer ${styleLayers};`;
const resolveStyle = enhancedResolve.create.sync({
  fileSystem: fs,
  extensions: ['.css'],
  conditionNames: ['style', 'import', 'default'],
  mainFields: ['style', 'main'],
});

/** Parse imports rather than matching comments, strings or commented-out configuration. */
export function cssImports(css, from) {
  const imports = [];
  postcss.parse(css, { from }).walkAtRules('import', (rule) => {
    const first = values(rule.params).nodes.find((node) => node.type !== 'space');
    const value =
      first?.type === 'function' && first.value === 'url'
        ? first.nodes.find((node) => node.type !== 'space')?.value
        : first?.value;
    if (value) imports.push({ value, rule });
  });
  return imports;
}

// Bundlers such as Turbopack resolve CSS imports without the "style" export condition.
const resolveWithoutStyle = enhancedResolve.create.sync({
  fileSystem: fs,
  extensions: ['.js', '.mjs', '.cjs', '.css'],
  conditionNames: ['import', 'require', 'default'],
  mainFields: ['module', 'main'],
});
const isBare = (specifier) => !/^(?:\.|\/|[a-z][a-z0-9+.-]*:)/i.test(specifier);
/**
 * True when a bare stylesheet import has no entry at all outside the "style" condition (such as
 * tw-animate-css). A package that also exports JavaScript (such as @heroui/styles) is left alone:
 * an alias would apply to its script imports as well.
 */
function needsStyleCondition(specifier, from) {
  try {
    resolveWithoutStyle(path.dirname(from), specifier);
    return false;
  } catch {
    return true;
  }
}

export function resolveStylesheet(specifier, from) {
  const file = resolveStyle(path.dirname(from), specifier);
  if (!file || !file.endsWith('.css'))
    throw new Error(`Cannot resolve stylesheet "${specifier}" from ${from}.`);
  return file;
}

/**
 * Installed styles are eager; lazy plugin code cannot establish a competing CSS entry.
 * `aliases`, when given, receives each bare package import (other than Tailwind, which the root
 * imports) that resolves only with the "style" condition, mapped to its stylesheet, so a bundler
 * without that condition can be given the file directly.
 */
export async function validatePackageStyles(packages, { aliases } = {}) {
  const visited = new Set();
  const sources = new Set();
  const known = new Map(packages.map((entry) => [entry.name, entry]));
  async function ownerOf(file) {
    for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
      try {
        const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
        return { name: manifest.name, root: dir };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      if (dir === path.dirname(dir)) return {};
    }
  }
  async function inspect(file, kind, origin) {
    const key = `${kind}:${file}`;
    if (visited.has(key)) return;
    visited.add(key);
    sources.add(file);
    const css = await readFile(file, 'utf8');
    const ast = postcss.parse(css, { from: file });
    const owner = await ownerOf(file);
    // These standard upstream styles provide the existing baseline. They are still
    // resolved and parsed; ordinary plugin files do not inherit this exception.
    const baseline = ['tailwindcss', '@heroui/styles', 'tw-animate-css'].includes(owner.name);
    const declared = known.get(owner.name);
    const themeFiles = declared?.themeFiles ?? [];
    const theme = kind === 'theme' || themeFiles.includes(file);
    const fail = (node, reason) => {
      throw node.error(`[BitaKit CSS: ${origin}] ${reason}`, { plugin: 'bitakit' });
    };
    ast.walkAtRules((rule) => {
      if (baseline || theme) return;
      if (rule.name === 'layer') {
        if (!rule.nodes && rule.params.replace(/\s/g, '') !== styleLayers.replace(/\s/g, ''))
          fail(
            rule,
            `Do not establish layer order in a plugin. Declare styles in package.json; the root owns ${styleLayers}.`,
          );
        if (rule.nodes && /(^|[,.\s])(base|theme)([,.\s]|$)/.test(rule.params))
          fail(
            rule,
            'Base resets and theme layers belong to the baseline/theme entry, not component styles.',
          );
      }
      if (rule.name === 'theme')
        fail(rule, 'Declare shared theme contributions with bitakit.theme, not bitakit.styles.');
    });
    ast.walkRules((rule) => {
      if (
        baseline ||
        theme ||
        (rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name))
      )
        return;
      let global = false;
      selectors((root) =>
        root.each((selector) => {
          let scoped = false;
          selector.walk((node) => {
            if (
              (node.type === 'class' && !['dark', 'light'].includes(node.value)) ||
              node.type === 'id' ||
              (node.type === 'attribute' &&
                !['data-theme', 'data-theme-preset'].includes(node.attribute))
            )
              scoped = true;
          });
          if (!scoped) global = true;
          selector.walkPseudos((node) => {
            if ([':root', ':host'].includes(node.value)) global = true;
          });
        }),
      ).processSync(rule.selector);
      if (global)
        fail(
          rule,
          'Global resets/selectors and shared tokens belong to an explicit theme entry. Scope component styles to the component.',
        );
    });
    for (const { value, rule } of cssImports(css, file)) {
      if (/^(?:https?:|data:|\/\/)/.test(value))
        fail(
          rule,
          'Remote CSS is outside the validated package graph. Ship a declared local stylesheet.',
        );
      const dependency = resolveStylesheet(value, file);
      if (
        aliases &&
        !aliases.has(value) &&
        isBare(value) &&
        !/^tailwindcss(?:\/|$)/.test(value) &&
        needsStyleCondition(value, file)
      )
        aliases.set(value, dependency);
      // Importing Tailwind a second time is only a baseline library's responsibility.
      if (!baseline && !theme && /^tailwindcss(?:\/|$)/.test(value))
        fail(
          rule,
          'Plugins must not import another Tailwind reset. The application root imports Tailwind once.',
        );
      await inspect(dependency, theme ? 'theme' : 'styles', origin);
    }
  }
  for (const entry of packages) {
    entry.themeFiles = entry.theme.map((specifier) =>
      resolveStylesheet(specifier, entry.manifestFile),
    );
  }
  for (const entry of packages) {
    for (const specifier of entry.styles)
      await inspect(resolveStylesheet(specifier, entry.manifestFile), 'styles', entry.name);
    for (const file of entry.themeFiles) await inspect(file, 'theme', entry.name);
    sources.add(entry.manifestFile);
  }
  for (const entry of packages) await validateScriptStyles(entry, sources);
  return [...sources];
}

const scriptResolver = (kind) =>
  enhancedResolve.create.sync({
    fileSystem: fs,
    extensions: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.css'],
    conditionNames: ['browser', kind, 'default'],
    mainFields: ['browser', 'module', 'main'],
  });

const scriptResolvers = { import: scriptResolver('import'), require: scriptResolver('require') };

/** Audit literal runtime imports, including external vendor dependencies. */
async function validateScriptStyles(entry, sources) {
  const seen = new Set();
  const root = path.dirname(entry.manifestFile);
  const candidates = (value) =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.entries(value)
            .filter(([key]) => key !== 'types')
            .flatMap(([, v]) => candidates(v))
        : [];
  async function inspect(file) {
    if (seen.has(file) || !/\.[cm]?[jt]sx?$/.test(file) || file.endsWith('.d.ts')) return;
    seen.add(file);
    sources.add(file);
    const code = await readFile(file, 'utf8');
    const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const imports = [];
    const fail = (reason) => {
      throw new Error(`[BitaKit CSS: ${entry.name}] ${file}: ${reason}`);
    };
    function visit(node) {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        !node.isTypeOnly &&
        !node.importClause?.isTypeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      )
        imports.push({ specifier: node.moduleSpecifier.text, kind: 'import' });
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
      ) {
        if (!node.arguments[0] || !ts.isStringLiteralLike(node.arguments[0]))
          fail(
            'Computed runtime imports cannot be audited. Use literal import paths or explicit static imports.',
          );
        imports.push({
          specifier: node.arguments[0].text,
          kind: node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'import' : 'require',
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const { specifier, kind } of imports) {
      if (isBuiltin(specifier)) continue;
      let target;
      try {
        target = scriptResolvers[kind](path.dirname(file), specifier);
      } catch {
        let owner = path.dirname(file);
        let manifest;
        for (;;) {
          try {
            manifest = JSON.parse(await readFile(path.join(owner, 'package.json'), 'utf8'));
            break;
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          if (owner === path.dirname(owner)) break;
          owner = path.dirname(owner);
        }
        const name = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        if (
          manifest?.peerDependenciesMeta?.[name]?.optional ||
          manifest?.optionalDependencies?.[name]
        )
          continue;
        fail(
          `Cannot audit runtime import "${specifier}". Install the dependency and expose a resolvable literal entry.`,
        );
      }
      if (!target) continue; // Package browser map explicitly disables this dependency.
      if (target.endsWith('.css') && !file.startsWith(root + path.sep) && sources.has(target))
        continue; // Unmodified vendor baseline already validated in the eager root graph.
      if (target.endsWith('.css'))
        fail(
          `CSS import "${specifier}" bypasses the root. Declare it in bitakit.styles/theme and remove the JavaScript import.`,
        );
      await inspect(target);
    }
  }
  for (const value of candidates(entry.manifest.exports)) {
    if (!value.startsWith('./')) continue;
    if (value.includes('*')) {
      const pattern = new RegExp(
        '^' +
          value
            .slice(2)
            .split('*')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$',
      );
      const matched = (await readdir(root, { recursive: true })).filter((file) =>
        pattern.test(file),
      );
      if (!matched.length)
        throw new Error(
          `[BitaKit CSS: ${entry.name}] Wildcard export "${value}" matches no emitted runtime files. Build the package or publish explicit exports.`,
        );
      for (const file of matched) await inspect(path.resolve(root, file));
      continue;
    }
    const file = path.resolve(root, value);
    if (
      await stat(file).then(
        (info) => info.isFile(),
        () => false,
      )
    )
      await inspect(file);
  }
}
