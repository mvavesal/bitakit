import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
  symlink,
  access,
  chmod,
} from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execa } from 'execa';
import { fileURLToPath } from 'node:url';
import { planProject, createApp, createProject, useLocalPackages } from '../src/create-app.mjs';
import { bitakitRange, releaseLineRange } from '../src/project-files.mjs';
import { bundledSkillFiles, readSkillFiles } from '@bitakit/cli';

async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'bitakit-create-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const read = (target, file) => readFile(path.join(target, file), 'utf8');
const exists = (target, file) => access(path.join(target, file));
const missing = (target, file) => assert.rejects(access(path.join(target, file)));

// The official scaffolds are replaced by their minimal output; the real scaffold/install/build
// path is verified against packed packages separately.
const scaffoldedNextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
};

export default nextConfig;
`;

async function scaffoldNext(command, args) {
  assert.equal(command, process.execPath);
  assert.ok(args.includes('--skip-install'));
  assert.ok(args.includes('--disable-git'));
  assert.ok(args.includes('--no-cache-components'));
  const target = args[1];
  await mkdir(path.join(target, 'src/app'), { recursive: true });
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      dependencies: { next: '16.4.2', react: '19.2.0', 'react-dom': '19.2.0' },
      devDependencies: {},
      scripts: {},
    }),
  );
  await writeFile(path.join(target, 'src/app/page.tsx'), 'export default function Page() {}');
  await writeFile(path.join(target, 'src/app/layout.tsx'), 'export default function Layout() {}');
  await writeFile(path.join(target, 'src/app/globals.css'), '@import "tailwindcss";\n');
  // create-next-app 16.4 wires Tailwind through a Turbopack loader rule in next.config.ts.
  await writeFile(path.join(target, 'next.config.ts'), scaffoldedNextConfig);
  await writeFile(path.join(target, '.gitignore'), 'node_modules/\n');
  await writeFile(path.join(target, 'AGENTS.md'), '<!-- next rules -->\n');
}
async function scaffoldStart(command, args) {
  assert.equal(command, process.execPath);
  assert.ok(args.includes('--blank'));
  assert.ok(args.includes('--no-install'));
  assert.ok(args.includes('--no-git'));
  const target = args[args.indexOf('--target-dir') + 1];
  await mkdir(path.join(target, 'src/routes'), { recursive: true });
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      dependencies: { react: '19.2.0', 'react-dom': '19.2.0' },
      scripts: { dev: 'vite dev', build: 'vite build' },
    }),
  );
  await writeFile(path.join(target, 'src/routes/index.tsx'), 'export {};');
  await writeFile(path.join(target, 'src/routes/__root.tsx'), 'export {};');
}

test('rejects existing projects, files and symlinks without touching user files', async (t) => {
  const root = await workspace(t);
  const existing = path.join(root, 'existing');
  await mkdir(path.join(existing, '.git'), { recursive: true });
  await writeFile(path.join(existing, 'package.json'), '{}');
  await writeFile(path.join(existing, 'keep.txt'), 'user content');
  await writeFile(path.join(root, 'file'), '');
  await symlink(existing, path.join(root, 'linked'));
  // Only the unexpected entries are listed; .git is allowed.
  await assert.rejects(
    planProject(existing),
    /already exists: .*existing\..* also contains keep\.txt, package\.json\. Choose a new directory\./,
  );
  await assert.rejects(planProject(path.join(root, 'file')), /already exists/);
  await assert.rejects(planProject(path.join(root, 'linked')), /already exists/);
  await assert.rejects(createProject({ target: existing }, { run: scaffoldNext }), /keep\.txt/);
  assert.equal(await readFile(path.join(existing, 'keep.txt'), 'utf8'), 'user content');
  assert.equal(await read(existing, 'package.json'), '{}');
  assert.deepEqual(await readdir(root), ['existing', 'file', 'linked']);
});

test('an empty folder becomes the app; scaffolding runs in a sibling and installing in place', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'here');
  await mkdir(target);
  const plan = await planProject(target);
  assert.deepEqual(plan.existing, []);
  const calls = [];
  const result = await createProject(plan, {
    run: async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      if (command !== 'npm') await scaffoldNext(command, args);
    },
  });
  assert.deepEqual(result, { target, kept: [] });
  // The scaffolder sees a new folder with the target's name next to the target.
  const staged = calls[0].args[1];
  assert.equal(path.basename(staged), 'here');
  assert.equal(path.dirname(path.dirname(staged)), root);
  assert.deepEqual(calls.at(-1), { command: 'npm', args: ['install'], cwd: target });
  assert.deepEqual(await readdir(root), ['here']);
  await exists(target, 'src/app/layout.tsx');
  await exists(target, '.agents/skills/bitakit-app-development/references/slots.md');
  await exists(target, '.claude/skills/bitakit-app-development/SKILL.md');
  assert.equal(await read(target, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(await read(target, 'AGENTS.md'), /^<!-- next rules -->\n\n<!-- BEGIN:bitakit/);
  assert.equal(
    JSON.parse(await read(target, 'package.json')).dependencies['@bitakit/core'],
    bitakitRange,
  );
});

test('generated projects depend on the release line, not the generator version', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(bitakitRange, releaseLineRange(manifest.version));
  assert.equal(releaseLineRange('0.2.4'), '^0.2.0');
  assert.equal(releaseLineRange('0.3.0'), '^0.3.0');
  assert.equal(releaseLineRange('1.4.2'), '^1.0.0');
});

/** Writes `files` (relative path to content) into `target`. */
async function seed(target, files) {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(target, file)), { recursive: true });
    await writeFile(path.join(target, file), content);
  }
}

const nextRules =
  '<!-- BEGIN:nextjs-agent-rules -->\nNext.js rules\n<!-- END:nextjs-agent-rules -->\n';

/** The minimal Next scaffold with create-next-app's own managed AGENTS.md block. */
async function scaffoldNextWithRules(command, args) {
  await scaffoldNext(command, args);
  await writeFile(path.join(args[1], 'AGENTS.md'), nextRules);
}

/** Asserts that `rules` begins with `start` and has each managed block once, framework first. */
function assertMergedRules(rules, start) {
  assert.ok(rules.startsWith(start), rules);
  assert.equal(rules.match(/BEGIN:nextjs-agent-rules/g).length, 1);
  assert.equal(rules.match(/BEGIN:bitakit-agent-rules/g).length, 1);
  assert.ok(rules.indexOf('END:nextjs-agent-rules') < rules.indexOf('BEGIN:bitakit-agent-rules'));
}

test('a folder with .git and agent files keeps them and gains the rules, import and skill', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'workspace');
  const files = {
    '.git/HEAD': 'ref: refs/heads/main\n',
    'AGENTS.md': `# Team rules\n\nBe brief.\n\n${nextRules}`,
    'CLAUDE.md': '# Claude\n\nUse tabs.\n',
    '.claude/settings.local.json': '{ "permissions": { "allow": [] } }\n',
    '.agents/skills/bitakit-app-development/SKILL.md': 'team copy\n',
    '.gitignore': 'node_modules/\n.env\n',
    '.vscode/settings.json': '{ "editor.tabSize": 2 }\n',
  };
  await seed(target, files);
  const plan = await planProject(target, { install: false });
  assert.deepEqual(plan.existing, [
    '.agents',
    '.claude',
    '.git',
    '.gitignore',
    '.vscode',
    'AGENTS.md',
    'CLAUDE.md',
  ]);
  const { kept } = await createProject(plan, {
    run: async (command, args) => {
      // create-next-app's managed block is already present in the user's file.
      await scaffoldNextWithRules(command, args);
      await mkdir(path.join(args[1], '.vscode'));
      await writeFile(path.join(args[1], '.vscode/settings.json'), '{}\n');
    },
  });
  // The user's files win over generated ones, and the caller learns which were not applied.
  assert.deepEqual(kept.sort(), [
    '.agents/skills/bitakit-app-development',
    '.vscode/settings.json',
  ]);
  assert.equal(await read(target, '.vscode/settings.json'), files['.vscode/settings.json']);
  assert.equal(await read(target, '.git/HEAD'), files['.git/HEAD']);
  assert.equal(
    await read(target, '.claude/settings.local.json'),
    files['.claude/settings.local.json'],
  );
  assertMergedRules(
    await read(target, 'AGENTS.md'),
    `# Team rules\n\nBe brief.\n\n${nextRules}\n<!-- BEGIN:bitakit-agent-rules -->`,
  );
  assert.equal(await read(target, 'CLAUDE.md'), '# Claude\n\nUse tabs.\n\n@AGENTS.md\n');
  // Missing generated lines go first, so the user's own patterns still win.
  assert.equal(
    await read(target, '.gitignore'),
    '# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n\nnode_modules/\n.env\n',
  );
  // An existing skill folder is preserved whole; the other agent folder gains the skill.
  assert.equal(
    await read(target, '.agents/skills/bitakit-app-development/SKILL.md'),
    'team copy\n',
  );
  await missing(target, '.agents/skills/bitakit-app-development/references');
  await exists(target, '.claude/skills/bitakit-app-development/references/slots.md');
  await exists(target, 'next.config.ts');
  assert.deepEqual(await readdir(root), ['workspace']);
});

