import { defineConfig } from '@bitakit/core';
import type { ShellOptions } from '@bitakit/shell';

// Shell options: https://github.com/mvavesal/bitakit/tree/main/packages/shell
export default defineConfig({
  defaults: {
    // Action slot shown in the navigation; theme presets are CSS under [data-theme-preset="<id>"].
    navigationSlot: 'shell.navigation',
  } satisfies ShellOptions,
});
