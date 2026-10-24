// Writes dist/theme.schema.json from the theme file schema, so editors and agents validate files.
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { themeFileSchema, themeFileSchemaUrl } from '../dist/themes.js';

const schema = {
  ...z.toJSONSchema(themeFileSchema, { io: 'input' }),
  $id: themeFileSchemaUrl,
  title: 'BitaKit Shell theme',
};
await writeFile(
  new URL('../dist/theme.schema.json', import.meta.url),
  `${JSON.stringify(schema, null, 2)}\n`,
);