test('a plain AGENTS.md gains the framework rules and then the BitaKit rules', async (t) => {
  const target = path.join(await workspace(t), 'here');
  await seed(target, { 'AGENTS.md': '# Team rules\n' });
  const plan = await planProject(target, { install: false });
  await createProject(plan, { run: scaffoldNextWithRules });
  const rules = await read(target, 'AGENTS.md');
  assertMergedRules(rules, '# Team rules\n\n<!-- BEGIN:nextjs-agent-rules -->');
  assert.equal(await read(target, 'CLAUDE.md'), '@AGENTS.md\n');
});

test('linked AGENTS.md and CLAUDE.md get the rules once and no self-import', async (t) => {
  const root = await workspace(t);
  for (const [link, file] of [
    ['AGENTS.md', 'CLAUDE.md'],
    ['CLAUDE.md', 'AGENTS.md'],
  ]) {
    const target = path.join(root, `linked-${file.toLowerCase().replace('.md', '')}`);
    await seed(target, { [file]: '# Team rules\n' });
    await symlink(file, path.join(target, link));
    const plan = await planProject(target, { install: false });
    const { kept } = await createProject(plan, { run: scaffoldNextWithRules });
    assert.deepEqual(kept, []);
    const rules = await read(target, file);
    assertMergedRules(rules, '# Team rules\n\n<!-- BEGIN:nextjs-agent-rules -->');
    assert.doesNotMatch(rules, /^@AGENTS\.md/m);
    assert.equal(await read(target, link), rules);
  }
});

