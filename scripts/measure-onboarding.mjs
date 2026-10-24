#!/usr/bin/env node
// Measures the numbers on the docs page "Why BitaKit": how much tested package code an app
// receives, how much code the generated Todo sample adds, and how much an agent reads to learn
// the conventions. Tokens are counted with the open o200k tokenizer (gpt-tokenizer); other
// models' tokenizers differ, so the counts are approximate, but every count uses the same one.
// Usage: node scripts/measure-onboarding.mjs [--json] [--write]
// --write stores the result in apps/docs/components/diagrams/measurements.json for the docs charts.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { agentRules, bundledSkillFiles, sampleFiles } from '@bitakit/cli';

const root = path.resolve(import.meta.dirname, '..');
// The packages a default app (Shell, Settings, Quick Search) runs on, plus discovery and the CLI.
const packages = [
  'core',
  'ui',
  'discovery',
  'next',
  'shell',
  'app-preferences',
  'quick-search',
  'cli',
];
const source = /\.(ts|tsx|mjs|css)$/;

async function files(directory, pattern) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true }).catch(
    () => [],
  );
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function measure(texts) {
  return {
    files: texts.length,
    lines: texts.reduce((sum, text) => sum + text.split('\n').length, 0),
    tokens: texts.reduce((sum, text) => sum + countTokens(text), 0),
  };
}

const read = (list) => Promise.all(list.map((file) => readFile(file, 'utf8')));
const rows = [];
for (const name of packages) {
  const dir = path.join(root, 'packages', name);
  const code = measure(await read(await files(path.join(dir, 'src'), source)));
  const tests = (await read(await files(path.join(dir, 'tests'), /\.(mjs|ts|tsx)$/))).reduce(
    (sum, text) => sum + (text.match(/^\s*test(\.\w+)?\(/gm)?.length ?? 0),
    0,
  );
  rows.push({ package: `@bitakit/${name}`, ...code, tests });
}
const total = rows.reduce(
  (sum, row) => ({
    files: sum.files + row.files,
    lines: sum.lines + row.lines,
    tokens: sum.tokens + row.tokens,
    tests: sum.tests + row.tests,
  }),
  { files: 0, lines: 0, tokens: 0, tests: 0 },
);

const sample = sampleFiles({ navigationSlot: 'shell.navigation' });
const plugins = [...new Set(Object.keys(sample).map((file) => file.split('/')[0]))];
const feature = {
  plugins,
  ...measure(Object.values(sample)),
  // Every sample path is relative to src/plugins/<plugin>/, so nothing outside them changes.
  sharedFiles: Object.keys(sample).filter((file) => !plugins.includes(file.split('/')[0])).length,
};

// The plugins of the Workspace sample app, one folder each.
const pluginsDir = path.join(root, 'examples/workspace/src/plugins');
const workspace = [];
for (const name of (await readdir(pluginsDir)).sort()) {
  const list = await files(path.join(pluginsDir, name), source);
  workspace.push({ plugin: name, ...measure(await read(list)) });
}

// The rules a default Next.js app with Shell gets in AGENTS.md, and its bundled skill.
const rules = agentRules({ routes: 'src/app', shell: true });
const skill = await bundledSkillFiles();
const guide = {
  agentsMd: countTokens(rules),
  skillEntry: countTokens(skill.find(([file]) => file === 'SKILL.md')?.[1] ?? ''),
  skillReferences: skill
    .filter(([file]) => file !== 'SKILL.md')
    .reduce((sum, [, text]) => sum + countTokens(text), 0),
};

const result = {
  tokenizer: 'o200k_base (gpt-tokenizer)',
  packages: rows,
  total,
  feature,
  workspace,
  guide,
};
if (process.argv.includes('--write'))
  await writeFile(
    path.join(root, 'apps/docs/components/diagrams/measurements.json'),
    JSON.stringify(result, null, 2) + '\n',
  );
if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  const n = (value) => value.toLocaleString('en-US');
  console.log(
    '| Package | Source files | Lines | Tokens | Tests |\n| --- | --: | --: | --: | --: |',
  );
  for (const row of [...rows, { package: 'Total', ...total }])
    console.log(
      `| ${row.package} | ${n(row.files)} | ${n(row.lines)} | ${n(row.tokens)} | ${n(row.tests)} |`,
    );
  console.log(
    `\nTodo sample: ${plugins.join(' + ')} — ${feature.files} files, ${n(feature.lines)} lines, ` +
      `${n(feature.tokens)} tokens, ${feature.sharedFiles} shared files changed.`,
  );
  console.log(
    `Workspace sample: ${workspace.map((row) => `${row.plugin} ${row.files} files ${n(row.tokens)} tokens`).join(', ')}.`,
  );
  console.log(
    `Agent guide: AGENTS.md ${n(guide.agentsMd)} tokens, skill entry ${n(guide.skillEntry)}, ` +
      `references ${n(guide.skillReferences)} (read on demand).`,
  );
}
