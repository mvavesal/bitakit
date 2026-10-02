import { defineBitaKit } from '@bitakit/core/discovery';
import { settingsDiscovery } from '@bitakit/app-preferences/discovery';

export default defineBitaKit({
  // The application's own settings catalog lives in src/settings; discovered preference
  // contributions read from contributions/preferences instead.
  kinds: settingsDiscovery({ directories: { settings: 'preferences' } }),
});
