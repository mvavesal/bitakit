import { navigationPlacement } from './navigation-placement.mjs';
import { rewriteScopeAndSlots } from './scope-and-slots.mjs';
import { exportedNames, importsFromUi, moveCoreImports } from './core-imports.mjs';
import { readFile, writeFile, rename, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import { files, mergedKindSpecs } from './entries.mjs';
import { pluginManifests } from './modules.mjs';
import { loadDiscoveryConfig } from './generate.mjs';
import { installedContributions } from './packages.mjs';

const suffixes = {
  actions: ['form-action', 'dialog-action', 'action'],
  services: ['service'],
  interceptors: ['interceptor'],
  configs: [],
  pages: ['page'],
  views: ['view'],
  providers: ['provider'],
};
const legacyFolders = { pages: 'ui/pages', views: 'ui/slots', providers: 'ui/providers' };

/** 0.2 renames of the public Foundation* names; word-bounded, so longer names are not touched. */
export const renamed = {
  FoundationApp: 'BitaKitApp',
  FoundationActions: 'BitaKitActions',
  FoundationConfig: 'BitaKitRuntimeConfig',
  FoundationEvent: 'BitaKitEvent',
  FoundationOverrides: 'BitaKitOverrides',
  FoundationRuntime: 'BitaKitRuntime',
  FoundationServiceError: 'BitaKitServiceError',
  FoundationStartupError: 'BitaKitStartupError',
  isFoundationStartupError: 'isBitaKitStartupError',
  resolveFoundationConfig: 'resolveBitaKitConfig',
  createFoundationApp: 'createBitaKitApp',
  renderWithFoundation: 'renderWithBitaKit',
  RenderWithFoundationOptions: 'RenderWithBitaKitOptions',
  RenderedFoundation: 'RenderedBitaKit',
  FoundationProvider: 'BitaKitRuntimeProvider',
  FoundationProviderProps: 'BitaKitRuntimeProviderProps',
  StandardFoundationProvider: 'StandardBitaKitRuntimeProvider',
  StandardFoundationProviderProps: 'StandardBitaKitRuntimeProviderProps',
  NextFoundationProviderProps: 'NextBitaKitRuntimeProviderProps',
  TanStackFoundationProviderProps: 'TanStackBitaKitRuntimeProviderProps',
  FoundationContext: 'BitaKitContext',
  useFoundation: 'useBitaKit',
  useOptionalFoundation: 'useOptionalBitaKit',
  useFoundationApp: 'useBitaKitApp',
  useFoundationReady: 'useBitaKitReady',
  useFoundationNavigation: 'useBitaKitNavigation',
  FoundationUI: 'BitaKitUI',
  FoundationLabels: 'BitaKitLabels',
  FoundationLink: 'BitaKitLink',
  standardFoundationUI: 'standardBitaKitUI',
  generateFoundation: 'generateBitaKit',
  // A deprecated alias of generateFoundation; 0.2 has only generateBitaKit.
  generateFoundationHost: 'generateBitaKit',
  watchFoundation: 'watchBitaKit',
  describeFoundation: 'describeBitaKit',
  FoundationDescription: 'BitaKitDescription',
  defineFoundation: 'defineBitaKit',
  withFoundation: 'withBitaKit',
};
const renamedPattern = new RegExp(`\\b(${Object.keys(renamed).join('|')})\\b`, 'g');

const tanstackConfigImport = /import \{([^}]*)\} from (['"])@bitakit\/tanstack\/config\2/;

/**
 * Applies the 0.2 name table, plus TanStack's `foundation()` Vite plugin when it is imported:
 * only the imported binding and its calls change, never the word in comments or strings.
 */
export function rewriteRenamedNames(source) {
  let text = source.replace(renamedPattern, (name) => renamed[name]);
  const names = tanstackConfigImport.exec(text)?.[1];
  if (names && /\bfoundation\b/.test(names)) {
    text = text.replace(tanstackConfigImport, (whole) =>
      whole.replace(names, names.replace(/\bfoundation\b/, 'bitakit')),
    );
    // `foundation as vite` keeps its local name; a plain import renames its calls.
    if (!/\bfoundation\s+as\b/.test(names)) text = text.replace(/\bfoundation\(/g, 'bitakit(');
  }
  return text;
}

async function exists(file) {
  return stat(file).then(
    () => true,
    () => false,
  );
}

const defaultExport = /\bexport\s+default\b|\bexport\s*\{[^}]*\bdefault\b/;

/** Every file of the project for an import scan: no symlinks, dependencies or build output. */
async function projectFiles(directory) {
  const skipped = ['node_modules', '.git', '.next', '.tanstack', '.output', 'dist', 'coverage'];
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const result = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink() || skipped.includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await projectFiles(file)));
    else result.push(file);
  }
  return result;
}

