export const THEME_STORAGE_KEY = 'saas-foundation.theme';
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';
export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

// Runs in <head> before paint; only application constants enter this script.
export const themeBootstrapScript = `(() => {
  let preference = 'system';
  try { const saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {}
  const dark = preference === 'dark' || (preference === 'system' && matchMedia(${JSON.stringify(THEME_MEDIA_QUERY)}).matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePreference = preference;
})();`;
