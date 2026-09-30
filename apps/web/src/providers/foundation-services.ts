import type { Confirmation } from '@bitakit/core';
import type { AppPreferences } from '@bitakit/app-preferences/core';

declare module '@bitakit/core' {
  interface ServiceMap {
    settings: AppPreferences;
    confirm: (request: Confirmation) => Promise<boolean>;
  }
}
