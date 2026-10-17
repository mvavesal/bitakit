import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { packagePluginId, pluginFiles, titleOf } from '@bitakit/cli';
import { bitakitRange, writeProjectFiles } from './project-files.mjs';
import { useLocalPackages } from './create-app.mjs';

/**
 * A standalone plugin package: the same folders as a plugin inside an app, a headless test and a
 * playground app (an npm workspace) that discovers the package source with hot reload.
 */
export async function createPluginPackage(plan, { run, createApp, packagesDir }) {
  const id = packagePluginId(plan.name);
  const title = titleOf(id);
  await mkdir(plan.target, { recursive: true });
  const manifest = {
    name: plan.name,
    version: '0.1.0',
    description: `${title} plugin for BitaKit apps.`,
    type: 'module',
    exports: {
      './package.json': './package.json',
      './plugin': { types: './dist/plugin.d.ts', default: './dist/plugin.js' },
    },
    files: ['dist'],
    // Apps that install this package discover the plugin through this entry.
    bitakit: { plugin: './plugin', id },
    workspaces: ['playground'],
    scripts: {
      dev: 'npm run dev --workspace playground',
      build: 'bitakit build',
      typecheck: 'bitakit build --check',
      test: 'node --test tests/*.test.ts',
      prepublishOnly: 'bitakit build',
    },
    peerDependencies: {
      '@bitakit/core': bitakitRange,
      '@bitakit/ui': bitakitRange,
      react: '^19.0.0',
    },
    // React is added below with the playground's exact version, so both share one copy.
    devDependencies: {
      '@bitakit/cli': bitakitRange,
      '@bitakit/core': bitakitRange,
      '@bitakit/discovery': bitakitRange,
      '@bitakit/ui': bitakitRange,
      '@types/react': '^19',
      typescript: '^5',
    },
    license: 'MIT',
  };
  await writeProjectFiles(plan.target, {
    'package.json': JSON.stringify(manifest, null, 2) + '\n',
    'tsconfig.json':
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            jsx: 'react-jsx',
            strict: true,
            skipLibCheck: true,
            declaration: true,
            verbatimModuleSyntax: true,
            rootDir: 'src',
            outDir: 'dist',
          },
          // .bitakit/plugin.d.ts types services, actions and events; bitakit build generates it.
          include: ['src', '.bitakit/plugin.d.ts'],
        },
        null,
        2,
      ) + '\n',
    '.gitignore': 'node_modules/\ndist/\n.bitakit/\n.next/\n*.tgz\n',
    'README.md': pluginReadme(plan, id, title),
    'AGENTS.md': pluginAgentRules(id),
    'CLAUDE.md': '@AGENTS.md\n',
    [`tests/${id}.test.ts`]: `import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPlugin } from '@bitakit/core/testing';

// Runs the plugin headlessly in Node: services, events and actions, without a browser.
test('adding an item updates the store, emits an event and enables Clear all', async () => {
  const plugin = await mountPlugin('src');
  try {
    assert.equal(plugin.actions.get('${id}.clear')?.enabled, false);
    await plugin.execute('add', 'First item');
    const items = (plugin.services as any)[${JSON.stringify(id)}].items.state.get().items;
    assert.deepEqual(items.map((item: { title: string }) => item.title), ['First item']);
    assert.ok(plugin.events.recorded.some((event) => event.type === '${id}.changed'));
    assert.equal(plugin.actions.get('${id}.clear')?.enabled, true);
  } finally {
    await plugin.stop();
  }
});
`,
  });
  await writeProjectFiles(path.join(plan.target, 'src'), pluginFiles(id));
  const playground = path.join(plan.target, 'playground');
  await createApp(
    { ...plan, type: 'app', target: playground, name: 'playground', sample: false, install: false },
    { run, install: false },
  );
  await configurePlayground(plan, playground, id);
  // One React for the plugin source and the playground: develop against the playground's version.
  const rootFile = path.join(plan.target, 'package.json');
  const root = JSON.parse(await readFile(rootFile, 'utf8'));
  const { dependencies = {} } = JSON.parse(
    await readFile(path.join(playground, 'package.json'), 'utf8'),
  );
  for (const name of ['react', 'react-dom'])
    if (dependencies[name]) root.devDependencies[name] = dependencies[name];
  await writeFile(rootFile, JSON.stringify(root, null, 2) + '\n');
  if (packagesDir) {
    await useLocalPackages(plan.target, packagesDir);
    await useLocalPackages(playground, packagesDir);
    // npm reads overrides from the workspace root only.
    const file = path.join(playground, 'package.json');
    const { overrides, ...rest } = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(file, JSON.stringify(rest, null, 2) + '\n');
  }
  if (plan.install) await run('npm', ['install'], plan.target);
  return plan.target;
}

