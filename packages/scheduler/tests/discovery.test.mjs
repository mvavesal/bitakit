import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { generateBitaKit, migrateProject } from '@bitakit/discovery';
import { createJiti } from 'jiti';

test('tasks and schedules run in the generated server; the old place warns and migrates', async () => {
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
    // Tasks and schedules run on the server: folder, dotted and record forms under server/.
    await put(
      'src/plugins/Reports/server/contributions/tasks/weekly.ts',
      `${imports} export default ${task};`,
    );
    await put(
      'src/plugins/Reports/server/contributions/tasks.daily.ts',
      `${imports} export default ${task};`,
    );
    await put(
      'src/plugins/Reports/server/contributions/schedules/weekly.ts',
      "import { defineSchedule } from '@bitakit/scheduler'; export default defineSchedule({ task: 'REPORTS.WEEKLY', cron: '0 9 * * MON', input: { count: 1 } });",
    );
    // The old place still works on the server, with a warning, until the next minor version.
    await put(
      'src/plugins/Reports/contributions/tasks.ts',
      `${imports} export default { monthly: ${task} };`,
    );
    await put(
      'src/plugins/Reports/server/actions/monthly.ts',
      "import { defineAction } from '@bitakit/core/server'; import { getService } from '@bitakit/core'; import { scheduler } from '@bitakit/scheduler'; export default defineAction({ access: 'public', execute: ({ services }) => getService(services, scheduler).run('reports.monthly', { count: 3 }) });",
    );
    let result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result.warnings, [
      'src/plugins/Reports/contributions/tasks.ts: the contribution kind "scheduler.tasks" runs on the server now; move it under server/contributions/tasks/ (run "bitakit migrate"). The old location stops working in the next minor version.',
    ]);
    // The browser never imports a task; the server file holds them all.
    assert.doesNotMatch(await readFile(result.generated, 'utf8'), /tasks|schedules/);
    const serverSource = await readFile(result.server, 'utf8');
    assert.match(serverSource, /import packageServer0 from "@bitakit\/scheduler\/server";/);
    for (const file of ['tasks/weekly', 'tasks.daily', 'schedules/weekly'])
      assert.ok(serverSource.includes(`/Reports/server/contributions/${file}';`), file);
    assert.ok(serverSource.includes(`/Reports/contributions/tasks';`));
    // `bitakit migrate` moves the old place under server/, imports adjusted.
    await put('src/plugins/Reports/lib/count.ts', 'export const count = 3;');
    await put(
      'src/plugins/Reports/contributions/tasks.ts',
      `${imports} import { count } from '../lib/count'; export default { monthly: defineTask({ input: z.object({ count: z.number() }), execute: ({ input }) => input.count * count }) };`,
    );
    const { changes } = await migrateProject(root);
    assert.deepEqual(
      changes
        .filter((change) => change.detail?.includes('server'))
        .map(({ from, to }) => [from, to]),
      [
        [
          'src/plugins/Reports/contributions/tasks.ts',
          'src/plugins/Reports/server/contributions/tasks.ts',
        ],
      ],
    );
    assert.match(
      await readFile(join(root, 'src/plugins/Reports/server/contributions/tasks.ts'), 'utf8'),
      /from '\.\.\/\.\.\/lib\/count'/,
    );
    result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(result.warnings, []);
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
    const program = ts.createProgram(
      [result.server, result.generated, join(root, 'src/check.ts')],
      {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
      },
    );
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
    const { server } = await createJiti(import.meta.url, { moduleCache: false }).import(
      result.server,
    );
    try {
      await server.ready;
      assert.equal(
        await server.call('reports.monthly', undefined, new Headers(), { exposedOnly: false }),
        9,
      );
    } finally {
      await server.stop();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
