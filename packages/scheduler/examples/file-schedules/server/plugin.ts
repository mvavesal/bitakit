import { fileURLToPath } from 'node:url';
import { definePlugin, defineService, getService } from '@bitakit/core';
import { scheduler } from '@bitakit/scheduler';
import { fileSource } from '@bitakit/scheduler/server';

export default definePlugin({
  id: 'file-schedules',
  services: {
    source: defineService(
      ({ services, onStart, onStop }) => {
        onStart(async () => {
          const registration = getService(services, scheduler).registerSource(
            fileSource({
              id: 'host-file',
              priority: 10,
              path:
                process.env.BITAKIT_SCHEDULE_FILE ??
                fileURLToPath(new URL('./schedules.yaml', import.meta.url)),
            }),
          );
          onStop(() => registration.dispose());
          await registration.ready;
        });
        return {};
      },
      { requires: [scheduler] },
    ),
  },
});
