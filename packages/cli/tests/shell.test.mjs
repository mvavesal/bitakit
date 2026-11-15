import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describeBitaKit } from '@bitakit/discovery';
import { describeSlots } from '../src/slots.mjs';
import {
  chooseCandidate,
  describeShell,
  formatShell,
  resolveCandidate,
  withChoice,
} from '../src/shell.mjs';
import { bitakit, project } from './helpers.mjs';

const layout = 'export default ({ children }) => children;\n';
/** An app with two candidates for the frame: its own variant and a plugin's. */
const frames = (config = 'export default {};\n') => ({
  'package.json': { name: 'frames-app' },
  'bitakit.config.ts': config,
  'src/layouts/app/wide.tsx': layout,
  'src/plugins/kiosk/ui/layouts/app.tsx': layout,
});

test('withChoice sets, replaces and removes a choice and leaves the rest of the file as written', () => {
  assert.equal(
    withChoice('export default {};\n', 'layout.app', 'kiosk:default'),
    "export default { choose: { 'layout.app': 'kiosk:default' } };\n",
  );
  assert.equal(
    withChoice(
      "import { defineBitaKit } from '@bitakit/discovery';\nexport default defineBitaKit({ framework: 'next' });\n",
      'layout.app',
      'app:wide',
    ),
    "import { defineBitaKit } from '@bitakit/discovery';\nexport default defineBitaKit({ choose: { 'layout.app': 'app:wide' }, framework: 'next' });\n",
  );
  // An object over several lines gets the entry on a line of its own, with the same indent.
  assert.equal(
    withChoice("export default {\n  framework: 'next',\n};\n", 'layout.app', 'app:wide'),
    "export default {\n  choose: { 'layout.app': 'app:wide' },\n  framework: 'next',\n};\n",
  );
  const chosen = "export default { choose: { 'layout.auth': 'split' }, framework: 'next' };\n";
  const both = withChoice(chosen, 'layout.app', 'app:wide');
  assert.equal(
    both,
    "export default { choose: { 'layout.app': 'app:wide', 'layout.auth': 'split' }, framework: 'next' };\n",
  );
  assert.equal(
    withChoice(both, 'layout.app', 'kiosk:default'),
    "export default { choose: { 'layout.app': 'kiosk:default', 'layout.auth': 'split' }, framework: 'next' };\n",
  );
  // Removing one of two keeps the other; removing the last one removes `choose`.
  assert.equal(withChoice(both, 'layout.app', undefined), chosen);
  assert.equal(
    withChoice(chosen, 'layout.auth', undefined),
    "export default { framework: 'next' };\n",
  );
  assert.equal(
    withChoice("export default { choose: { 'layout.app': 'a' } };\n", 'layout.app', undefined),
    'export default {};\n',
  );
  assert.equal(withChoice(chosen, 'layout.app', undefined), chosen, 'nothing to remove');
  // Not editable: the caller prints the line to add by hand.
  assert.equal(withChoice('export default config;\n', 'layout.app', 'a'), undefined);
  assert.equal(
    withChoice('const picks = {};\nexport default { choose: picks };\n', 'layout.app', 'a'),
    undefined,
  );
});

test('the shell: candidates, what renders, and choosing one in bitakit.config.ts', async (t) => {
  const root = await project(frames(), t);
  const read = async () =>
    describeShell(await describeSlots(await describeBitaKit(root)), 'layout.app');
  const before = await read();
  assert.deepEqual(before.candidates, ['app:wide', 'kiosk:default']);
  assert.equal(before.renders, 'app:wide', "the app's own file wins while nothing is chosen");
  assert.equal(before.choice, null);
  assert.match(formatShell(before).join('\n'), /candidates {2}app:wide, kiosk:default/);

  assert.equal(resolveCandidate(before.candidates, 'kiosk'), 'kiosk:default');
  assert.equal(resolveCandidate(before.candidates, 'wide'), 'app:wide');
  assert.equal(resolveCandidate(before.candidates, 'app:wide'), 'app:wide');
  assert.throws(
    () => resolveCandidate(before.candidates, 'nope'),
    /No candidate "nope"\. Candidates: app:wide, kiosk:default\./,
  );
  assert.throws(() => resolveCandidate(['a:x', 'b:x'], 'x'), /fits several candidates: a:x, b:x/);

  assert.deepEqual(await chooseCandidate(root, 'layout.app', 'kiosk:default'), {
    file: path.join(root, 'bitakit.config.ts'),
    changed: true,
  });
  const after = await read();
  assert.equal(after.renders, 'kiosk:default');
  assert.equal(after.choice, 'kiosk:default');
  assert.equal((await chooseCandidate(root, 'layout.app', 'kiosk:default')).changed, false);

  assert.equal((await chooseCandidate(root, 'layout.app', undefined)).changed, true);
  assert.equal(
    await readFile(path.join(root, 'bitakit.config.ts'), 'utf8'),
    'export default {};\n',
  );
  assert.equal((await read()).renders, 'app:wide');

  const none = describeShell(await describeSlots(await describeBitaKit(root)), 'layout.missing');
  assert.equal(none.exists, false);
  assert.match(formatShell(none).join('\n'), /No "layout\.missing" part exists/);
});

test('CLI: shell lists, use writes the choice, reset removes it, an unknown name fails with the candidates', async (t) => {
  const root = await project(frames(), t);
  const listed = await bitakit(root, 'shell');
  assert.equal(listed.code, 0, listed.stderr);
  assert.match(
    listed.stdout,
    /layout\.app\n {2}renders {5}app:wide\n {2}candidates {2}app:wide, kiosk:default/,
  );
  const json = JSON.parse((await bitakit(root, 'shell', '--json')).stdout);
  assert.deepEqual(json.candidates, ['app:wide', 'kiosk:default']);

  const used = await bitakit(root, 'shell', 'use', 'kiosk');
  assert.equal(used.code, 0, used.stderr);
  assert.match(used.stdout, /layout\.app now uses kiosk:default \(bitakit\.config\.ts\)/);
  assert.equal(
    await readFile(path.join(root, 'bitakit.config.ts'), 'utf8'),
    "export default { choose: { 'layout.app': 'kiosk:default' } };\n",
  );
  assert.match((await bitakit(root, 'shell')).stdout, /renders {5}kiosk:default/);

  const unknown = await bitakit(root, 'shell', 'use', 'nope');
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /No candidate "nope"\. Candidates: app:wide, kiosk:default\./);

  const reset = await bitakit(root, 'shell', 'reset');
  assert.equal(reset.code, 0, reset.stderr);
  assert.match(reset.stdout, /layout\.app has no choice any more/);
  assert.equal(
    await readFile(path.join(root, 'bitakit.config.ts'), 'utf8'),
    'export default {};\n',
  );
});
