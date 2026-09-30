'use client';
import { SettingsField } from '@bitakit/app-preferences';
import { shellLayout } from './appearance.js';

/** The layout field with the Shell renderer; values stay in AppPreferences. */
export function ShellSettings() {
  return <SettingsField setting={shellLayout} />;
}
