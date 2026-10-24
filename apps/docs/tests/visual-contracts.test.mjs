import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describeDefinitions } from '../../../packages/discovery/src/definition-info.mjs';

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

const figures = JSON.parse(
  await readFile(new URL('../components/diagrams/figures.json', import.meta.url)),
);

test('every diagram has its source, both exports and existing maintenance references', async () => {
  const sources = (await readdir(new URL('../diagrams/', import.meta.url)))
    .filter((file) => file.endsWith('.html'))
    .map((file) => file.slice(0, -'.html'.length))
    .sort();
  assert.deepEqual(Object.keys(figures).sort(), sources, 'figures.json lists every diagram source');
  for (const [name, figure] of Object.entries(figures)) {
    for (const variant of ['light', 'dark'])
      await access(new URL(`../public/diagrams/${name}-${variant}.svg`, import.meta.url));
    for (const source of figure.sources) await access(new URL(source, root));
  }
});

test('pages only show diagrams that exist', async () => {
  const pages = await readdir(new URL('../content/docs/', import.meta.url), { recursive: true });
  for (const page of pages.filter((file) => file.endsWith('.mdx'))) {
    const text = await readFile(new URL(`../content/docs/${page}`, import.meta.url), 'utf8');
    for (const [, name] of text.matchAll(/^<Figure name="([^"]+)"/gm))
      assert.ok(figures[name], `${page} shows the unknown diagram ${name}`);
  }
});
