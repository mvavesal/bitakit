import { createRuntime, definePlugin, discoveredFile, getService } from '@bitakit/core';
import { schedulerPlugin, scheduler, discoverTasks, discoverSchedules } from '@bitakit/scheduler';
import task from '../reports/contributions/tasks/weekly.ts';
import schedule from '../reports/contributions/schedules/weekly.ts';
import fileSchedules from '../file-schedules/server/plugin.ts';
import audit from '../audit/plugin.ts';

// Server discovery is not generated yet: compose the same declarations explicitly.
const reports = definePlugin({
  id: 'reports',
  contributions: {
    'scheduler.tasks': discoverTasks(
      [discoveredFile(task, 'weekly', 'reports/contributions/tasks/weekly.ts')],
      'reports',
    ),
    'scheduler.schedules': discoverSchedules(
      [discoveredFile(schedule, 'weekly', 'reports/contributions/schedules/weekly.ts')],
      'reports',
    ),
  },
});
const runtime = createRuntime({ plugins: [schedulerPlugin, reports, fileSchedules, audit] });
const stop = runtime.mount();
try {
  await runtime.ready;
  if (process.argv.includes('--once')) {
    await getService(runtime.services, scheduler).run('reports.weekly', { audience: 'team' });
    await stop();
  } else {
    const shutdown = () => {
      void stop().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    console.info('Scheduler ready. Edit the YAML file or send SIGINT to stop.');
  }
} catch (error) {
  await stop();
  throw error;
}
