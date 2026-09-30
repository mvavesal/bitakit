import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateFoundation } from '../src/generate.mjs';
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'foundation-'));
  async function put(file, text) {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, text);
  }
  try {
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('discovers conventions without executing actions, generates types and respects disable', async () =>
  fixture(async (root, put) => {
    await put(
      'foundation.config.ts',
      "export default {groups:['menu'],plugins:{directory:'plugins',autoEnable:true}}",
    );
    await put('plugins/users/plugin.config.ts', "export default {id:'users'}");
    await put(
      'plugins/users/actions/invite.form-action.ts',
      "throw new Error('Must not execute'); export default {};",
    );
    await put('plugins/users/services/users.service.ts', 'export default {}');
    await put('plugins/users/locales/de.json', '{"users":{"title":"Benutzer"}}');
    await generateFoundation(root);
    const code = await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.match(code, /invite.form-action/);
    assert.match(code, /discoverActions\(\[file\d+\], "users", true\)/);
    assert.match(code, /DiscoveredServiceEntry/);
    assert.match(code, /DiscoveredActionEntry<typeof file\d+, "users", true>/);
    assert.match(code, /interface ActionMap extends DiscoveredActions/);
    await put(
      'foundation.config.ts',
      "export default {groups:[],plugins:{directory:'plugins',overrides:{users:{enabled:false}}}}",
    );
    await generateFoundation(root);
    assert.doesNotMatch(
      await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8'),
      /invite.form-action/,
    );
  }));
test('custom paths work and missing explicit paths fail', async () =>
  fixture(async (root, put) => {
    await put('foundation.config.ts', "export default {groups:[],plugins:{directory:'plugins'}}");
    await put(
      'plugins/users/plugin.config.ts',
      "export default {id:'users',entries:{actions:'commands'}}",
    );
    await put('plugins/users/commands/create.action.ts', 'export default {}');
    await generateFoundation(root);
    assert.match(
      await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8'),
      /commands\/create/,
    );
    await put(
      'plugins/users/plugin.config.ts',
      "export default {id:'users',entries:{actions:'missing'}}",
    );
    await assert.rejects(generateFoundation(root), /Missing explicit entry/);
  }));

test('nested IDs use the configured action root; global conventions and exact filenames are optional', async () =>
  fixture(async (root, put) => {
    await put(
      'foundation.config.ts',
      "export default {groups:[],conventions:false,plugins:{directory:'plugins'}}",
    );
    await put(
      'plugins/users/plugin.config.ts',
      "export default {id:'users',entries:{actions:'commands'}}",
    );
    await put(
      'plugins/users/commands/team/invite.form-action.ts',
      "throw new Error('Never execute'); export default {};",
    );
    await generateFoundation(root);
    assert.match(
      await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8'),
      /discoveredFile\(entry\d+, "team\.invite",/,
    );
    assert.match(
      await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8'),
      /DiscoveredActionEntry<typeof file\d+, "users", false>/,
    );
    await put(
      'plugins/users/plugin.config.ts',
      "export default {id:'users',entries:{actions:'custom.ts'}}",
    );
    await put('plugins/users/custom.ts', 'export default {};');
    await generateFoundation(root);
    assert.match(
      await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8'),
      /discoveredFile\(entry\d+, "custom",/,
    );
  }));

test('app actions need no plugin manifest or group catalog; add, rename and delete update imports', async () =>
  fixture(async (root, put) => {
    await put('foundation.config.ts', "export default {actions:{directory:'commands'}}");
    await put(
      'commands/account/logout.action.ts',
      "throw new Error('Discovery must not run code'); export default {};",
    );
    await put('commands/helpers.ts', 'export const helper = true;');
    await generateFoundation(root);
    const output = () => readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.match(await output(), /discoveredFile\(entry\d+, "account.logout",/);
    assert.doesNotMatch(await output(), /helpers/);
    await rm(path.join(root, 'commands/account/logout.action.ts'));
    await put('commands/account/invite.form-action.ts', 'export default {};');
    await generateFoundation(root);
    assert.doesNotMatch(await output(), /logout/);
    assert.match(await output(), /account.invite/);
    await put('foundation.config.ts', 'export default {actions:false}');
    await generateFoundation(root);
    assert.doesNotMatch(await output(), /account.invite/);
  }));

test('framework-independent watcher discovers new files and deletion without restarting', async () =>
  fixture(async (root, put) => {
    const { watchFoundation } = await import('@bitakit/core/discovery');
    await put('foundation.config.ts', 'export default {}');
    await generateFoundation(root);
    const errors = [];
    const stop = watchFoundation(root, (error) => errors.push(error));
    const output = () => readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    async function until(predicate) {
      const end = Date.now() + 5000;
      while (Date.now() < end) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      assert.fail('Discovery did not update within five seconds');
    }
    try {
      await put('src/actions/new.action.ts', 'export default {};');
      await until(async () => (await output()).includes('new.action'));
      await rm(path.join(root, 'src/actions/new.action.ts'));
      await until(async () => !(await output()).includes('new.action'));
      assert.deepEqual(errors, []);
    } finally {
      stop();
    }
  }));

test('interceptors are explicitly enabled in config order and inactive files stay out of imports', async () =>
  fixture(async (root, put) => {
    await put(
      'foundation.config.ts',
      "export default {actions:{overrides:{'account.logout':{enabled:false}}},interceptors:{enabled:['guard','confirm']}}",
    );
    await put(
      'src/interceptors/confirm.interceptor.ts',
      "throw new Error('Do not execute during discovery'); export default {};",
    );
    await put('src/interceptors/guard.interceptor.ts', 'export default {};');
    await put('src/interceptors/unused.interceptor.ts', 'export default {};');
    await generateFoundation(root);
    const code = await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.ok(code.indexOf('guard.interceptor') < code.indexOf('confirm.interceptor'));
    assert.doesNotMatch(code, /unused.interceptor/);
    assert.match(code, /"account.logout":\{"enabled":false\}/);
    await put('foundation.config.ts', "export default {interceptors:{enabled:['missing']}}");
    await assert.rejects(generateFoundation(root), /Unknown interceptor/);
  }));

test('provider discovery imports only explicitly ordered wrappers without executing them', async () =>
  fixture(async (root, put) => {
    await put(
      'foundation.config.ts',
      "export default {providers:{directory:'wrappers',enabled:['theme','widgets']}}",
    );
    await put(
      'wrappers/theme.provider.tsx',
      "throw new Error('Do not evaluate'); export default {};",
    );
    await put('wrappers/widgets.provider.tsx', 'export default {};');
    await put('wrappers/unused.provider.tsx', 'export default {};');
    await generateFoundation(root);
    const code = await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.ok(code.indexOf('theme.provider') < code.indexOf('widgets.provider'));
    assert.doesNotMatch(code, /unused.provider/);
  }));

test('discovers plugin pages without evaluating them and removes disabled page imports', async () =>
  fixture(async (root, put) => {
    await put(
      'foundation.config.ts',
      "export default {plugins:{directory:'plugins',autoEnable:true}}",
    );
    await put('plugins/demo/plugin.config.ts', "export default {id:'demo'}");
    await put(
      'plugins/demo/pages/details.page.tsx',
      "throw new Error('Do not evaluate'); export default {};",
    );
    await generateFoundation(root);
    const output = path.join(root, '.foundation/plugins.ts');
    assert.match(await readFile(output, 'utf8'), /details.page/);
    assert.match(await readFile(output, 'utf8'), /pages: \[entry\d+\]/);
    await put(
      'foundation.config.ts',
      "export default {plugins:{directory:'plugins',autoEnable:true,overrides:{demo:{enabled:false}}}}",
    );
    await generateFoundation(root);
    assert.doesNotMatch(await readFile(output, 'utf8'), /details.page/);
  }));

test('plugin metadata uses package fields, supports local overrides and excludes private configuration', async () =>
  fixture(async (root, put) => {
    await put(
      'foundation.config.ts',
      `export default { plugins: { directory: './src/plugins' } };`,
    );
    await put(
      'src/plugins/example/plugin.config.ts',
      `export default { id: 'example', metadata: { description: 'Local description' } };`,
    );
    await put(
      'src/plugins/example/package.json',
      JSON.stringify({
        name: '@demo/example',
        version: '1.2.0',
        author: 'Example',
        description: 'Package description',
        scripts: { secret: 'never-public' },
      }),
    );
    await generateFoundation(root);
    const source = await readFile(path.join(root, '.foundation/plugins.ts'), 'utf8');
    assert.match(source, /@demo\/example/);
    assert.match(source, /Local description/);
    assert.doesNotMatch(source, /never-public|Package description/);
  }));
