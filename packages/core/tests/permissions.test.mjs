import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createJiti } from 'jiti';
import ts from 'typescript';
import { generateBitaKit } from '@bitakit/discovery';
import {
  AccessConfigurationError,
  composeAccessConfiguration,
  composePermissions,
  createRuntime,
  definePermissions,
  defineRoles,
  isBitaKitStartupError,
  roleProblems,
} from '../dist/core.js';

const coreRuntime = new URL('../dist/core.js', import.meta.url).pathname;
const coreTypes = new URL('../dist/core.d.ts', import.meta.url).pathname;
const actionTypes = new URL('../dist/actions/core.d.ts', import.meta.url).pathname;
const content = definePermissions({ content: ['read', 'edit', 'publish'] });
const media = definePermissions({ media: ['read', 'upload'] });
const withSource = (definition, source) => ({ ...definition, source });

test('definePermissions accepts resources with unique operations and rejects malformed declarations', () => {
  assert.deepEqual(content.permissions, { content: ['read', 'edit', 'publish'] });
  assert.ok(Object.isFrozen(content.permissions.content));
  assert.throws(() => definePermissions({}), /at least one resource/);
  assert.throws(
    () => definePermissions({ Content: ['read'] }),
    /Invalid permission resource "Content"/,
  );
  assert.throws(() => definePermissions({ content: [] }), /non-empty list of operations/);
  assert.throws(() => definePermissions({ content: ['read', 'read'] }), /operation twice/);
  assert.throws(() => definePermissions({ content: ['Read me'] }), /Invalid operation "Read me"/);
});

test('defineRoles keeps declaration order and rejects unknown fields, standards and duplicate standards', () => {
  const roles = defineRoles(
    {
      owner: { standard: 'owner', grants: { content: ['read', 'edit', 'publish'] } },
      member: { standard: 'member', label: 'Editor', grants: { content: ['read', 'edit'] } },
      viewer: { label: 'Reader', description: 'Can view content.', grants: { content: ['read'] } },
    },
    { customRoles: true },
  );
  assert.deepEqual(Object.keys(roles.roles), ['owner', 'member', 'viewer']);
  assert.equal(roles.options.customRoles, true);
  assert.ok(Object.isFrozen(roles.roles.member.grants.content));
  assert.throws(() => defineRoles({}), /at least one role/);
  assert.throws(() => defineRoles({ Boss: {} }), /Invalid role "Boss"/);
  assert.throws(() => defineRoles({ boss: { rank: 1 } }), /unknown fields "rank"/);
  assert.throws(() => defineRoles({ boss: { standard: 'root' } }), /unknown standard role "root"/);
  assert.throws(
    () => defineRoles({ a: { standard: 'admin' }, b: { standard: 'admin' } }),
    /Roles "a" and "b" both extend the standard role "admin"/,
  );
  assert.throws(() => defineRoles({ a: { label: ' ' } }), /label of role "a"/);
  assert.throws(() => defineRoles({ a: { grants: { content: [] } } }), /without operations/);
  assert.throws(() => defineRoles({ a: {} }, { customRoles: 'yes' }), /customRoles option/);
});

test('one resource has one owner: a second claim fails and names both plugins and files', () => {
  const catalog = composePermissions([
    { owner: 'content', definition: withSource(content, 'src/plugins/content/permissions.ts') },
    { owner: 'media', definition: media },
  ]);
  assert.deepEqual(Object.keys(catalog), ['content', 'media']);
  assert.equal(catalog.content.owner, 'content');
  assert.throws(
    () =>
      composePermissions([
        { owner: 'content', definition: withSource(content, 'src/plugins/content/permissions.ts') },
        { owner: 'blog', definition: withSource(content, 'src/plugins/blog/permissions.ts') },
      ]),
    (error) =>
      error instanceof AccessConfigurationError &&
      /resource "content" is declared by "content" \(src\/plugins\/content\/permissions\.ts\) and "blog" \(src\/plugins\/blog\/permissions\.ts\)/.test(
        error.message,
      ),
  );
});

