import { defineInterceptor } from '@bitakit/core';

// A rule over another plugin's Action: adding a title that exists is skipped quietly.
export default defineInterceptor({
  action: 'notes.add',
  // Without this, an interceptor only sees the Actions of its own plugin.
  scope: 'global',
  before: ({ input, services }) => {
    const title = String(input ?? '')
      .trim()
      .toLowerCase();
    // Returning false skips the run; any other value lets it continue.
    return !services.notes.list.state
      .get()
      .notes.some((note) => note.title.toLowerCase() === title);
  },
});
