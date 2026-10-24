#!/usr/bin/env node
// AGENTS.md is the complete guide; CLAUDE.md beside it only imports it. Every published package
// ships both, and no CLAUDE.md in the repository or its sample apps holds instructions of its own.
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pointer = '@AGENTS.md\n';
const problems = [];

for (const name of await readdir(path.join(root, 'packages'))) {
  const manifest = JSON.parse(
    await readFile(path.join(root, 'packages', name, 'package.json'), 'utf8').catch(() => 'null'),
  );
  if (!manifest || manifest.private) continue;
  for (const file of ['AGENTS.md', 'CLAUDE.md'])
    if (!manifest.files?.includes(file)) problems.push(`${manifest.name} does not ship ${file}.`);
}

// Files Git tracks or would add: generated and ignored copies (installed skills) are left out.
const files = new Set(
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean),
);
const tracked = [...files].filter((file) => path.basename(file) === 'CLAUDE.md');
for (const file of tracked) {
  if ((await readFile(path.join(root, file), 'utf8')) !== pointer)
    problems.push(`${file} must contain only "@AGENTS.md"; put instructions in AGENTS.md.`);
  if (!files.has(path.join(path.dirname(file), 'AGENTS.md')))
    problems.push(`${file} has no AGENTS.md beside it.`);
}
for (const file of files)
  if (path.basename(file) === 'AGENTS.md' && !files.has(path.join(path.dirname(file), 'CLAUDE.md')))
    problems.push(`${file} has no CLAUDE.md beside it that imports it.`);

if (problems.length) {
  console.error(`Agent guides:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  process.exit(1);
}
console.log(`Agent guides: ${tracked.length} CLAUDE.md files import their AGENTS.md.`);
