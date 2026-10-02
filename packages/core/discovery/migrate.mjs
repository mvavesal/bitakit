import { readFile, writeFile, rename, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { files } from './entries.mjs';
import { pluginManifests } from './modules.mjs';
import { loadDiscoveryConfig } from './generate.mjs';

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

async function exists(file) {
  return stat(file).then(
    () => true,
    () => false,
  );
}

/**
 * Rewrites a project from the 0.1 layout to the current one: `bitakit.config.ts`, folder-only
 * contribution files, `ui/` for pages, slots and providers, generated-file imports, scripts and
 * `.gitignore`. Returns the list of changes; `dryRun` only reports them.
 */
export async function migrateProject(root, { dryRun = false } = {}) {
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
      .replace(/@bitakit\/next\/config'/g, "@bitakit/core/discovery'");
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
    for (const [legacy, target] of Object.entries(legacyFolders)) {
      const from = path.join(base, legacy);
      const to = path.join(base, target);
      if ((await exists(from)) && !(await exists(to))) {
        if (base === appRoot && legacy === 'providers') continue; // app providers are opt-in; leave them
        moved.set(legacy, target);
        await apply({ kind: 'move', from: relative(from), to: relative(to) }, async () => {
          await mkdir(path.dirname(to), { recursive: true });
          await rename(from, to);
        });
      }
    }
    const boundaries = new Set(moduleDirs.filter((dir) => dir !== base && dir.startsWith(base)));
    // A dry run has not moved the legacy folders yet; report the paths, and the order, the real run sees.
    const candidates = (await files(base, boundaries))
      .filter((file) => /\.tsx?$/.test(file) && !/\.d\.ts$/.test(file))
      .map((file) => {
        let rel = path.relative(base, file).split(path.sep).join('/');
        for (const [legacy, target] of moved)
          if (rel.startsWith(`${legacy}/`)) rel = `${target}/${rel.slice(legacy.length + 1)}`;
        return { file, rel };
      })
      .sort((a, b) => a.rel.localeCompare(b.rel));
    for (const { file, rel } of candidates) {
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
      // actions.create.ts at the module root → actions/create.ts; actions.ts → actions/index.ts
      if (parts[0] in suffixes && !rel.includes('/'))
        next = `${parts[0]}/${parts.length > 1 ? parts.slice(1).join('/') : 'index'}${extension}`;
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

  // 3. Source rewrites: generated-file imports and renamed helpers.
  for (const file of await files(appRoot)) {
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
      .replace(
        /(['"])[^'"]*\.foundation\/messages\.json\1/g,
        (_, q) => `${q}${toGenerated('bitakit.gen.messages.json')}${q}`,
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
    if (rewritten !== source)
      await apply(
        {
          kind: 'rewrite',
          from: relative(file),
          detail: 'generated-file imports and renamed helpers',
        },
        () => writeFile(file, rewritten),
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
  return { changes };
}
