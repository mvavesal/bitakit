import Color from 'colorjs.io';
import type { AppPreferences } from '@bitakit/app-preferences/core';
import { themePreferences } from '../settings/theme.js';

/** Select a readable foreground using the standard WCAG contrast implementation. */
export function primaryForeground(value: string): string {
  const color = new Color(value);
  return color.contrastWCAG21('black') >= color.contrastWCAG21('white') ? '#000000' : '#ffffff';
}

/** Project confirmed preferences only; preserve host values and release every subscription. */
export function bindThemePreferences(settings: AppPreferences, root: HTMLElement): () => void {
  const properties = [
    '--primary',
    '--primary-foreground',
    '--sidebar-primary',
    '--sidebar-primary-foreground',
  ];
  const previous = properties.map((name) => [
    name,
    root.style.getPropertyValue(name),
    root.style.getPropertyPriority(name),
  ]);
  const attributes = ['data-shell-corners', 'data-shell-surface', 'data-shell-sidebar-theme'];
  const previousAttributes = attributes.map((name) => [name, root.getAttribute(name)] as const);
  const restoreColors = () =>
    previous.forEach(([name, value, priority]) => {
      if (value) root.style.setProperty(name!, value, priority);
      else root.style.removeProperty(name!);
    });
  const apply = () => {
    const primary = settings.get(themePreferences.fields.primary);
    if (primary.ready) {
      if (primary.value === 'default') restoreColors();
      else {
        const foreground = primaryForeground(primary.value);
        root.style.setProperty('--primary', primary.value);
        root.style.setProperty('--primary-foreground', foreground);
        root.style.setProperty('--sidebar-primary', primary.value);
        root.style.setProperty('--sidebar-primary-foreground', foreground);
      }
    }
    const sidebarTheme = settings.get(themePreferences.fields.sidebarTheme);
    if (sidebarTheme.ready) root.setAttribute('data-shell-sidebar-theme', sidebarTheme.value);
    const corners = settings.get(themePreferences.fields.corners);
    const surface = settings.get(themePreferences.fields.surface);
    if (corners.ready) root.setAttribute('data-shell-corners', corners.value);
    if (surface.ready) root.setAttribute('data-shell-surface', surface.value);
  };
  const stops = themePreferences.settings.map((field) => settings.subscribe(field, apply));
  apply();
  return () => {
    stops.forEach((stop) => stop());
    restoreColors();
    previousAttributes.forEach(([name, value]) =>
      value === null ? root.removeAttribute(name) : root.setAttribute(name, value),
    );
  };
}
