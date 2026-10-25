import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { agentRules, bitakitIdentity, claudeFileFor } from '../src/index.mjs';

const repository = new URL('../../../', import.meta.url);
const read = (file) => readFile(new URL(file, repository), 'utf8');
/** Markdown emphasis and line wrapping do not change the sentence. */
const prose = (text) => text.replace(/\*\*/g, '').replace(/\s+/g, ' ');

test('the docs introduction and the agent rules state the same identity', async () => {
  assert.ok(
    prose(await read('apps/docs/content/docs/index.mdx')).includes(bitakitIdentity),
    'apps/docs/content/docs/index.mdx',
  );
  assert.ok(prose(agentRules({ routes: 'src/app' })).includes(bitakitIdentity), 'agent rules');
  assert.match(agentRules({ routes: 'src/app' }), /project-local `bitakit-app-development` skill/);
  assert.ok(agentRules({ routes: 'src/app' }).length <= 3200, 'agent rules stay within budget');
});

test('published package descriptions name BitaKit, never the old Foundation name', async () => {
  for (const name of await readdir(new URL('packages/', repository))) {
    const manifest = JSON.parse(
      await read(`packages/${name}/package.json`).catch(() => '{"private":true}'),
    );
    if (manifest.private) continue;
    assert.match(manifest.description ?? '', /BitaKit/, `${manifest.name} description`);
    assert.doesNotMatch(manifest.description, /Foundation/, `${manifest.name} description`);
  }
});

test('CLAUDE.md imports AGENTS.md: created when missing, appended once, otherwise left alone', () => {
  assert.equal(claudeFileFor(undefined), '@AGENTS.md\n');
  assert.equal(claudeFileFor('  \n'), '@AGENTS.md\n');
  assert.equal(claudeFileFor('# Rules\n'), '# Rules\n\n@AGENTS.md\n');
  const imported = '# Rules\n\n@AGENTS.md\n\nMore.\n';
  assert.equal(claudeFileFor(imported), imported);
  assert.equal(claudeFileFor(claudeFileFor('# Rules\n')), '# Rules\n\n@AGENTS.md\n');
});