test('a link out of the project or a dangling link is kept and reported', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'here');
  await seed(root, { 'shared/AGENTS.md': '# Shared rules\n' });
  await mkdir(target);
  await symlink(path.join(root, 'shared/AGENTS.md'), path.join(target, 'AGENTS.md'));
  await symlink('missing.md', path.join(target, 'CLAUDE.md'));
  const plan = await planProject(target, { install: false });
  const { kept } = await createProject(plan, { run: scaffoldNextWithRules });
  assert.deepEqual(kept.sort(), ['AGENTS.md', 'CLAUDE.md']);
  assert.equal(await read(root, 'shared/AGENTS.md'), '# Shared rules\n');
});

test("generated .gitignore lines go first, so the user's negations stay effective", async (t) => {
  const target = path.join(await workspace(t), 'here');
  const own = '# dotenv environment variable files\n.env\n.env.*\n!.env.example\n';
  await seed(target, { '.gitignore': own, LICENSE: 'MIT\n' });
  const plan = await planProject(target, { install: false });
  await createProject(plan, {
    run: async (command, args) => {
      await scaffoldNext(command, args);
      await writeFile(path.join(args[1], '.gitignore'), 'node_modules/\n\n# env files\n.env*\n');
    },
  });
  assert.equal(
    await read(target, '.gitignore'),
    `node_modules/\n\n# env files\n.env*\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n\n${own}`,
  );
});

test('a failed scaffold leaves the existing folder unchanged and removes the staging folder', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'here');
  await mkdir(target);
  await writeFile(path.join(target, 'AGENTS.md'), '# Rules\n');
  const plan = await planProject(target, { install: false });
  await assert.rejects(
    createProject(plan, {
      run: async (command, args) => {
        await scaffoldNext(command, args);
        throw new Error('Scaffold failed');
      },
    }),
    (error) => error.targetUnchanged && /Scaffold failed/.test(error.message),
  );
  assert.deepEqual(await readdir(root), ['here']);
  assert.deepEqual(await readdir(target), ['AGENTS.md']);
  assert.equal(await read(target, 'AGENTS.md'), '# Rules\n');
});

// Directory permissions do not restrict root, and Windows ignores the mode bits used here.
const permissions = process.platform !== 'win32' && process.getuid?.() !== 0;

test(
  'without write access next to the folder, staging happens inside it',
  { skip: !permissions && 'directory permissions are not enforced' },
  async (t) => {
    const root = await workspace(t);
    const parent = path.join(root, 'locked');
    const target = path.join(parent, 'here');
    await mkdir(target, { recursive: true });
    const plan = await planProject(target, { type: 'plugin', install: false });
    let scaffolded;
    await chmod(parent, 0o555);
    try {
      await createProject(plan, {
        run: async (command, args) => {
          scaffolded = args[1];
          await scaffoldNext(command, args);
        },
      });
    } finally {
      await chmod(parent, 0o755);
    }
    // <target>/<staging>/here/playground; nothing is left behind in either folder.
    assert.equal(path.dirname(path.dirname(path.dirname(scaffolded))), target);
    assert.deepEqual(await readdir(parent), ['here']);
    assert.ok((await readdir(target)).every((entry) => !entry.startsWith('.bitakit-staging-')));
    // Plugin packages use the same mechanism.
    assert.equal(JSON.parse(await read(target, 'package.json')).name, 'here');
    await exists(target, 'playground/next.config.ts');
  },
);

test('the package name comes from the folder name', async (t) => {
  const root = await workspace(t);
  await mkdir(path.join(root, 'My App'));
  await assert.rejects(
    planProject(path.join(root, 'My App')),
    /Invalid project name "My App": .*rename the folder or choose a new directory/,
  );
});

