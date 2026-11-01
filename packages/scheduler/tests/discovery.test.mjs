import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { generateBitaKit } from '@bitakit/discovery';
import { createJiti } from 'jiti';
import { createRuntime } from '@bitakit/core';

test('installed discovery wires folder/dotted/record tasks and strict mixed-case type maps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bitakit-scheduler-discovery-'));
  const put = async (name, value) => {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
  };
  try {
    await symlink(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../node_modules'),
      join(root, 'node_modules'),
    );
    await put(
      'package.json',
      JSON.stringify({
        name: 'scheduler-test',
        type: 'module',
        dependencies: { '@bitakit/scheduler': '^0.2.0' },
      }),
    );
    await put('bitakit.config.ts', "export default { framework: 'none' };");
    const imports = "import { defineTask } from '@bitakit/scheduler'; import { z } from 'zod';";
    const task =
      'defineTask({ input: z.object({ count: z.number() }), execute: ({ input }) => input.count })';
    await put(
      'src/plugins/Reports/contributions/tasks/weekly.ts',
      `${imports} export default ${task};`,
    );
    await put(
      'src/plugins/Reports/contributions/tasks.daily.ts',
      `${imports} export default ${task};`,
    );
    await put(
      'src/plugins/Reports/contributions/tasks.ts',
      `${imports} export default { monthly: ${task} };`,
    );
    await put(
      'src/plugins/Reports/contributions/schedules/weekly.ts',
      "import { defineSchedule } from '@bitakit/scheduler'; export default defineSchedule({ task: 'REPORTS.WEEKLY', cron: '0 9 * * MON', input: { count: 1 } });",
    );
    await put(
      'src/plugins/Reports/server/contributions/tasks/secret.ts',
      "throw new Error('Server code entered discovery'); export default {};",
    );
    const result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result.warnings, []);
    assert.doesNotMatch(await readFile(result.generated, 'utf8'), /secret\.ts/);
    await put(
      'src/check.ts',
      `
      import { getService, type Services } from '@bitakit/core';
      import { scheduler } from '@bitakit/scheduler';
      declare const services: Services;
      const jobs = getService(services, scheduler);
      const weekly: Promise<number> = jobs.run('rEpOrTs.WeEkLy', { count: 1 });
      const monthly: Promise<number> = jobs.run('REPORTS.MONTHLY', { count: 1 });
      const daily: Promise<number> = jobs.run('reports.daily', { count: 1 });
      jobs.pause('external-runtime-id');
      // @ts-expect-error Input remains checked for mixed-case IDs.
      jobs.run('REPORTS.WEEKLY', { count: 'bad' });
      // @ts-expect-error Unknown executable tasks stay rejected.
      jobs.run('reports.unknown');
      void [weekly, monthly, daily];
    `,
    );
    const program = ts.createProgram([result.generated, join(root, 'src/check.ts')], {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(
      diagnostics.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => root,
        getNewLine: () => '\n',
      }),
    );
    const generated = await createJiti(import.meta.url, { moduleCache: false }).import(
      result.generated,
    );
    const runtime = createRuntime(generated.createBitaKitConfig());
    const stop = runtime.mount();
    try {
      await runtime.ready;
      assert.equal(await runtime.services.scheduler.run('reports.DAILY', { count: 7 }), 7);
    } finally {
      await stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
