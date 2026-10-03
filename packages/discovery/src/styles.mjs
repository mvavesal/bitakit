import { readFile, stat } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import values from 'postcss-value-parser';
import selectors from 'postcss-selector-parser';
import enhancedResolve from 'enhanced-resolve';
import ts from 'typescript';

export const styleLayers = 'theme, base, components, utilities';
export const stylePrelude = `@layer ${styleLayers};`;
const resolveStyle = enhancedResolve.create.sync({
  fileSystem: fs, extensions: ['.css'], conditionNames: ['style', 'import', 'default'],
  mainFields: ['style', 'main'],
});

/** Parse imports rather than matching comments, strings or commented-out configuration. */
export function cssImports(css, from) {
  const imports = [];
  postcss.parse(css, { from }).walkAtRules('import', (rule) => {
    const first = values(rule.params).nodes.find((node) => node.type !== 'space');
    const value = first?.type === 'function' && first.value === 'url'
      ? first.nodes.find((node) => node.type !== 'space')?.value : first?.value;
    if (value) imports.push({ value, rule });
  });
  return imports;
}

export function resolveStylesheet(specifier, from) {
  const file = resolveStyle(path.dirname(from), specifier);
  if (!file || !file.endsWith('.css')) throw new Error(`Cannot resolve stylesheet "${specifier}" from ${from}.`);
  return file;
}

/** Installed styles are eager; lazy plugin code cannot establish a competing CSS entry. */
export async function validatePackageStyles(packages) {
  const visited = new Set();
  const sources = new Set();
  const known = new Map(packages.map((entry) => [entry.name, entry]));
  async function ownerOf(file) {
    for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
      try {
        const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
        return { name: manifest.name, root: dir };
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
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
    const fail = (node, reason) => { throw node.error(`[BitaKit CSS: ${origin}] ${reason}`, { plugin: 'bitakit' }); };
    ast.walkAtRules((rule) => {
      if (baseline || theme) return;
      if (rule.name === 'layer') {
        if (!rule.nodes && rule.params.replace(/\s/g, '') !== styleLayers.replace(/\s/g, ''))
          fail(rule, `Do not establish layer order in a plugin. Declare styles in package.json; the root owns ${styleLayers}.`);
        if (rule.nodes && /(^|[,.\s])(base|theme)([,.\s]|$)/.test(rule.params))
          fail(rule, 'Base resets and theme layers belong to the baseline/theme entry, not component styles.');
      }
      if (rule.name === 'theme') fail(rule, 'Declare shared theme contributions with bitakit.theme, not bitakit.styles.');
    });
    ast.walkRules((rule) => {
      if (baseline || theme || rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
      let global = false;
      selectors((root) => root.each((selector) => {
        let scoped = false;
        selector.walk((node) => {
          if (node.type === 'class' && !['dark', 'light'].includes(node.value) || node.type === 'id' ||
            node.type === 'attribute' && !['data-theme', 'data-theme-preset'].includes(node.attribute)) scoped = true;
        });
        if (!scoped) global = true;
        selector.walkPseudos((node) => { if ([':root', ':host'].includes(node.value)) global = true; });
      })).processSync(rule.selector);
      if (global) fail(rule, 'Global resets/selectors and shared tokens belong to an explicit theme entry. Scope component styles to the component.');
    });
    for (const { value, rule } of cssImports(css, file)) {
      if (/^(?:https?:|data:|\/\/)/.test(value)) fail(rule, 'Remote CSS is outside the validated package graph. Ship a declared local stylesheet.');
      const dependency = resolveStylesheet(value, file);
      // Importing Tailwind a second time is only a baseline library's responsibility.
      if (!baseline && !theme && /^tailwindcss(?:\/|$)/.test(value))
        fail(rule, 'Plugins must not import another Tailwind reset. The application root imports Tailwind once.');
      await inspect(dependency, theme ? 'theme' : 'styles', origin);
    }
  }
  for (const entry of packages) {
    entry.themeFiles = entry.theme.map((specifier) => resolveStylesheet(specifier, entry.manifestFile));
  }
  for (const entry of packages) {
    for (const specifier of entry.styles) await inspect(resolveStylesheet(specifier, entry.manifestFile), 'styles', entry.name);
    for (const file of entry.themeFiles) await inspect(file, 'theme', entry.name);
    sources.add(entry.manifestFile);
    await validateScriptStyles(entry, sources);
  }
  return [...sources];
}

/** Follow package-owned static and literal dynamic imports, including emitted lazy chunks. */
async function validateScriptStyles(entry, sources) {
  const seen = new Set();
  const root = path.dirname(entry.manifestFile);
  const candidates = (value) => typeof value === 'string' ? [value]
    : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => key !== 'types').flatMap(([,v]) => candidates(v)) : [];
  async function inspect(file) {
    if (seen.has(file) || !/\.[cm]?[jt]sx?$/.test(file) || file.endsWith('.d.ts')) return;
    seen.add(file);
    sources.add(file);
    const code = await readFile(file, 'utf8');
    const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    const imports = [];
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require') && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) imports.push(node.arguments[0].text);
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const specifier of imports) {
      if (/\.css(?:[?#]|$)/.test(specifier) || specifier === '@heroui/styles')
        throw new Error(`[BitaKit CSS: ${entry.name}] ${file}: CSS import "${specifier}" bypasses the root. Declare it in bitakit.styles/theme and remove the JavaScript import.`);
      if (!specifier.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), specifier);
      for (const target of [base, `${base}.js`, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.js')]) {
        if (await stat(target).then((info) => info.isFile(), () => false)) { await inspect(target); break; }
      }
    }
  }
  for (const value of candidates(entry.manifest.exports)) {
    if (!value.startsWith('./') || value.includes('*')) continue;
    const file = path.resolve(root, value);
    if (await stat(file).then((info) => info.isFile(), () => false)) await inspect(file);
  }
}
