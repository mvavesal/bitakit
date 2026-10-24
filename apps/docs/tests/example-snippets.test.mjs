import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// How-to guides copy their code from the sample apps, which scripts/verify-examples.mjs
// installs, builds and drives in a browser. A titled code block must equal that file, so a
// guide cannot drift from code that is known to work. A title with a note in parentheses, such as
// "(excerpt)", marks partial or illustrative code.
const root = new URL('../../../', import.meta.url);
const guides = {
  'run-an-operation': 'todo',
  settings: 'settings',
  'layouts-and-screens': 'layouts',
  'extend-a-plugin': 'workspace',
  'react-to-events': 'workspace',
  'search-source': 'workspace',
};

for (const [guide, example] of Object.entries(guides))
  test(`${guide} shows the files of the ${example} sample unchanged`, async () => {
    const source = await readFile(
      new URL(`apps/docs/content/docs/guides/${guide}.mdx`, root),
      'utf8',
    );
    const blocks = [...source.matchAll(/^```\w+ title="([^"]+)"\n([\s\S]*?)^```$/gm)];
    const files = blocks.filter(([, title]) => !title.includes(' ('));
    assert.ok(files.length > 0, `${guide} shows no sample files`);
    for (const [, file, code] of files) {
      const actual = await readFile(new URL(`examples/${example}/${file}`, root), 'utf8');
      assert.equal(code.trim(), actual.trim(), `${guide}: ${file} differs from the sample`);
    }
  });