/** The playground shows the Inspector and discovers the package source with hot reload. */
async function configurePlayground(plan, playground, id) {
  const file = path.join(playground, 'package.json');
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  manifest.name = `${plan.name}-playground`;
  manifest.private = true;
  manifest.dependencies['@bitakit/devtools'] = bitakitRange;
  const inspector = `import { Inspector } from '@bitakit/devtools';`;
  await writeProjectFiles(playground, {
    'package.json': JSON.stringify(manifest, null, 2) + '\n',
    'src/setup.ts': `import type { Setup } from '@bitakit/core';

// Host-owned placement: the plugin also works without Shell.
const setup: Setup = ({ app }) => {
  app.slots.attach('shell.navigation', { actionId: '${id}.open' }, { availability: 'wait' });
};
export default setup;
`,
    'bitakit.config.ts': `import { defineBitaKit } from '@bitakit/discovery';

// Discover the plugin straight from ../src, so edits reload instantly.
export default defineBitaKit({ plugins: { include: { ${JSON.stringify(id)}: '../src' } } });
`,
    ...(plan.framework === 'tanstack'
      ? {
          'src/routes/_app.index.tsx': `import { createFileRoute } from '@tanstack/react-router';
${inspector}

export const Route = createFileRoute('/_app/')({ component: () => <Inspector plugin="${id}" /> });
`,
        }
      : {
          'src/app/(app)/page.tsx': `'use client';
${inspector}

export default function Home() {
  return <Inspector plugin="${id}" />;
}
`,
        }),
  });
}

function pluginReadme(plan, id, title) {
  return `# ${plan.name}

A [BitaKit](https://github.com/mvavesal/bitakit) plugin. Apps that install this package get
the "${title}" feature automatically: its services, actions and pages. Each app chooses where
the "${id}.open" link appears, for example with a slot placement.

\`\`\`sh
npm run dev        # playground app with the Inspector, reloads when src/ changes
npm test           # headless tests in tests/
npm run typecheck  # type-check the plugin
npm run build      # build dist/ for npm
\`\`\`

## Structure

| Folder | What goes there |
| --- | --- |
| \`src/services\` | Data and behavior (\`defineService\`) |
| \`src/actions\` | Operations for buttons, menus and links (\`defineAction\`) |
| \`src/events.ts\` | Typed events (\`defineEvents\`) |
| \`src/ui/pages\` | Plugin pages; the file path is the URL |
| \`tests\` | Headless tests with \`mountPlugin\` from \`@bitakit/core/testing\` |
| \`playground\` | A ${plan.framework === 'tanstack' ? 'TanStack Start' : 'Next.js'} app to try the plugin in |

These are the same conventions as a plugin inside an app, so you can move a folder from
\`src/plugins/${id}\` of an app into \`src/\` here, and back. Add files with
\`npx bitakit add action|service|page <name>\`.

## Publish

\`\`\`sh
npm run build
npm publish
\`\`\`

Apps install it with \`npm install ${plan.name}\`; the plugin ID is \`${id}\`.
`;
}

function pluginAgentRules(id) {
  return `<!-- BEGIN:bitakit-agent-rules -->

# BitaKit plugin package

This package is one BitaKit plugin with the ID "${id}". Apps that install it discover it
through \`bitakit.plugin\` in package.json; nothing needs registering.

- \`src/services/<name>.ts\` (\`defineService\`, reached as \`services.${id}.<name>\`), \`src/actions/<name>.ts\`
  (\`defineAction\`, ID \`${id}.<name>\`), \`src/events.ts\` (\`defineEvents\`) and \`src/ui/pages/<path>.tsx\`
  (the file path is the URL): the same conventions as plugins in an app.
- Add files with \`npx bitakit add action|service|page|interceptor|config <name>\`; declare events once
  with \`npx bitakit add events\`.
- \`npm run dev\` starts the playground (\`playground/\`) with the Inspector; it discovers \`src/\`
  directly. \`npm test\` runs \`tests/*.test.ts\` headlessly with \`mountPlugin\`, including
  \`src/setup.ts\`; keep services, actions and setup free of JSX and guard browser-only APIs. \`npm run typecheck\` and \`npm run build\` (dist/ for npm) use \`bitakit build\`.
- Keep \`@bitakit/core\`, \`@bitakit/ui\` and \`react\` in peerDependencies so apps load one copy.
- Use components from \`@bitakit/ui/components\` and the host theme; do not restyle them.
- Never edit generated files: \`.bitakit/\` and \`dist/\`.

<!-- END:bitakit-agent-rules -->
`;
}
