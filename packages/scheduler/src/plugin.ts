import {
  defineContract,
  defineEvents,
  definePlugin,
  defineService,
  event,
  getService,
  scopeLifecycle,
  serviceKey,
  type ContributionContext,
} from '@bitakit/core';
import { createScheduler } from './engine.js';
import type { DiscoveredTask } from './discovered.js';
import type { Schedule, Scheduler, SchedulerNotice } from './types.js';

export const scheduler = defineContract('scheduler').of<Scheduler>();
const schedulerService = defineService(
  (context) => {
    const engine = createScheduler(context, {
      initiallyReady: false,
      dispatch: (id, input, options) =>
        getService(context.services, scheduler).run(id, input, options),
    });
    context.onStart(() => engine.start());
    context.onStop(() => engine.stop());
    return engine;
  },
  { id: 'scheduler-engine', provides: scheduler },
);

/** No platform is started implicitly: install in exactly the runtime that owns these jobs. */
export const schedulerPlugin = definePlugin({
  id: 'scheduler',
  services: [schedulerService],
  setup({ scope, services }) {
    const engine = getService(
      services,
      serviceKey<ReturnType<typeof createScheduler>>('scheduler-engine'),
    );
    return scopeLifecycle(scope).watch((snapshot) => engine.setReady(snapshot.phase === 'ready'));
  },
  events: defineEvents({
    started: event<SchedulerNotice>(),
    completed: event<SchedulerNotice>(),
    failed: event<SchedulerNotice>(),
  }),
  installs: {
    'scheduler.tasks': (values: readonly DiscoveredTask[], context: ContributionContext) => {
      const service = getService(context.services, scheduler);
      if (!context.config || !context.events || !context.settings)
        throw new Error(
          'Task contributions require a Core runtime that supplies the contributing owner context.',
        );
      const owner = {
        services: context.services,
        config: context.config,
        events: context.events,
        settings: context.settings,
      };
      const releases: (() => Promise<void>)[] = [];
      try {
        for (const { id, definition } of values)
          releases.push(service.registerTask(id, definition, owner));
      } catch (error) {
        for (const release of releases) void release();
        throw error;
      }
      return async () => {
        await Promise.all(releases.reverse().map((release) => release()));
      };
    },
    'scheduler.schedules': (values: readonly Schedule[], context: ContributionContext) => {
      const registration = getService(context.services, scheduler).registerSource({
        id: `defaults:${context.module}`,
        priority: -100,
        load: async () => values,
      });
      return () => registration.dispose();
    },
  },
});
export default function plugin() {
  return schedulerPlugin;
}

declare module '@bitakit/core' {
  interface ContributionMap {
    'scheduler.tasks': DiscoveredTask;
    'scheduler.schedules': Schedule;
  }
}
