import { defineInterceptor, definePlugin } from '@bitakit/core';

export default definePlugin({
  id: 'audit',
  interceptors: [
    defineInterceptor({
      service: 'scheduler',
      method: 'run',
      before: ({ callId, args }) => {
        console.info('Task started', { callId, task: args[0], schedule: args[2]?.schedule });
      },
      after: ({ callId, durationMs }) => console.info('Task completed', { callId, durationMs }),
      onError: ({ callId, durationMs }) => console.error('Task failed', { callId, durationMs }),
    }),
  ],
});
