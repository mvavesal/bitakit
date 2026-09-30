import { serviceKey } from '@bitakit/core';
import type { AppPreferences } from '@bitakit/app-preferences/core';
export const shellService = serviceKey<{ settings: AppPreferences }>('shell');
