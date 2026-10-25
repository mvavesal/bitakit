#!/usr/bin/env node
// Measures the numbers on the docs page "Why BitaKit": how much tested package code an app
// receives, how much code the generated Todo sample adds, and how much an agent reads to learn
// the conventions. Tokens are counted with the open o200k tokenizer (gpt-tokenizer); other
// models' tokenizers differ, so the counts are approximate, but every count uses the same one.
// The "same Todo app, two ways" comparison pairs measured sample files with documented estimates.
// Usage: node scripts/measure-onboarding.mjs [--json] [--write]
// --write stores the result in apps/docs/components/diagrams/measurements.json for the docs charts.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import { format } from 'prettier';
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

// The Todo app with settings, themes and layouts, two ways. The BitaKit column is measured from
// the sample apps' own files. The usual column is an estimate, not a measurement: the same
// capabilities hand-written on Next.js with standard libraries (shadcn/ui, next-themes, sonner,
// cmdk and a persisted store). Both exclude the framework scaffold, which either way is generated.
const examples = path.join(root, 'examples');
const capabilities = [
  {
    capability: 'Todo feature (list, page)',
    usual: 1800,
    files: ['todo/src/plugins/todos/services/list.ts', 'todo/src/plugins/todos/ui/pages/index.tsx'],
  },
  {
    capability: 'UI actions: shared state, guards, confirmation, feedback',
    usual: 1200,
    files: ['add', 'toggle', 'remove', 'clear-done'].map(
      (name) => `todo/src/plugins/todos/actions/${name}.ts`,
    ),
  },
  {
    capability: 'App frame and navigation',
    usual: 2000,
    files: ['todo/src/plugins/todos/actions/open.ts'],
  },
  { capability: 'Search (Mod+K)', usual: 1100, files: [] },
  {
    capability: 'App settings and their pages',
    usual: 2200,
    files: ['settings/src/plugins/greeting/settings.ts'],
  },
  { capability: 'Theming', usual: 1500, files: ['theme/src/themes/sunset.json'] },
  {
    capability: 'Layouts and error screens',
    usual: 900,
    files: [
      'layouts/src/layouts/auth/split.tsx',
      'layouts/src/ui/slots/screen.not-found.tsx',
      'layouts/src/ui/slots/screen.error.tsx',
    ],
  },
  // BitaKit's packages ship with their tests; hand-written infrastructure needs its own.
  { capability: 'Tests for that infrastructure', usual: 3500, files: [] },
];
// Rough assumptions, stated on the page: an agent session processes about 50 tokens for every
// token of code it keeps (reading, context resent each turn, checks, retries); BitaKit's agent
// also keeps AGENTS.md and the skill entry in context for about 25 turns; list price of Claude
// Opus 5.5 with 90% input ($4 per million) and 10% output ($20 per million).
const assumptions = {
  tokensPerCodeToken: 50,
  ruleTurns: 25,
  dollarsPerMillion: 0.9 * 4 + 0.1 * 20,
};
const pairs = [];
for (const { capability, usual, files: list } of capabilities)
  pairs.push({
    capability,
    usual,
    bitakit: measure(await read(list.map((file) => path.join(examples, file)))),
  });
const usualCode = pairs.reduce((sum, row) => sum + row.usual, 0);
const bitakitCode = pairs.reduce((sum, row) => sum + row.bitakit.tokens, 0);
const session = (code, rules) =>
  code * assumptions.tokensPerCodeToken + rules * assumptions.ruleTurns;
const dollars = (tokens) => Math.round((tokens / 1e6) * assumptions.dollarsPerMillion * 100) / 100;
const usualSession = session(usualCode, 0);
const bitakitSession = session(bitakitCode, guide.agentsMd + guide.skillEntry);
const comparison = {
  rows: pairs,
  assumptions,
  usual: { code: usualCode, session: usualSession, dollars: dollars(usualSession) },
  bitakit: { code: bitakitCode, session: bitakitSession, dollars: dollars(bitakitSession) },
};

// How the cost of one more feature changes as the app grows. An agent session costs about
// `turns` times what it keeps in context. BitaKit's context is measured and stays flat: the rules,
// a complete feature (the Workspace notes plugin) and that plugin's AGENTS.md. The hand-written
// context is an estimate: the feature with its tests, a similar feature read as the pattern to
// copy, and the shared menu, route, search and settings files it edits, which every feature makes
// longer. Turns are equal on both sides, although checks that name the fix usually shorten
// BitaKit sessions.
const growthAssumptions = {
  turns: 25,
  usualFeature: 3000,
  usualPattern: 3000,
  // App frame and navigation, search and app settings pages from the comparison above.
  usualShared: ['App frame and navigation', 'Search (Mod+K)', 'App settings and their pages']
    .map((name) => pairs.find((row) => row.capability === name).usual)
    .reduce((sum, value) => sum + value, 0),
  usualSharedPerFeature: 500,
};
const notes = workspace.find((row) => row.plugin === 'notes');
const notesGuide = countTokens(await readFile(path.join(pluginsDir, 'notes/AGENTS.md'), 'utf8'));
const bitakitContext = guide.agentsMd + guide.skillEntry + notes.tokens + notesGuide;
const usualContext = (n) =>
  growthAssumptions.usualFeature +
  growthAssumptions.usualPattern +
  growthAssumptions.usualShared +
  growthAssumptions.usualSharedPerFeature * (n - 1);
const steps = [1, 10, 20, 30, 40, 50];
let usualTotal = usualSession;
let bitakitTotal = bitakitSession;
const growthRows = [];
for (let n = 1; n <= steps.at(-1); n++) {
  const usual = usualContext(n) * growthAssumptions.turns;
  const bitakit = bitakitContext * growthAssumptions.turns;
  usualTotal += usual;
  bitakitTotal += bitakit;
  if (steps.includes(n))
    growthRows.push({
      feature: n,
      usual,
      bitakit,
      // Including the first app from the comparison.
      usualTotal,
      bitakitTotal,
      usualDollars: dollars(usualTotal),
      bitakitDollars: dollars(bitakitTotal),
    });
}
const growth = { assumptions: growthAssumptions, bitakitContext, rows: growthRows };

const result = {
  tokenizer: 'o200k_base (gpt-tokenizer)',
  packages: rows,
  total,
  feature,
  workspace,
  guide,
  comparison,
  growth,
};
if (process.argv.includes('--write')) {
  const target = path.join(root, 'apps/docs/components/diagrams/measurements.json');
  // Formatted like every other tracked file, so `format:check` passes after a rewrite.
  await writeFile(target, await format(JSON.stringify(result), { filepath: target }));
}
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
  console.log(
    '\n| Todo app capability | Usual (estimate) | BitaKit (measured) |\n| --- | --: | --: |',
  );
  for (const row of pairs)
    console.log(`| ${row.capability} | ${n(row.usual)} | ${n(row.bitakit.tokens)} |`);
  for (const [name, side] of [
    ['Usual', comparison.usual],
    ['BitaKit', comparison.bitakit],
  ])
    console.log(
      `${name}: ${n(side.code)} code tokens, ≈${n(side.session)} session tokens, ≈$${side.dollars}.`,
    );
  console.log(
    '\n| Feature | Usual next feature | BitaKit next feature | Usual so far | BitaKit so far |\n| --: | --: | --: | --: | --: |',
  );
  for (const row of growthRows)
    console.log(
      `| ${row.feature} | ${n(row.usual)} | ${n(row.bitakit)} | ${n(row.usualTotal)} ($${row.usualDollars}) | ` +
        `${n(row.bitakitTotal)} ($${row.bitakitDollars}) |`,
    );
}
