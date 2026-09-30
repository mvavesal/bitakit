import { defineConfig } from '@bitakit/core';
import type { ShellOptions } from '@bitakit/shell';

export default defineConfig({
  defaults: {
    appearance: true,
    notifications: true,
    pluginManagement: true,
    groups: [],
  } satisfies ShellOptions,
});