test('defaults to the full app frame and resolves prerequisites before writing', async (t) => {
  const root = await workspace(t);
  const target = path.join(root, 'app');
  assert.deepEqual((await planProject(target)).features, ['preferences', 'shell', 'quick-search']);
  assert.deepEqual((await planProject(target, { features: [] })).features, []);
  assert.deepEqual((await planProject(target, { features: ['quick-search'] })).features, [
    'preferences',
    'shell',
    'quick-search',
  ]);
  const plugin = await planProject(target, { type: 'plugin', features: [], sample: true });
  assert.equal(plugin.type, 'plugin');
  assert.equal(plugin.sample, false);
  assert.deepEqual(plugin.features, ['preferences', 'shell', 'quick-search']);
  await assert.rejects(planProject(target, { framework: 'unsupported' }), /Unsupported framework/);
  await assert.rejects(planProject(target, { features: ['unknown'] }), /Unknown feature/);
  await assert.rejects(planProject(target, { type: 'widget' }), /Unknown project type/);
  await assert.rejects(planProject(path.join(root, 'Bad Name')), /Invalid project name/);
  await missing(root, 'app');
});

test('a bare app wraps next.config, mounts one provider, imports one generated stylesheet and renders plugin pages', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), { features: [], install: false });
  await createApp(plan, { run: scaffoldNext });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  assert.equal(manifest.dependencies['@bitakit/shell'], undefined);
  for (const name of ['core', 'ui', 'next'])
    assert.equal(manifest.dependencies[`@bitakit/${name}`], bitakitRange);
  assert.equal(manifest.devDependencies['@bitakit/cli'], bitakitRange);
  assert.equal(manifest.devDependencies['@bitakit/discovery'], bitakitRange);
  assert.deepEqual(manifest.scripts, {
    dev: 'next dev',
    build: 'next build',
    typecheck: 'bitakit generate && next typegen && tsc --noEmit',
  });
  // The scaffold's configuration is wrapped, not replaced, so Tailwind's loader keeps running.
  assert.equal(
    await read(plan.target, 'next.config.ts'),
    scaffoldedNextConfig
      .replace(
        'import type { NextConfig } from "next";',
        'import type { NextConfig } from "next";\nimport { withBitaKit } from \'@bitakit/next/config\';',
      )
      .replace('export default nextConfig;', 'export default withBitaKit(nextConfig);'),
  );
  const layout = await read(plan.target, 'src/app/layout.tsx');
  assert.match(layout, /import \{ BitaKitProvider \} from '@\/bitakit\.gen';/);
  assert.equal(layout.match(/<BitaKitProvider>/g).length, 1);
  assert.doesNotMatch(layout, /BitaKitRuntimeProvider|NuqsAdapter/);
  // The theme script belongs to the Shell; without it the layout stays plain.
  assert.doesNotMatch(layout, /ShellThemeScript|suppressHydrationWarning|<head>/);
  assert.equal(
    await read(plan.target, 'src/app/globals.css'),
    "@layer theme, base, components, utilities;\n@import 'tailwindcss';\n/* Styles of the installed BitaKit packages, generated by discovery. Add your own CSS below. */\n@import '../bitakit.gen.css';\n",
  );
  assert.match(
    await read(plan.target, 'src/app/[...path]/page.tsx'),
    /<PluginPage fallback=\{<PageHeader title="Page not found" \/>\} \/>/,
  );
  await exists(plan.target, 'src/app/page.tsx');
  await missing(plan.target, 'src/app/settings');
  await missing(plan.target, 'src/plugins');
  await missing(plan.target, 'src/configs');
  const rules = await read(plan.target, 'AGENTS.md');
  // Claude Code loads CLAUDE.md, not AGENTS.md; create-next-app writes only the latter.
  assert.equal(await read(plan.target, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(rules, /^<!-- next rules -->\n\n<!-- BEGIN:bitakit-agent-rules -->/);
  assert.match(rules, /npx bitakit add plugin <name>/);
  assert.match(rules, /`ui\/pages\/<path>\.tsx`/);
  assert.match(rules, /App-owned routes stay native framework routes in `src\/app`/);
  assert.match(rules, /Never edit generated files: `src\/bitakit\.gen\.\*`/);
  assert.match(rules, /bitakit-app-development\/SKILL\.md/);
  const skill = await read(plan.target, '.agents/skills/bitakit-app-development/SKILL.md');
  assert.match(skill, /^---\nname: bitakit-app-development\n/);
  // The installed copy records the CLI release, so `bitakit init --update-agent-files` can tell
  // an unedited copy from a team's edit.
  assert.match(
    skill,
    /\nmetadata:\n {2}bitakit-version: "[^"]+"\n {2}bitakit-checksum: "[0-9a-f]{64}"\n---\n/,
  );
  assert.equal(await read(plan.target, '.claude/skills/bitakit-app-development/SKILL.md'), skill);
  // The references travel with SKILL.md, so its links resolve in both agent folders.
  for (const folder of ['.agents', '.claude'])
    assert.deepEqual(
      await readSkillFiles(path.join(plan.target, folder, 'skills/bitakit-app-development')),
      await bundledSkillFiles(),
      folder,
    );
  // One screen: the block may change, but it must not grow back past this budget.
  const block = rules.slice(rules.indexOf('<!-- BEGIN:bitakit-agent-rules -->'));
  assert.ok(block.length <= 3200, `agent rules are ${block.length} characters; the budget is 3200`);
  assert.ok(block.split('\n').length <= 40, 'agent rules fit on one screen');
  assert.equal(
    await read(plan.target, '.gitignore'),
    'node_modules/\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n',
  );
  assert.doesNotMatch(await read(plan.target, 'README.md'), /Todo sample/);
});

