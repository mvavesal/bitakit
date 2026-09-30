import { defineSettingsRenderers, fieldRenderer } from '@bitakit/app-preferences';
import { ThemeCards } from '@bitakit/shell';
import { themeSetting } from '../settings/definitions';

// Reuse Shell's icon mapping and the standard Preferences choice cards.
export default defineSettingsRenderers({
  fields: [fieldRenderer(themeSetting, ThemeCards, { group: true })],
});
