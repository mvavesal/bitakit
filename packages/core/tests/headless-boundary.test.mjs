import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        return entry.isDirectory() ? sources(url) : [url];
      }),
    )
  ).flat();
}

test('Core contains no React bindings, UI dependencies, or renderer entry points', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  };
  assert.equal(
    Object.keys(dependencies).some((name) => /react|radix|heroui|@bitakit\/ui/.test(name)),
    false,
  );
  assert.equal(manifest.exports['./react'], undefined);
  assert.equal(manifest.exports['./actions/react'], undefined);
  for (const file of await sources(new URL('../src/', import.meta.url))) {
    assert.equal(file.pathname.endsWith('.tsx'), false, file.pathname);
    assert.doesNotMatch(
      await readFile(file, 'utf8'),
      /(?:from\s*|import\s*\()['"](?:react(?:\/[^'"]*)?|@bitakit\/ui(?:\/[^'"]*)?)['"]/,
      file.pathname,
    );
  }
});