test('an existing CLAUDE.md from the scaffold keeps its text and gains the AGENTS.md import', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), { install: false });
  await createApp(plan, {
    run: async (command, args) => {
      await scaffoldNext(command, args);
      await writeFile(path.join(args[1], 'CLAUDE.md'), '# Team rules\n\nUse tabs.\n');
    },
  });
  assert.equal(await read(plan.target, 'CLAUDE.md'), '# Team rules\n\nUse tabs.\n\n@AGENTS.md\n');
});

test('the shell app adds the App Shell, settings, a not-found fallback and the Todos sample', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'), { install: false, sample: true });
  await createApp(plan, { run: scaffoldNext });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  for (const name of ['app-preferences', 'shell', 'quick-search'])
    assert.equal(manifest.dependencies[`@bitakit/${name}`], bitakitRange);
  assert.match(
    await read(plan.target, 'src/app/(app)/layout.tsx'),
    /<AppShell>\{children\}<\/AppShell>/,
  );
  const shellLayout = await read(plan.target, 'src/app/layout.tsx');
  assert.match(shellLayout, /import \{ ShellThemeScript \} from '@bitakit\/shell';/);
  assert.match(shellLayout, /<html lang="en" suppressHydrationWarning>/);
  assert.match(shellLayout, /<head>\n\s+<ShellThemeScript \/>\n\s+<\/head>\n\s+<body>/);
  assert.equal(shellLayout.match(/<BitaKitProvider>/g).length, 1);
  assert.match(
    await read(plan.target, 'src/app/(app)/[...path]/page.tsx'),
    /<PluginPage fallback=\{<NotFoundPage \/>\} \/>/,
  );
  assert.match(
    await read(plan.target, 'src/app/settings/[[...section]]/page.tsx'),
    /<SettingsRoute \/>/,
  );
  // Next.js error files render Shell's replaceable screens.
  assert.match(
    await read(plan.target, 'src/app/(app)/error.tsx'),
    /export default function Error\(\{ retry \}[\s\S]*<ErrorPage reset=\{retry\} \/>/,
  );
  assert.match(
    await read(plan.target, 'src/app/not-found.tsx'),
    /<AppShell layout="error">\s*<NotFoundPage \/>\s*<\/AppShell>/,
  );
  assert.match(
    await read(plan.target, 'src/configs/shell.ts'),
    /export default defineConfig\(\{[\s\S]*navigationSlot: 'shell\.navigation',[\s\S]*\} satisfies ShellOptions/,
  );
  await missing(plan.target, 'src/app/page.tsx');
  await missing(plan.target, 'src/app/[...path]');
  assert.match(await read(plan.target, 'src/app/(app)/page.tsx'), /Open Todos in the navigation/);
  const todos = (file) => path.join(plan.target, 'src/plugins/todos', file);
  for (const file of [
    'services/list.ts',
    'settings.ts',
    'events.ts',
    'slots/footer.ts',
    'actions/add.ts',
    'actions/remove.ts',
    'actions/clear.ts',
    'actions/open.ts',
    'ui/pages/index.tsx',
  ])
    await access(todos(file));
  // A second plugin listens to todos.changed and fills todos.footer without editing todos.
  const activity = (file) => path.join(plan.target, 'src/plugins/activity', file);
  assert.match(
    await readFile(activity('services/feed.ts'), 'utf8'),
    /events\.on\('todos\.changed'/,
  );
  await access(activity('ui/slots/todos.footer.tsx'));
  assert.match(
    await readFile(todos('ui/pages/index.tsx'), 'utf8'),
    /<PluginSlot name="todos\.footer" \/>/,
  );
  assert.match(await readFile(todos('ui/pages/index.tsx'), 'utf8'), /<Button type="submit" \/>/);
  await assert.rejects(access(todos('pages')));
  assert.match(await readFile(todos('actions/open.ts'), 'utf8'), /href: '\/todos'/);
  assert.match(
    await readFile(todos('ui/pages/index.tsx'), 'utf8'),
    /useServiceState\('todos\.list', \(state\) => state\.todos, \[\]\)/,
  );
  const readme = await read(plan.target, 'README.md');
  assert.match(readme, /Todo sample is a working example in two plugins/);
  assert.match(readme, /`src\/plugins\/<name>\/ui\/pages`/);
  assert.match(readme, /`src\/configs\/shell\.ts`/);
});

test('CLI dry-run does not create files and unsupported framework exits with an error', async (t) => {
  const root = await workspace(t);
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const target = path.join(root, 'app');
  const result = await execa(process.execPath, [
    cli,
    target,
    '--features',
    'quick-search',
    '--sample',
    '--dry-run',
    '--yes',
  ]);
  assert.match(result.stdout, /preferences, shell, quick-search/);
  assert.match(result.stdout, /Todo \(todos \+ activity plugins\)/);
  await missing(root, 'app');
  const plugin = await execa(process.execPath, [
    cli,
    path.join(root, 'widget'),
    '--plugin',
    '--dry-run',
    '--yes',
  ]);
  assert.match(plugin.stdout, /plugin package with a Next\.js playground/);
  await missing(root, 'widget');
  const rejected = await execa(
    process.execPath,
    [cli, target, '--framework', 'unsupported', '--yes'],
    { reject: false },
  );
  assert.notEqual(rejected.exitCode, 0);
  await missing(root, 'app');
});

test('CLI dry-run with . states that the app is created in the existing folder', async (t) => {
  const root = await workspace(t);
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const target = path.join(root, 'here');
  await mkdir(path.join(target, '.git'), { recursive: true });
  await writeFile(path.join(target, 'AGENTS.md'), '# Rules\n');
  const result = await execa(process.execPath, [cli, '.', '--dry-run', '--yes'], { cwd: target });
  assert.match(
    result.stdout,
    /Folder: +existing; the app is created in it, next to \.git, AGENTS\.md/,
  );
  assert.deepEqual(await readdir(target), ['.git', 'AGENTS.md']);
  await writeFile(path.join(target, 'index.html'), '');
  const rejected = await execa(process.execPath, [cli, '.', '--dry-run', '--yes'], {
    cwd: target,
    reject: false,
  });
  assert.notEqual(rejected.exitCode, 0);
  assert.match(rejected.stderr, /also contains index\.html/);
});

// Runs the real create-next-app, which copies its template without network access when it
// does not install.
test('CLI creates the app in the current folder and reports kept files and failures', async (t) => {
  const root = await workspace(t);
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const target = path.join(root, 'here');
  await seed(target, {
    '.git/HEAD': 'ref: refs/heads/main\n',
    'AGENTS.md': '# Team rules\n',
    '.agents/skills/bitakit-app-development/SKILL.md': 'team copy\n',
  });
  const args = ['.', '--yes', '--no-install', '--features', 'none'];
  const { stdout } = await execa(process.execPath, [cli, ...args], { cwd: target });
  assert.match(stdout, /Generating in a temporary folder, then moving it into \S*here\./);
  assert.match(
    stdout,
    /Kept your own \.agents\/skills\/bitakit-app-development; the generated versions were not applied\./,
  );
  assert.doesNotMatch(stdout, /^cd /m);
  assert.match(stdout, /Start a new session so it loads the new AGENTS\.md and skill\./);
  assertMergedRules(
    await read(target, 'AGENTS.md'),
    '# Team rules\n\n<!-- BEGIN:nextjs-agent-rules',
  );
  assert.equal(await read(target, 'CLAUDE.md'), '@AGENTS.md\n');
  await exists(target, 'next.config.ts');
  assert.deepEqual(await readdir(root), ['here']);

  const broken = path.join(root, 'broken');
  await seed(broken, { 'AGENTS.md': '# Team rules\n' });
  const failed = await execa(
    process.execPath,
    [cli, ...args, '--packages-dir', path.join(root, 'missing')],
    { cwd: broken, reject: false },
  );
  assert.notEqual(failed.exitCode, 0);
  assert.match(failed.stderr, /Nothing in \S*broken was changed\./);
  assert.deepEqual(await readdir(broken), ['AGENTS.md']);
  assert.deepEqual((await readdir(root)).sort(), ['broken', 'here']);
});

test('installation failures propagate and leave generated files available for inspection', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'app'));
  await assert.rejects(
    createApp(plan, {
      run: async (command, args) => {
        if (command === 'npm') throw new Error('Registry unavailable');
        await scaffoldNext(command, args);
      },
    }),
    /Registry unavailable/,
  );
  await exists(plan.target, 'package.json');
  await exists(plan.target, 'next.config.ts');
});