/**
 * Moves the files of contribution kinds that now run on the server (`movedFrom: 'client'`) under
 * `server/contributions/<dir>`: all of `contributions/<dir>/` (data files and helpers too) and its
 * dotted or record files, and from the old root place (`<dir>/`, `<dir>.*.ts`) only source files
 * with a default export. Relative imports in moved files keep pointing at the same files; any
 * other project file that imports a moved one, and an `entries` override naming the kind, are
 * reported.
 */
async function moveServerKinds(root, moduleDirs, kinds, apply, changes, relative) {
  const isSource = (file) => /\.tsx?$/.test(file) && !/\.d\.ts$/.test(file);
  /** Old absolute path → `{ to, kind }`, over every module and kind, before anything moves. */
  const plan = new Map();
  const folders = new Set();
  for (const base of moduleDirs) {
    const boundaries = new Set(moduleDirs.filter((dir) => dir !== base && dir.startsWith(base)));
    const list = await files(base, boundaries);
    for (const kind of kinds) {
      const parts = kind.directory.split('/');
      const folder = path.join(base, 'contributions', ...parts);
      const rootFolder = path.join(base, ...parts);
      const target = path.join(base, 'server', 'contributions', ...parts);
      for (const file of list) {
        if (plan.has(file)) continue;
        if (file.startsWith(folder + path.sep) || (file.startsWith(`${folder}.`) && isSource(file)))
          plan.set(file, { to: target + file.slice(folder.length), kind });
        // The old root place may hold other code: only contributions move.
        else if (
          (file.startsWith(rootFolder + path.sep) || file.startsWith(`${rootFolder}.`)) &&
          isSource(file) &&
          defaultExport.test(await readFile(file, 'utf8'))
        )
          plan.set(file, { to: target + file.slice(rootFolder.length), kind });
      }
      folders.add(folder).add(rootFolder);
    }
    const manifest = path.join(base, 'plugin.config.ts');
    const source = await readFile(manifest, 'utf8').catch(() => '');
    for (const kind of kinds)
      if (source.includes(`'${kind.name}'`) || source.includes(`"${kind.name}"`))
        changes.push({
          kind: 'skip',
          from: relative(manifest),
          detail: `an entries override names "${kind.name}"; move those files under server/contributions/${kind.directory}/ and remove the override`,
        });
  }
  for (const [file, { to }] of [...plan])
    if (await exists(to)) {
      changes.push({
        kind: 'skip',
        from: relative(file),
        to: relative(to),
        detail: 'target exists',
      });
      plan.delete(file);
    }
  if (!plan.size) return;
  // Where an import of `absolute` points after the move: the moved file (or folder), or the same.
  const where = (absolute) => {
    const stem = absolute.replace(/\.[cm]?js$/, '');
    for (const candidate of [
      absolute,
      `${stem}.ts`,
      `${stem}.tsx`,
      path.join(absolute, 'index.ts'),
      path.join(absolute, 'index.tsx'),
    ])
      if (plan.has(candidate))
        return path.join(
          path.dirname(plan.get(candidate).to),
          path.relative(path.dirname(candidate), absolute),
        );
    return absolute;
  };
  const imports = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?\/[^'"]*)\2/g;
  for (const [file, { to, kind }] of plan)
    await apply(
      {
        kind: 'rename',
        from: relative(file),
        to: relative(to),
        detail: `"${kind.name}" runs on the server`,
      },
      async () => {
        await mkdir(path.dirname(to), { recursive: true });
        if (!isSource(file)) return rename(file, to);
        const rewritten = (await readFile(file, 'utf8')).replace(
          imports,
          (match, lead, quote, specifier) => {
            let next = path
              .relative(path.dirname(to), where(path.resolve(path.dirname(file), specifier)))
              .split(path.sep)
              .join('/');
            if (!next.startsWith('.')) next = `./${next}`;
            return `${lead}${quote}${next}${quote}`;
          },
        );
        await writeFile(to, rewritten);
        await rm(file);
      },
    );
  // Folders the move empties, outermost first; a folder that keeps other files stays.
  const emptied = async (folder) => (await files(folder)).every((file) => plan.has(file));
  const candidates = new Set();
  for (const folder of folders)
    for (const file of plan.keys())
      for (
        let dir = path.dirname(file);
        dir === folder || dir.startsWith(folder + path.sep);
        dir = path.dirname(dir)
      ) {
        candidates.add(dir);
        if (dir === folder) break;
      }
  const removed = [];
  for (const folder of [...candidates].sort((a, b) => a.length - b.length)) {
    if (removed.some((dir) => folder.startsWith(dir + path.sep)) || !(await exists(folder)))
      continue;
    if (!(await emptied(folder))) continue;
    removed.push(folder);
    await apply({ kind: 'delete', from: relative(folder), detail: 'empty after the move' }, () =>
      rm(folder, { recursive: true, force: true }),
    );
  }
  // Other files that import a moved one need a hand: anywhere in the project, tests included.
  for (const file of await projectFiles(root)) {
    if (
      plan.has(file) ||
      !/\.[cm]?[jt]sx?$/.test(file) ||
      /\.d\.[cm]?ts$|bitakit\.gen\./.test(file)
    )
      continue;
    const text = await readFile(file, 'utf8').catch(() => '');
    for (const [, , , specifier] of text.matchAll(imports)) {
      const absolute = path.resolve(path.dirname(file), specifier);
      const next = where(absolute);
      if (next !== absolute)
        changes.push({
          kind: 'skip',
          from: relative(file),
          detail: `imports ${specifier}, which moves to ${relative(next)}; update the import`,
        });
    }
  }
}

/**
 * Rewrites a project from the 0.1 layout to the current one: `bitakit.config.ts`, folder-only
 * contribution files, `ui/` for pages, slots and providers, generated-file imports, scripts and
 * `.gitignore`. Returns the list of changes; `dryRun` only reports them.
 */
export async function migrateProject(root, { dryRun = false, navigationSlot } = {}) {
  root = path.resolve(root);
  const changes = [];
  const apply = async (change, run) => {
    changes.push(change);
    if (!dryRun) await run();
  };
  const relative = (file) => path.relative(root, file).split(path.sep).join('/');

  // 1. Configuration file.
  const legacyConfig = path.join(root, 'foundation.config.ts');
  if ((await exists(legacyConfig)) && !(await exists(path.join(root, 'bitakit.config.ts')))) {
    const source = await readFile(legacyConfig, 'utf8');
    const rewritten = source
      .replace(/\bdefineFoundation\b/g, 'defineBitaKit')
      .replace(/@bitakit\/next\/config'/g, "@bitakit/discovery'");
    await apply(
      {
        kind: 'rename',
        from: 'foundation.config.ts',
        to: 'bitakit.config.ts',
        detail: 'defineFoundation → defineBitaKit',
      },
      async () => {
        await writeFile(path.join(root, 'bitakit.config.ts'), rewritten);
        await rm(legacyConfig);
      },
    );
  }
  const { config } = await loadDiscoveryConfig(root).catch(() => ({ config: {} }));
  const appRoot = path.resolve(root, config.directory ?? './src');
  const pluginsDirectory = path.resolve(root, config.plugins?.directory ?? './src/plugins');
  const moduleDirs = [
    appRoot,
    ...pluginManifests(pluginsDirectory, await files(pluginsDirectory)).map((file) =>
      path.dirname(file),
    ),
  ];

  // 2. Contribution files: legacy folders, dotted names and suffixes.
  for (const base of moduleDirs) {
    const moved = new Map();
    const moduleId =
      base === appRoot
        ? undefined
        : (/id:\s*['"]([^'"]+)['"]/.exec(
            await readFile(path.join(base, 'plugin.config.ts'), 'utf8').catch(() => ''),
          )?.[1] ?? path.basename(base));
    for (const [legacy, target] of Object.entries(legacyFolders)) {
      const from = path.join(base, legacy);
      const to = path.join(base, target);
      if ((await exists(from)) && !(await exists(to))) {
        if (base === appRoot && legacy === 'providers') continue; // app providers are opt-in; leave them
        moved.set(legacy, target);
        // File by file: a legacy definePage/defineView literal decides the new name, so the
        // path or slot encoded in the call survives once the call itself is removed.
        for (const file of await files(from)) {
          if (!/\.tsx?$/.test(file)) continue;
          const source = await readFile(file, 'utf8');
          const stem = path
            .relative(from, file)
            .replace(/\.tsx?$/, '')
            .replace(/\.(page|view|provider)$/, '');
          let name = stem;
          if (legacy === 'views') name = /slot:\s*['"]([^'"]+)['"]/.exec(source)?.[1] ?? stem;
          if (legacy === 'pages') {
            const literal = /path:\s*['"]([^'"]+)['"]/.exec(source)?.[1];
            if (literal) {
              const prefix = moduleId ? `/${moduleId}` : '';
              const rest =
                literal === prefix || literal === `${prefix}/`
                  ? ''
                  : literal.startsWith(`${prefix}/`)
                    ? literal.slice(prefix.length + 1)
                    : undefined;
              if (rest !== undefined) name = rest || 'index';
            }
          }
          const destination = path.join(to, `${name}${path.extname(file)}`);
          await apply(
            { kind: 'rename', from: relative(file), to: relative(destination) },
            async () => {
              await mkdir(path.dirname(destination), { recursive: true });
              await rename(file, destination);
            },
          );
          // 0.2 has no page or view wrapper: the file path names the route or slot.
          const wrapper = /\b(definePage|defineView)\s*\(/.exec(source)?.[1];
          if (wrapper)
            changes.push({
              kind: 'skip',
              from: relative(destination),
              detail: `${wrapper}(...) was removed in 0.2; export the component itself as default`,
            });
        }
        await apply({ kind: 'delete', from: relative(from), detail: 'legacy folder' }, () =>
          rm(from, { recursive: true, force: true }),
        );
      }
    }
    const boundaries = new Set(moduleDirs.filter((dir) => dir !== base && dir.startsWith(base)));
    // A dry run has not moved the legacy folders yet; report the paths, and the order, the real run sees.
    const candidates = (await files(base, boundaries))
      .filter((file) => /\.tsx?$/.test(file) && !/\.d\.ts$/.test(file))
      .map((file) => {
        let rel = path.relative(base, file).split(path.sep).join('/');
        let fromLegacy = false;
        for (const [legacy, target] of moved)
          if (rel.startsWith(`${legacy}/`)) {
            rel = `${target}/${rel.slice(legacy.length + 1)}`;
            fromLegacy = true;
          }
        return { file, rel, fromLegacy };
      })
      .sort((a, b) => a.rel.localeCompare(b.rel));
    for (const { file, rel, fromLegacy } of candidates) {
      // Files from a legacy folder already received their final names in the move above.
      if (fromLegacy) continue;
      const current = path.join(base, rel);
      const extension = path.extname(file);
      const stem = path.basename(file, extension);
      const parts = stem.split('.');
      const folder = rel.split('/')[0];
      const kind = Object.keys(suffixes).find(
        (name) => folder === name || folder === `ui` || parts[0] === name,
      );
      if (!kind) continue;
      let next = rel;
      // actions.create.ts at the module root → actions/create.ts. A plain actions.ts is the
      // supported one-file-per-kind layout (a record of contributions) and stays as it is.
      if (parts[0] in suffixes && !rel.includes('/') && parts.length > 1)
        next = `${parts[0]}/${parts.slice(1).join('/')}${extension}`;
      // actions/create.action.ts → actions/create.ts
      const trailing = parts.at(-1);
      const suffixKind = Object.entries(suffixes).find(([, list]) => list.includes(trailing))?.[0];
      if (suffixKind && parts.length > 1)
        next = `${path.dirname(next)}/${parts.slice(0, -1).join('.')}${extension}`.replace(
          /^\.\//,
          '',
        );
      if (next === rel) continue;
      const to = path.join(base, next);
      if (await exists(to)) {
        changes.push({
          kind: 'skip',
          from: relative(current),
          to: relative(to),
          detail: 'target exists',
        });
        continue;
      }
      await apply({ kind: 'rename', from: relative(current), to: relative(to) }, async () => {
        await mkdir(path.dirname(to), { recursive: true });
        await rename(current, to);
      });
    }
  }

  // 2b. Contribution kinds that moved to the server (the scheduler's tasks and schedules in 0.3).
  let movedKinds = [];
  try {
    const jiti = createJiti(import.meta.url, { moduleCache: false, fsCache: false });
    const installed = await installedContributions(root, config.packages, jiti, {
      auditStyles: false,
    });
    movedKinds = mergedKindSpecs(installed.kinds, config.kinds).filter(
      (kind) => kind.movedFrom === 'client',
    );
  } catch (error) {
    changes.push({
      kind: 'skip',
      detail: `installed packages could not be read, so server kinds were not moved: ${error.message}`,
    });
  }
  if (movedKinds.length)
    await moveServerKinds(root, moduleDirs, movedKinds, apply, changes, relative);

  // 3. Source rewrites: generated-file imports and renamed helpers.
  const hasLocales = (
    await Promise.all(moduleDirs.map((dir) => files(path.join(dir, 'locales'))))
  ).some((list) => list.some((file) => file.endsWith('.json')));
  // Plugin folders can live outside the app root (`plugins.directory`); read each source file once.
  const sourceFiles = [
    ...new Set((await Promise.all([appRoot, ...moduleDirs].map((dir) => files(dir)))).flat()),
  ];
  // 0.2 @bitakit/ui exports only React bindings; Core names it re-exported move to
  // @bitakit/core. The export lists come from the installed packages, read once when needed.
  let exportLists;
  const coreImports = () => {
    exportLists ??= {
      core: exportedNames(root, '@bitakit/core'),
      ui: new Map(
        ['@bitakit/ui', '@bitakit/ui/actions'].map((entry) => [entry, exportedNames(root, entry)]),
      ),
    };
    return exportLists;
  };
  let reportedMissingCore = false;
  for (const file of sourceFiles) {
    if (!/\.(tsx?|css|mjs)$/.test(file) || /\.d\.ts$/.test(file) || /bitakit\.gen\./.test(file))
      continue;
    const source = await readFile(file, 'utf8');
    const toGenerated = (name) => {
      const target = path.join(appRoot, name);
      let rel = path.relative(path.dirname(file), target).split(path.sep).join('/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return rel;
    };
    const isRootLayout = /(^|\/)(app\/layout\.tsx|routes\/__root\.tsx)$/.test(relative(file));
    let rewritten = source
      .replace(
        /(['"])[^'"]*\.foundation\/styles\.css\1/g,
        (_, q) => `${q}${toGenerated('bitakit.gen.css')}${q}`,
      )
      .replace(
        /(['"])[^'"]*\.foundation\/plugins\1/g,
        (_, q) => `${q}${toGenerated('bitakit.gen')}${q}`,
      )
      .replace(/(['"])[^'"]*\.foundation\/messages\.json\1/g, (_, q) =>
        hasLocales
          ? `${q}${toGenerated('bitakit.gen.messages.json')}${q}`
          : (changes.push({
              kind: 'skip',
              from: relative(file),
              detail:
                'imports .foundation/messages.json, but no plugin has locales; remove the import',
            }),
            `${q}${toGenerated('bitakit.gen.messages.json')}${q}`),
      )
      .replace(
        /(['"])@bitakit\/(?:next|tanstack)\/generated\1/g,
        (_, q) => `${q}${toGenerated('bitakit.gen')}${q}`,
      )
      .replace(/\bdefineURLAction\b/g, 'defineAction')
      .replace(/\buseWatchEvent\b/g, 'useEvent');
    // The root layout mounts the generated provider instead of the adapter's bare provider.
    if (
      isRootLayout &&
      /import \{[^}]*\bFoundationProvider\b[^}]*\} from ['"]@bitakit\/(next|tanstack)['"]/.test(
        rewritten,
      )
    )
      rewritten = rewritten
        .replace(
          /import \{([^}]*)\bFoundationProvider\b([^}]*)\} from (['"])@bitakit\/(next|tanstack)\3;?/g,
          (_, before, after, q, adapter) => {
            const rest = `${before}${after}`
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean);
            return `${rest.length ? `import { ${rest.join(', ')} } from ${q}@bitakit/${adapter}${q};\n` : ''}import { BitaKitProvider } from ${q}${toGenerated('bitakit.gen')}${q};`;
          },
        )
        .replace(/<FoundationProvider\b/g, '<BitaKitProvider')
        .replace(/<\/FoundationProvider>/g, '</BitaKitProvider>');
    // After the 0.1 root-layout step above, which still recognizes <FoundationProvider>.
    if (/\.(tsx?|mjs)$/.test(file)) rewritten = rewriteRenamedNames(rewritten);
    if (/\.(tsx?|mjs)$/.test(file) && importsFromUi(rewritten)) {
      const { core, ui } = coreImports();
      if (core) rewritten = moveCoreImports(rewritten, { core, ui, tsx: file.endsWith('.tsx') });
      else if (!reportedMissingCore) {
        reportedMissingCore = true;
        changes.push({
          kind: 'skip',
          from: relative(file),
          detail:
            'imports from @bitakit/ui, but @bitakit/core is not installed; install it and run migrate again to move Core names',
        });
      }
    }
    if (/\.tsx?$/.test(file)) {
      const scoped = rewriteScopeAndSlots(rewritten, {
        setupFile: /(^|\/)setup\.tsx?$/.test(file),
        tsx: file.endsWith('.tsx'),
      });
      rewritten = scoped.code;
      for (const line of scoped.unresolved)
        changes.push({
          kind: 'skip',
          from: `${relative(file)}:${line}`,
          detail:
            'slots.attach(name, contribution) needs the 0.2 form attach({ slot: name, ... }); rewrite it by hand',
        });
    }
    if (rewritten !== source)
      await apply(
        {
          kind: 'rewrite',
          from: relative(file),
          detail: 'generated-file imports, renamed helpers and names, setup scope and slot targets',
        },
        () => writeFile(file, rewritten),
      );
  }
  // Root configuration files sit outside src but use renamed helpers (defineFoundation,
  // withFoundation, TanStack's foundation()).
  for (const name of [
    'bitakit.config.ts',
    'next.config.ts',
    'next.config.mjs',
    'next.config.js',
    'vite.config.ts',
    'vite.config.mts',
    'vite.config.js',
    'vite.config.mjs',
  ]) {
    const file = path.join(root, name);
    const source = await readFile(file, 'utf8').catch(() => null);
    // A dry run has not written bitakit.config.ts from foundation.config.ts yet; step 1 renames it.
    if (source === null) continue;
    const rewritten = rewriteRenamedNames(source);
    if (rewritten !== source)
      await apply({ kind: 'rewrite', from: name, detail: 'renamed configuration helpers' }, () =>
        writeFile(file, rewritten),
      );
  }

  // 4. package.json scripts and .gitignore.
  const manifestFile = path.join(root, 'package.json');
  const manifestSource = await readFile(manifestFile, 'utf8').catch(() => null);
  if (manifestSource) {
    const rewritten = manifestSource
      .replace(/foundation-generate/g, 'bitakit generate')
      .replace(/next (dev|build) --webpack/g, 'next $1');
    if (rewritten !== manifestSource)
      await apply(
        {
          kind: 'rewrite',
          from: 'package.json',
          detail: 'scripts use bitakit generate and plain next dev/build',
        },
        () => writeFile(manifestFile, rewritten),
      );
  }
  const ignoreFile = path.join(root, '.gitignore');
  const ignore = await readFile(ignoreFile, 'utf8').catch(() => null);
  if (ignore !== null) {
    let rewritten = ignore
      .split('\n')
      .filter(
        (line) => !['.foundation/', '.foundation', 'foundation-env.d.ts'].includes(line.trim()),
      )
      .join('\n');
    if (!rewritten.includes('bitakit.gen'))
      rewritten = `${rewritten.trimEnd()}\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n`;
    if (rewritten !== ignore)
      await apply({ kind: 'rewrite', from: '.gitignore', detail: 'ignore src/bitakit.gen.*' }, () =>
        writeFile(ignoreFile, rewritten),
      );
  }
  // 5. Old generated output.
  for (const stale of ['.foundation', 'foundation-env.d.ts'])
    if (await exists(path.join(root, stale)))
      await apply({ kind: 'delete', from: stale }, () =>
        rm(path.join(root, stale), { recursive: true, force: true }),
      );
  if (navigationSlot) {
    for (const file of await files(appRoot)) {
      if (!/\.tsx?$/.test(file) || /(?:^|[\\/])server[\\/]|bitakit\.gen\./.test(file)) continue;
      const source = await readFile(file, 'utf8');
      const placement = navigationPlacement(source, navigationSlot);
      if (placement.changed)
        await apply(
          {
            kind: 'rewrite',
            from: relative(file),
            detail: `Place navigation Actions in the explicitly selected slot "${navigationSlot}".`,
          },
          () => writeFile(file, placement.code),
        );
      for (const item of placement.missing.filter((item) => !item.safe))
        changes.push({
          kind: 'skip',
          from: relative(file),
          detail: `Line ${item.line}: spread properties make placement ambiguous; add slots explicitly.`,
        });
    }
  }
  return { changes };
}
