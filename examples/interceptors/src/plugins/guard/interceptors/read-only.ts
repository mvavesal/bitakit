import { defineInterceptor } from '@bitakit/core';

// A gate from outside: while read-only mode is on, the three changing Actions of the customers
// plugin are skipped (reason "intercepted"), and Shell's notifications say why. Navigation
// stays allowed because it is not listed. When the owner knows a rule itself, `enabled` on its
// Action is the better place.
export default defineInterceptor({
  action: ['customers.add', 'customers.archive', 'customers.remove'],
  scope: 'global',
  requires: ['notifications'],
  before: ({ id, app, services }) => {
    if (!app.settings.guard.readOnly.get()) return true;
    services.guard.blocked.record(id);
    services.notifications.show('Read-only mode is on', {
      type: 'warning',
      description: 'Turn it off under Settings → Guard to change customers.',
    });
    return false;
  },
});