test('TanStack apps get the same frame through native file routes and the Vite plugin', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'start'), {
    framework: 'tanstack',
    install: false,
  });
  await createApp(plan, { run: scaffoldStart });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  assert.equal(manifest.dependencies['@bitakit/tanstack'], bitakitRange);
  assert.equal(manifest.dependencies['@bitakit/next'], undefined);
  assert.equal(manifest.dependencies['@bitakit/shell'], bitakitRange);
  assert.ok(manifest.dependencies['@tanstack/react-start']);
  assert.ok(manifest.devDependencies.tailwindcss);
  assert.deepEqual(manifest.scripts, {
    dev: 'vite dev',
    build: 'vite build',
    typecheck: 'bitakit generate && tsr generate && tsc --noEmit',
  });
  const vite = await read(plan.target, 'vite.config.ts');
  assert.match(vite, /import \{ bitakit \} from '@bitakit\/tanstack\/config';/);
  assert.match(vite, /plugins: \[bitakit\(\), tanstackStart\(\), react\(\), tailwindcss\(\)\]/);
  const rootRoute = await read(plan.target, 'src/routes/__root.tsx');
  assert.match(rootRoute, /import \{ BitaKitProvider \} from '\.\.\/bitakit\.gen';/);
  assert.equal(rootRoute.match(/<BitaKitProvider>/g).length, 1);
  assert.doesNotMatch(rootRoute, /BitaKitRuntimeProvider/);
  assert.match(rootRoute, /import \{ ShellThemeScript \} from '@bitakit\/shell';/);
  assert.match(rootRoute, /<head>\n\s+<HeadContent \/>\n\s+<ShellThemeScript \/>\n\s+<\/head>/);
  // ShellThemeScript sets the color scheme on <html> before hydration, as in the Next template.
  assert.match(rootRoute, /<html lang="en" suppressHydrationWarning>/);
  const appRoute = await read(plan.target, 'src/routes/_app.tsx');
  assert.match(appRoute, /<AppShell>/);
  // Errors and notFound() render Shell's replaceable screens, as in Next.js apps.
  assert.match(
    appRoute,
    /errorComponent: \(\{ reset \}\) => \([\s\S]*<ErrorPage reset=\{reset\} \/>/,
  );
  assert.match(appRoute, /notFoundComponent: \(\) => \([\s\S]*<AppShell layout="error">/);
  assert.match(
    await read(plan.target, 'src/routes/_app.$.tsx'),
    /<PluginPage fallback=\{<NotFoundPage \/>\} \/>/,
  );
  assert.match(await read(plan.target, 'src/routes/settings.$.tsx'), /SettingsRoute/);
  assert.equal(
    await read(plan.target, 'src/styles.css'),
    "@layer theme, base, components, utilities;\n@import 'tailwindcss';\n/* Styles of the installed BitaKit packages, generated by discovery. Add your own CSS below. */\n@import './bitakit.gen.css';\n",
  );
  await missing(plan.target, 'src/routes/index.tsx');
  assert.equal(await read(plan.target, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.equal(
    await read(plan.target, '.claude/skills/bitakit-app-development/SKILL.md'),
    await read(plan.target, '.agents/skills/bitakit-app-development/SKILL.md'),
  );
  await exists(plan.target, '.agents/skills/bitakit-app-development/references/slots.md');
  assert.match(
    await read(plan.target, 'AGENTS.md'),
    /App-owned routes stay native framework routes in `src\/routes`/,
  );
  assert.equal(
    await read(plan.target, '.gitignore'),
    'node_modules/\ndist/\n.env*\n\n# Generated by BitaKit discovery\nsrc/bitakit.gen.*\n',
  );
});

test('a plugin package has the same folders as an app plugin, a headless test and a playground', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'my-notes'), { type: 'plugin', install: false });
  await createProject(plan, { run: scaffoldNext });
  const manifest = JSON.parse(await read(plan.target, 'package.json'));
  assert.equal(manifest.name, 'my-notes');
  assert.deepEqual(manifest.bitakit, { plugin: './plugin', id: 'my-notes' });
  assert.deepEqual(manifest.exports, {
    './package.json': './package.json',
    './plugin': { types: './dist/plugin.d.ts', default: './dist/plugin.js' },
  });
  assert.deepEqual(manifest.files, ['dist']);
  assert.deepEqual(manifest.workspaces, ['playground']);
  assert.equal(manifest.dependencies, undefined);
  for (const name of ['@bitakit/core', '@bitakit/ui'])
    assert.equal(manifest.peerDependencies[name], bitakitRange);
  assert.equal(manifest.peerDependencies.react, '^19.0.0');
  // One React: the plugin develops against the playground's exact version.
  assert.equal(manifest.devDependencies.react, '19.2.0');
  assert.equal(manifest.devDependencies['react-dom'], '19.2.0');
  assert.equal(manifest.devDependencies['@bitakit/cli'], bitakitRange);
  assert.equal(manifest.devDependencies['@bitakit/discovery'], bitakitRange);
  assert.equal(manifest.scripts.build, 'bitakit build');
  assert.equal(manifest.scripts.typecheck, 'bitakit build --check');
  assert.equal(manifest.scripts.test, 'node --test tests/*.test.ts');
  assert.equal(manifest.scripts.dev, 'npm run dev --workspace playground');
  const tsconfig = JSON.parse(await read(plan.target, 'tsconfig.json'));
  assert.deepEqual(tsconfig.include, ['src', '.bitakit/plugin.d.ts']);
  assert.equal(tsconfig.compilerOptions.rootDir, 'src');
  const spec = await read(plan.target, 'tests/my-notes.test.ts');
  assert.match(spec, /import \{ mountPlugin \} from '@bitakit\/core\/testing';/);
  assert.match(spec, /const plugin = await mountPlugin\('src'\);/);
  assert.match(spec, /await plugin\.execute\('add', 'First entry'\);/);
  assert.match(spec, /\.list\.state\.get\(\)\.entries;/);
  assert.match(
    spec,
    /plugin\.events\.recorded\.some\(\(event\) => event\.type === 'my-notes\.changed'\)/,
  );
  assert.match(spec, /plugin\.actions\.get\('my-notes\.clear'\)\?\.enabled/);
  for (const file of [
    'services/list.ts',
    'events.ts',
    'actions/add.ts',
    'actions/remove.ts',
    'actions/clear.ts',
    'actions/open.ts',
    'ui/pages/index.tsx',
  ])
    await exists(plan.target, `src/${file}`);
  assert.match(
    await read(plan.target, 'src/actions/add.ts'),
    /services\["my-notes"\]\.list\.add\(input\)/,
  );
  assert.match(await read(plan.target, '.gitignore'), /^node_modules\/\ndist\/\n\.bitakit\/\n/);
  assert.match(
    await read(plan.target, 'AGENTS.md'),
    /# BitaKit plugin package[\s\S]*the ID "my-notes"[\s\S]*`src\/ui\/pages\/<path>\.tsx`/,
  );
  assert.equal(await read(plan.target, 'CLAUDE.md'), '@AGENTS.md\n');
  assert.match(await read(plan.target, 'README.md'), /npm install my-notes/);

  const playground = path.join(plan.target, 'playground');
  const playgroundManifest = JSON.parse(await read(playground, 'package.json'));
  assert.equal(playgroundManifest.name, 'my-notes-playground');
  assert.equal(playgroundManifest.private, true);
  assert.equal(playgroundManifest.dependencies['@bitakit/devtools'], bitakitRange);
  assert.equal(playgroundManifest.dependencies['@bitakit/shell'], bitakitRange);
  assert.equal(playgroundManifest.overrides, undefined);
  assert.equal(
    await read(playground, 'bitakit.config.ts'),
    "import { defineBitaKit } from '@bitakit/discovery';\n\n// Discover the plugin straight from ../src, so edits reload instantly.\nexport default defineBitaKit({ plugins: { include: { \"my-notes\": '../src' } } });\n",
  );
  assert.match(
    await read(playground, 'src/app/(app)/page.tsx'),
    /import \{ Inspector \} from '@bitakit\/devtools';[\s\S]*<Inspector plugin="my-notes" \/>/,
  );
  assert.match(await read(playground, 'src/app/layout.tsx'), /<BitaKitProvider>/);
  assert.match(
    await read(playground, 'next.config.ts'),
    /export default withBitaKit\(nextConfig\);/,
  );
  await exists(playground, 'src/app/(app)/[...path]/page.tsx');
  await missing(playground, 'src/plugins');
});

