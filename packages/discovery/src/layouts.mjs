import path from 'node:path';

const name = /^[a-z][a-z0-9-]*$/;

/**
 * Layout files in `dir` (the app's `src/layouts` or a plugin's `ui/layouts`): `<family>.tsx` is
 * the variant `default` of the family, `<family>/<variant>.tsx` a named variant. Each becomes a
 * candidate for the `layout.<family>` slot. Other files are left alone.
 */
export function layoutEntries(files, dir) {
  const entries = [];
  for (const file of files) {
    if (!file.endsWith('.tsx')) continue;
    const parts = path.relative(dir, file).slice(0, -'.tsx'.length).split(path.sep);
    if (parts[0] === '..' || parts.length > 2 || !parts.every((part) => name.test(part))) continue;
    entries.push({ family: parts[0], variant: parts[1] ?? 'default', file });
  }
  return entries.sort((a, b) =>
    a.family === b.family ? a.variant.localeCompare(b.variant) : a.family.localeCompare(b.family),
  );
}
