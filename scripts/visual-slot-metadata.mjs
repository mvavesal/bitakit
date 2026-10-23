import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeDefinitions } from '../packages/discovery/src/definition-info.mjs';

// Hand-composed visual packages use the same derived sidecar as `bitakit build`.
// Parse their headless declarations without importing a client entry in Node.
const id = process.argv[2];
if (!['shell', 'app-preferences', 'quick-search'].includes(id))
  throw new Error('Expected a visual package ID');
const root = fileURLToPath(new URL(`../packages/${id}/`, import.meta.url));
const info = await describeDefinitions([{ file: path.join(root, 'src/slots.ts'), path: '' }], {
  helper: 'defineSlot',
  moduleId: id,
  properties: ['accepts', 'policy'],
});
if (info.unresolved.length) throw new Error(`Unresolved slot declarations in ${id}`);
await writeFile(
  path.join(root, 'dist/foundation.slots.json'),
  JSON.stringify(
    {
      version: 1,
      definitions: info.definitions.map((item) => ({
        ...item,
        file: 'src/slots.ts',
        plugin: id,
        policy: item.policy ?? 'list',
      })),
      unresolved: [],
    },
    null,
    2,
  ) + '\n',
);