test('roles may grant only declared resources and operations; every problem is reported', () => {
  const catalog = composePermissions([{ owner: 'content', definition: content }]);
  const roles = withSource(
    defineRoles({
      viewer: { grants: { content: ['read', 'fly'], comments: ['read'] } },
      editor: { grants: { content: ['edit'] } },
    }),
    'src/roles.ts',
  );
  const problems = roleProblems(roles, catalog);
  assert.equal(problems.length, 2);
  assert.match(
    problems[0],
    /Role "viewer" in src\/roles\.ts grants unknown operations "fly" of "content"/,
  );
  assert.match(problems[1], /grants unknown resource "comments"\. Declared resources: "content"/);
  assert.throws(
    () =>
      composeAccessConfiguration({
        permissions: [{ owner: 'content', definition: content }],
        roles,
      }),
    (error) => error instanceof AccessConfigurationError && error.problems.length === 2,
  );
  const valid = composeAccessConfiguration({
    permissions: [{ owner: 'content', definition: content }],
    roles: defineRoles({ editor: { grants: { content: ['read', 'edit'] } } }),
  });
  assert.deepEqual(valid.permissions.content.actions, ['read', 'edit', 'publish']);
});

test('the runtime refuses to start with conflicting or misplaced declarations', () => {
  const roles = defineRoles({ editor: { grants: { content: ['read', 'edit'] } } });
  assert.doesNotThrow(() =>
    createRuntime({ roles, plugins: [{ id: 'content', permissions: content }] }),
  );
  const startupError = (run, pattern) =>
    assert.throws(run, (error) => isBitaKitStartupError(error) && pattern.test(error.message));
  startupError(
    () =>
      createRuntime({
        plugins: [
          { id: 'content', permissions: content },
          { id: 'blog', permissions: content },
        ],
      }),
    /resource "content" is declared by "content" and "blog"/,
  );
  startupError(
    () => createRuntime({ roles, plugins: [{ id: 'media', permissions: media }] }),
    /Role "editor" grants unknown resource "content"/,
  );
  startupError(
    () => createRuntime({ plugins: [{ id: 'content', permissions: content, roles }] }),
    /Base roles belong to the app's src\/roles\.ts/,
  );
  startupError(
    () => createRuntime({ plugins: [{ id: 'content', permissions: { content: ['read'] } }] }),
    /definePermissions/,
  );
});

/** A temporary project with plugin folders. */
async function fixture(run) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'bitakit-permissions-')));
  const put = async (file, source) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
    return target;
  };
  try {
    await put('package.json', JSON.stringify({ name: 'demo' }));
    await run(root, put);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
const plugin = (put, id, permissions) =>
  Promise.all([
    put(`src/plugins/${id}/plugin.config.ts`, `export default {};`),
    permissions &&
      put(
        `src/plugins/${id}/permissions.ts`,
        `import { definePermissions } from '@bitakit/core';\nexport default definePermissions(${permissions});\n`,
      ),
  ]);
const typeErrors = (files, root) =>
  ts
    .getPreEmitDiagnostics(
      ts.createProgram(files, {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        baseUrl: root,
        paths: { '@bitakit/core': [coreTypes], '@bitakit/core/actions': [actionTypes] },
      }),
    )
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));

