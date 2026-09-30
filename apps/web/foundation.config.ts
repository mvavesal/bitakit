import { defineFoundation } from '@bitakit/core/discovery';
import { settingsDiscovery } from '@bitakit/app-preferences/discovery';
export default defineFoundation({
  kinds: settingsDiscovery({ directories: { settings: 'preferences' } }),
  actions: { directory: './src/actions' },
  interceptors: { enabled: ['organization', 'logger'] },
  plugins: {
    directory: './src/plugins',
    autoEnable: true,
    overrides: { demo: { enabled: true } },
  },
});
