import { defineAction, getService, translationService } from '@bitakit/core';

export default defineAction({
  groups: ['demo.actions'],
  requires: [translationService],
  enabled: ({ services }) => services.demo.preferences.state.get().enabled,
  execute: ({ services }) =>
    getService(services, translationService).translate('demo.hello.message'),
  success: ({ result }) => result,
});
