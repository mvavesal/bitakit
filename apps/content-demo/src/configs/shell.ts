import { defineConfig } from '@bitakit/core';
import type { ShellOptions } from '@bitakit/shell';

export default defineConfig({
  defaults: {
    navigationSlot: 'shell.navigation',
  } satisfies ShellOptions,
});
