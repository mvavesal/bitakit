import { getService, translationService } from '@bitakit/core';
import { defineAction } from '@bitakit/core';

export default defineAction({
  groups: ['demo.actions'],
  requires: [translationService],
  watch: ['demoPreferences'],
  resolve: (_, { services }) => ({ enabled: services.demoPreferences.enabled }),
  execute: ({ services }) =>
    getService(services, translationService).translate('demo.hello.message'),
  success: ({ result }) => result,
});
