import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createJiti } from 'jiti';
import { generateFoundation } from '../../core/discovery/generate.mjs';
import {
  FoundationRuntime,
  createActionList,
  defineConfig,
  discoveredFile,
  discoverConfig,
} from '../../core/dist/core.js';
import {
  createAppPreferences,
  createMemoryStorage,
  defineSettings,
  booleanField,
} from '../dist/core.js';
import { appPreferencesPlugin, discoverSettings } from '../dist/foundation/index.js';
import { resolveSetting } from '../dist/fields/reference.js';

test('settings handles reuse storage, preserve binding identity and stop after removal', async () => {
  const preferences = createAppPreferences({ storage: createMemoryStorage() });
  const values = discoverSettings(
    [
      discoveredFile(
        defineSettings({
          fields: {
            autosave: booleanField({ defaultValue: true }),
          },
        }),
        'editor',
        'settings/editor.ts',
      ),
    ],
    'documents',
  );
  const runtime = new FoundationRuntime(createActionList(), {
    plugins: [
      appPreferencesPlugin({ settings: preferences }),
      {
        id: 'documents',
        contributions: { settings: values },
        config: discoverConfig([
          discoveredFile(
            defineConfig({ defaults: { pageSize: 20 } }),
            'editor',
            'configs/editor.ts',
          ),
        ]),
      },
    ],
  });
  const reference = runtime.app.settings.documents.editor.autosave;
  assert.equal(resolveSetting(reference, preferences), values[0].fields.autosave);
  assert.equal(runtime.app.config.documents.editor.pageSize, 20);
  assert.ok(Object.isFrozen(runtime.app.config.documents.editor));
  const stop = runtime.mount();
  await preferences.activate({});
  assert.equal(reference.get(), true);
  await reference.set(false);
  assert.equal(preferences.get(values[0].fields.autosave).value, false);
  assert.throws(
    () => resolveSetting(reference, createAppPreferences({ storage: createMemoryStorage() })),
    /another preferences instance/,
  );
  stop();
  assert.throws(() => reference.get(), /Unregistered setting/);
  const custom = discoverSettings(
    [
      discoveredFile(
        defineSettings({
          id: 'stable.editor',
          fields: {
            autosave: booleanField({ defaultValue: true }),
          },
        }),
        'moved',
        'settings/moved.ts',
      ),
    ],
    'other',
  );
  assert.equal(custom[0].fields.autosave.key, 'stable.editor.autosave');
});

test('discovery generates typed Config and Settings paths without explicit collection IDs', async () => {
  const root = await mkdtemp(path.join(process.cwd(), '.settings-access-test-'));
  const put = async (file, source) => {
    const target = path.join(root, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
    return target;
  };
  try {
    await put(
      'package.json',
      JSON.stringify({ dependencies: { '@bitakit/app-preferences': '0.1.0' } }),
    );
    await put(
      'src/plugins/documents/settings/editor.ts',
      `
      import { defineSettings, booleanField } from '@bitakit/app-preferences/core';
      export default defineSettings({fields: { autosave: booleanField({defaultValue: true}) }});
    `,
    );
    await put(
      'src/plugins/documents/configs/editor.ts',
      `
      import { defineConfig } from '@bitakit/core';
      export default defineConfig({defaults: {pageSize: 20}});
    `,
    );
    await put(
      'src/plugins/documents/actions/read.ts',
      `
      import { defineAction } from '@bitakit/core';
      export default defineAction({execute: ({app}) => app.config.documents.editor.pageSize});
    `,
    );
    await put(
      'src/plugins/documents/interceptors/log.ts',
      `
      import { defineInterceptor } from '@bitakit/core';
      export default defineInterceptor({before() { console.log('Document action'); }});
    `,
    );
    const consumer = await put(
      'consumer.ts',
      `
      import type { FoundationApp } from '@bitakit/core';
      import type { ToggleSetting } from '@bitakit/app-preferences/core';
      declare const app: FoundationApp;
      const page: number = app.config.documents.editor.pageSize;
      const toggle: ToggleSetting = app.settings.documents.editor.autosave;
      const value: boolean = app.settings.documents.editor.autosave.get();
      app.settings.documents.editor.autosave.set(false);
      // @ts-expect-error Invalid setting value.
      app.settings.documents.editor.autosave.set('false');
      // @ts-expect-error Unknown settings field.
      app.settings.documents.editor.missing;
      // @ts-expect-error Config values are immutable.
      app.config.documents.editor.pageSize = 30;
      // @ts-expect-error Unknown config field.
      app.config.documents.editor.missing;
    `,
    );
    await generateFoundation(root);
    const generated = path.join(root, '.foundation/plugins.ts');
    const program = ts.createProgram([generated, consumer], {
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
    assert.deepEqual(
      ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
      [],
    );
    const jiti = createJiti(import.meta.url, { moduleCache: false });
    const { foundationConfig } = await jiti.import(generated);
    const preferences = createAppPreferences({ storage: createMemoryStorage() });
    const runtime = new FoundationRuntime(createActionList(), {
      ...foundationConfig,
      plugins: [appPreferencesPlugin({ settings: preferences }), ...foundationConfig.plugins],
    });
    const stop = runtime.mount();
    await preferences.activate({});
    assert.equal(runtime.app.settings.documents.editor.autosave.get(), true);
    assert.equal(runtime.app.config.documents.editor.pageSize, 20);
    assert.equal((await runtime.app.actions.documents.read.execute()).value, 20);
    stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('default preferences plugin persists to browser storage without host configuration', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  } });
  let stop;
  try {
    const definitions = discoverSettings([discoveredFile(defineSettings({fields: {
      autosave: booleanField({defaultValue: true}),
    }}), 'editor', 'settings/editor.ts')], 'documents');
    const runtime = new FoundationRuntime(createActionList(), { plugins: [appPreferencesPlugin(), {
      id: 'documents', contributions: { settings: definitions },
    }] });
    stop = runtime.mount();
    await runtime.app.services.preferences.activate({});
    await runtime.app.settings.documents.editor.autosave.set(false);
    assert.equal(values.get('foundation.settings.documents.editor.autosave'), 'false');
  } finally {
    stop?.();
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