test('a TanStack playground opens the Inspector on its index route', async (t) => {
  const root = await workspace(t);
  const plan = await planProject(path.join(root, 'start-notes'), {
    type: 'plugin',
    framework: 'tanstack',
    install: false,
  });
  await createProject(plan, { run: scaffoldStart });
  const playground = path.join(plan.target, 'playground');
  assert.equal(
    await read(playground, 'src/routes/_app.index.tsx'),
    "import { createFileRoute } from '@tanstack/react-router';\nimport { Inspector } from '@bitakit/devtools';\n\nexport const Route = createFileRoute('/_app/')({ component: () => <Inspector plugin=\"start-notes\" /> });\n",
  );
  assert.match(await read(playground, 'bitakit.config.ts'), /"start-notes": '\.\.\/src'/);
  assert.match(await read(playground, 'vite.config.ts'), /bitakit\(\)/);
  assert.match(await read(plan.target, 'README.md'), /A TanStack Start app to try the plugin in/);
  assert.equal(JSON.parse(await read(plan.target, 'package.json')).devDependencies.react, '19.2.0');
});

test('local tarballs replace every @bitakit dependency, including dev tools', async (t) => {
  const root = await workspace(t);
  const tarballs = path.join(root, 'tarballs');
  await mkdir(tarballs);
  for (const name of ['core', 'ui', 'next', 'cli'])
    await writeFile(path.join(tarballs, `bitakit-${name}-0.2.0.tgz`), '');
  const target = path.join(root, 'app');
  await mkdir(target);
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({
      dependencies: {
        '@bitakit/core': '^0.2.0',
        '@bitakit/ui': '^0.2.0',
        '@bitakit/next': '^0.2.0',
      },
      devDependencies: { '@bitakit/cli': '^0.2.0' },
    }),
  );
  await useLocalPackages(target, tarballs);
  const manifest = JSON.parse(await read(target, 'package.json'));
  assert.equal(
    manifest.devDependencies['@bitakit/cli'],
    `file:${path.join(tarballs, 'bitakit-cli-0.2.0.tgz')}`,
  );
  assert.equal(
    manifest.overrides['@bitakit/core'],
    `file:${path.join(tarballs, 'bitakit-core-0.2.0.tgz')}`,
  );
  await writeFile(
    path.join(target, 'package.json'),
    JSON.stringify({ dependencies: { '@bitakit/shell': '^0.2.0' } }),
  );
  await assert.rejects(
    useLocalPackages(target, tarballs),
    /Missing npm tarball for @bitakit\/shell/,
  );
});
