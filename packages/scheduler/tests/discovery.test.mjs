import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { generateBitaKit, migrateProject } from '@bitakit/discovery';
import { createRuntime } from '@bitakit/core';
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
    await put(
      'src/plugins/Reports/server/actions/monthly.ts',
      "import { defineAction } from '@bitakit/core/server'; import { getService } from '@bitakit/core'; import { scheduler } from '@bitakit/scheduler'; export default defineAction({ access: 'public', execute: ({ services }) => getService(services, scheduler).run('reports.monthly', { count: 3 }) });",
    );
    // The old places keep running where they ran before (the browser composition), each with a
    // warning, until the next minor version.
    await put('src/plugins/Reports/lib/count.ts', 'export const count = 3;');
    await put(
      'src/plugins/Reports/contributions/tasks.ts',
      `${imports} import { count } from '../lib/count'; export default { monthly: defineTask({ input: z.object({ count: z.number() }), execute: ({ input }) => input.count * count }) };`,
    );
    await put('src/plugins/Reports/contributions/tasks/yearly.json', '{ "factor": 12 }');
    await put(
      'src/plugins/Reports/contributions/tasks/yearly.ts',
      `${imports} import data from './yearly.json'; import { count } from '../../lib/count'; export default defineTask({ execute: () => data.factor * count });`,
    );
    await put(
      'src/plugins/Reports/contributions/schedules/monthly.ts',
      "import { defineSchedule } from '@bitakit/scheduler'; export default defineSchedule({ task: 'reports.monthly', cron: '0 9 1 * *', input: { count: 1 } });",
    );
    await put('src/plugins/Reports/tasks.hourly.ts', `${imports} export default ${task};`);
    await put('src/plugins/Reports/tasks/-helper.ts', 'export const one = 1;');
    await put(
      'src/plugins/Reports/tasks/nightly/index.ts',
      `${imports} import { one } from '../-helper'; export default defineTask({ execute: () => one });`,
    );
    await put(
      'src/plugins/Reports/lib/uses.ts',
      "export { default } from '../contributions/tasks/yearly';",
    );
    await put(
      'tests/yearly.test.ts',
      "import yearly from '../src/plugins/Reports/contributions/tasks/yearly';\nvoid yearly;",
    );
    let result = await generateBitaKit(root, { quiet: true });
    const old = [
      'src/plugins/Reports/contributions/schedules/monthly.ts',
      'src/plugins/Reports/contributions/tasks.ts',
      'src/plugins/Reports/contributions/tasks/yearly.ts',
      'src/plugins/Reports/tasks.hourly.ts',
      'src/plugins/Reports/tasks/nightly/index.ts',
    ];
    assert.deepEqual(
      result.warnings.map((warning) => warning.slice(0, warning.indexOf(':'))).sort(),
      old,
    );
    assert.ok(result.warnings.every((warning) => warning.includes('runs on the server now')));
    // The browser composition keeps the old places; the server file holds only server/.
    const clientSource = await readFile(result.generated, 'utf8');
    const serverSource = await readFile(result.server, 'utf8');
    assert.match(serverSource, /import packageServer0 from "@bitakit\/scheduler\/server";/);
    for (const file of ['tasks/weekly', 'tasks.daily', 'schedules/weekly']) {
      assert.ok(serverSource.includes(`/Reports/server/contributions/${file}';`), file);
      assert.ok(!clientSource.includes(`/server/contributions/${file}'`), file);
    }
    assert.ok(clientSource.includes(`/Reports/contributions/tasks';`));
    assert.ok(!serverSource.includes(`/Reports/contributions/`));
    const client = createRuntime(
      (
        await createJiti(import.meta.url, { moduleCache: false }).import(result.generated)
      ).createBitaKitConfig(),
    );
    const stopClient = client.mount();
    try {
      await client.ready;
      assert.equal(await client.services.scheduler.run('reports.monthly', { count: 2 }), 6);
      assert.equal(await client.services.scheduler.run('reports.yearly'), 36);
    } finally {
      await stopClient();
    }
    // One ID in the old place and in server/ would run twice: generation refuses it.
    await put(
      'src/plugins/Reports/contributions/tasks/weekly.ts',
      `${imports} export default ${task};`,
    );
    await assert.rejects(
      generateBitaKit(root, { quiet: true }),
      /"weekly" of the contribution kind "scheduler\.tasks" is in src\/plugins\/Reports\/contributions\/tasks\/weekly\.ts and src\/plugins\/Reports\/server\/contributions\/tasks\/weekly\.ts; both would run/,
    );
    await rm(join(root, 'src/plugins/Reports/contributions/tasks/weekly.ts'));
    // A dry run reports the same moves and touches nothing.
    const dry = await migrateProject(root, { dryRun: true });
    assert.ok(dry.changes.some((change) => change.to?.endsWith('server/contributions/tasks.ts')));
    await readFile(join(root, 'src/plugins/Reports/contributions/tasks.ts'), 'utf8');
    // `bitakit migrate` moves both kinds at once, whole folders with their data files, dotted and
    // record files and old root contributions; imports keep pointing at the same files.
    const { changes } = await migrateProject(root);
    const moves = changes
      .filter((change) => change.detail?.includes('runs on the server'))
      .map(({ from, to }) => [from, to])
      .sort();
    const reports = 'src/plugins/Reports';
    assert.deepEqual(moves, [
      [
        `${reports}/contributions/schedules/monthly.ts`,
        `${reports}/server/contributions/schedules/monthly.ts`,
      ],
      [`${reports}/contributions/tasks.ts`, `${reports}/server/contributions/tasks.ts`],
      [
        `${reports}/contributions/tasks/yearly.json`,
        `${reports}/server/contributions/tasks/yearly.json`,
      ],
      [
        `${reports}/contributions/tasks/yearly.ts`,
        `${reports}/server/contributions/tasks/yearly.ts`,
      ],
      [`${reports}/tasks.hourly.ts`, `${reports}/server/contributions/tasks.hourly.ts`],
      [
        `${reports}/tasks/nightly/index.ts`,
        `${reports}/server/contributions/tasks/nightly/index.ts`,
      ],
    ]);
    const moved = (file) => readFile(join(root, reports, 'server/contributions', file), 'utf8');
    assert.match(await moved('tasks.ts'), /from '\.\.\/\.\.\/lib\/count'/);
    assert.match(
      await moved('tasks/yearly.ts'),
      /from '\.\/yearly\.json'.*from '\.\.\/\.\.\/\.\.\/lib\/count'/,
    );
    assert.match(
      await moved('tasks/nightly/index.ts'),
      /from '\.\.\/\.\.\/\.\.\/\.\.\/tasks\/-helper'/,
    );
    // The helper without a default export stays; emptied folders are gone.
    await readFile(join(root, reports, 'tasks/-helper.ts'), 'utf8');
    for (const folder of ['contributions/tasks', 'contributions/schedules', 'tasks/nightly'])
      await assert.rejects(stat(join(root, reports, folder)), { code: 'ENOENT' }, folder);
    // Importers elsewhere, tests included, are reported, not rewritten.
    assert.deepEqual(
      changes
        .filter((change) => change.detail?.includes('update the import'))
        .map((change) => change.from)
        .sort(),
      [`${reports}/lib/uses.ts`, 'tests/yearly.test.ts'],
    );
    await put(
      'src/plugins/Reports/lib/uses.ts',
      "export { default } from '../server/contributions/tasks/yearly';",
    );
    await rm(join(root, 'tests'), { recursive: true });
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
        resolveJsonModule: true,
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
    // An `entries` override still names the old, browser place: read there with the warning,
    // and migrate reports it (it cannot edit plugin.config.ts).
    await put(
      'src/plugins/Jobs/plugin.config.ts',
      "export default { id: 'jobs', entries: { 'scheduler.tasks': './jobs' } };",
    );
    await put('src/plugins/Jobs/jobs/nightly.ts', `${imports} export default ${task};`);
    result = await generateBitaKit(root, { quiet: true });
    assert.deepEqual(
      result.warnings.map((warning) => warning.slice(0, warning.indexOf(':'))),
      ['src/plugins/Jobs/jobs/nightly.ts'],
    );
    assert.ok((await readFile(result.generated, 'utf8')).includes('/Jobs/jobs/nightly'));
    assert.ok(!(await readFile(result.server, 'utf8')).includes('/Jobs/jobs/'));
    const override = await migrateProject(root, { dryRun: true });
    assert.ok(
      override.changes.some(
        (change) =>
          change.from === 'src/plugins/Jobs/plugin.config.ts' &&
          change.detail.includes('"scheduler.tasks"'),
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
