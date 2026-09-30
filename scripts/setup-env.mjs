import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Create missing local configs only. Existing values and secrets are preserved.
for (const [example, destination] of [['../apps/web/.env.example', '../apps/web/.env.local']]) {
  const template = await readFile(new URL(example, import.meta.url), 'utf8');
  const content = template.replaceAll('GENERATE_SECRET', () => randomBytes(32).toString('hex'));

  try {
    await writeFile(new URL(destination, import.meta.url), content, {
      flag: 'wx',
      mode: 0o600,
    });
    console.log(`Created ${destination.slice(3)}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Kept existing ${destination.slice(3)}`);
  }
}
