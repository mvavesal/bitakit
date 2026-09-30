import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(file) : /\.[cm]?[jt]sx?$/.test(file) ? [file] : [];
      }),
    )
  ).flat();
}
test('generic foundation entry points do not require provider adapters', async () => {
  for (const relative of ['packages/app-preferences', 'packages/core']) {
    const manifest = JSON.parse(await readFile(path.join(root, relative, 'package.json'), 'utf8'));
    for (const dependencies of [manifest.dependencies, manifest.peerDependencies]) {
      assert.equal(
        Object.keys(dependencies ?? {}).some((name) => /better-auth|next-intl/.test(name)),
        false,
        relative,
      );
    }
    for (const file of await sourceFiles(path.join(root, relative, 'src'))) {
      const source = await readFile(file, 'utf8');
      assert.doesNotMatch(
        source,
        /(?:from\s*|import\s*\()['"][^'"]*(?:better-auth|next-intl)[^'"]*['"]/,
        file,
      );
    }
  }
});
