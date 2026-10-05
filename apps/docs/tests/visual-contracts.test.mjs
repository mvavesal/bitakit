import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describeDefinitions } from '../../../packages/discovery/src/definition-info.mjs';
import { charts } from '../components/diagrams/charts.mjs';

const root = new URL('../../../', import.meta.url);
const regions = JSON.parse(
  await readFile(new URL('../components/illustrations/regions.json', import.meta.url)),
);

test('illustrated slot contracts agree with their owning packages', async () => {
  const definitions = [];
  for (const id of ['shell', 'app-preferences']) {
    const result = await describeDefinitions(
      [{ file: fileURLToPath(new URL(`packages/${id}/src/slots.ts`, root)), path: '' }],
      { helper: 'defineSlot', moduleId: id, properties: ['accepts', 'policy'] },
    );
    assert.deepEqual(result.unresolved, []);
    definitions.push(...result.definitions);
  }
  for (const region of Object.values(regions).flat()) {
    if (!region.slot) continue;
    const definition = definitions.find((item) => item.id === region.slot);
    assert.ok(definition, `Illustration refers to missing slot ${region.slot}`);
    assert.equal(region.accepts, definition.accepts, region.slot);
    assert.equal(region.policy, definition.policy ?? 'list', region.slot);
  }
});

test('diagram maintenance references point to existing source files', async () => {
  for (const diagram of Object.values(charts)) {
    for (const source of diagram.sources) await access(new URL(source, root));
  }
});