test('discovery wires plugin permissions and app roles, types grants and keeps the output unchanged without them', () =>
  fixture(async (root, put) => {
    await plugin(put, 'content', `{ content: ['read', 'edit', 'publish'] }`);
    await plugin(put, 'media', `{ media: ['read', 'upload'] }`);
    const roles = await put(
      'src/roles.ts',
      `import { defineRoles } from '@bitakit/core';
export default defineRoles({
  owner: { standard: 'owner', grants: { content: ['read', 'edit', 'publish'], media: ['read', 'upload'] } },
  member: { standard: 'member', label: 'Editor', grants: { content: ['read', 'edit'] } },
  viewer: { label: 'Reader', grants: { content: ['read'] } },
}, { customRoles: true });
`,
    );
    const result = await generateBitaKit(root, { quiet: true });
    const source = await readFile(result.generated, 'utf8');
    assert.match(source, /interface PermissionMap extends DiscoveredPermissions \{\}/);
    assert.match(source, /interface RoleMap extends DiscoveredRoles \{\}/);
    assert.match(source, /permissions: discoverPermissions\(\[file\d+\]\)/);
    assert.match(source, /roles: discoverRoles\(\[file\d+\]\)/);
    const consumer = await put(
      'consumer.ts',
      `import { defineRoles, type PermissionMap, type RoleMap } from '@bitakit/core';
const operation: PermissionMap['content'] = 'publish';
const role: keyof RoleMap = 'viewer';
// @ts-expect-error unknown operation of a declared resource
defineRoles({ x: { grants: { content: ['fly'] } } });
// @ts-expect-error unknown resource
defineRoles({ x: { grants: { comments: ['read'] } } });
export { operation, role };
`,
    );
    assert.deepEqual(typeErrors([result.generated, roles, consumer], root), []);
    const { createBitaKitConfig } = await createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': coreRuntime },
    }).import(result.generated);
    const config = createBitaKitConfig();
    assert.deepEqual(Object.keys(config.roles.roles), ['owner', 'member', 'viewer']);
    assert.equal(config.roles.source, 'src/roles.ts');
    assert.equal(
      config.plugins.find((entry) => entry.id === 'content').permissions.source,
      'src/plugins/content/permissions.ts',
    );
    assert.doesNotThrow(() => createRuntime(config));
    const accessFile = path.join(root, 'src/bitakit.gen.access.ts');
    const accessSource = await readFile(accessFile, 'utf8');
    assert.doesNotMatch(accessSource, /use client|react/i, 'server-safe: no client code');
    const { accessConfiguration } = await createJiti(import.meta.url, {
      moduleCache: false,
      alias: { '@bitakit/core': coreRuntime },
    }).import(accessFile);
    assert.deepEqual(Object.keys(accessConfiguration.permissions), ['content', 'media']);
    assert.equal(accessConfiguration.permissions.media.owner, 'media');
    assert.deepEqual(Object.keys(accessConfiguration.roles.roles), ['owner', 'member', 'viewer']);
    assert.equal(accessConfiguration.roles.options.customRoles, true);
    assert.deepEqual(typeErrors([accessFile], root), []);

    await rm(path.join(root, 'src/roles.ts'));
    await rm(path.join(root, 'src/plugins/content/permissions.ts'));
    await rm(path.join(root, 'src/plugins/media/permissions.ts'));
    const plain = await readFile((await generateBitaKit(root, { quiet: true })).generated, 'utf8');
    assert.doesNotMatch(plain, /Permission|discoverRoles|RoleMap/);
    await assert.rejects(readFile(path.join(root, 'src/bitakit.gen.access.ts')), /ENOENT/);
  }));

test('discovery fails before the app runs: duplicate resources, unknown grants and plugin roles', () =>
  fixture(async (root, put) => {
    await plugin(put, 'content', `{ content: ['read', 'edit'] }`);
    await plugin(put, 'blog', `{ content: ['read'] }`);
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /resource "content" is declared by "(blog|content)" \(src\/plugins\/(blog|content)\/permissions\.ts\) and "(blog|content)" \(src\/plugins\/(blog|content)\/permissions\.ts\)/,
    );
    await rm(path.join(root, 'src/plugins/blog'), { recursive: true });
    await put(
      'src/roles.ts',
      `import { defineRoles } from '@bitakit/core';\nexport default defineRoles({ viewer: { grants: { content: ['read', 'fly'] } } });\n`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /Role "viewer" in src\/roles\.ts grants unknown operations "fly" of "content"/,
    );
    await put(
      'src/roles.ts',
      `import { defineRoles } from '@bitakit/core';\nexport default defineRoles({ viewer: { grants: { content: ['read'] } } });\n`,
    );
    await put('src/plugins/content/roles.ts', `export default {};`);
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /Plugin "content" has src\/plugins\/content\/roles\.ts: base roles belong to the app's src\/roles\.ts/,
    );
    await rm(path.join(root, 'src/plugins/content/roles.ts'));
    await put(
      'src/roles.ts',
      `import { defineRoles } from '@bitakit/core';\nexport default defineRoles({ a: { standard: 'admin' }, b: { standard: 'admin' } });\n`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /src\/roles\.ts: Roles "a" and "b"/,
    );
  }));
