'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useBitaKit, useService, useSetting } from '@bitakit/ui';

import { themeDefaults } from '../../theme-defaults.js';
import { themeTokens } from '../../themes.js';
import { themeService, type ThemeService } from '../../services/themes.js';

type ThemeBaseline = Record<'light' | 'dark', Record<string, string>>;
const AppThemeContext = createContext<ThemeBaseline>(themeDefaults);
export const useAppThemeBaseline = () => useContext(AppThemeContext);

/** Read app CSS before owned overrides are applied, restoring the root synchronously. */
export function readAppThemeBaseline(): ThemeBaseline {
  const root = document.documentElement;
  const wasDark = root.classList.contains('dark');
  const wasLight = root.classList.contains('light');
  const baseline: ThemeBaseline = { light: {}, dark: {} };
  try {
    for (const mode of ['light', 'dark'] as const) {
      root.classList.toggle('dark', mode === 'dark');
      root.classList.toggle('light', mode === 'light');
      const computed = getComputedStyle(root);
      for (const key of new Set([
        ...Object.keys(themeDefaults.light),
        ...Object.keys(themeDefaults.dark),
      ])) {
        baseline[mode][key] =
          computed.getPropertyValue(`--${key}`).trim() ||
          themeDefaults[mode][key] ||
          themeDefaults.light[key]!;
      }
    }
  } finally {
    root.classList.toggle('dark', wasDark);
    root.classList.toggle('light', wasLight);
  }
  return baseline;
}

const darkScheme = '(prefers-color-scheme: dark)';
/** Where the default browser settings storage keeps `shell.mode` (device scope, JSON). */
const modeKey = 'bitakit.settings.device/shell.mode';

function subscribeScheme(listener: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(darkScheme);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const prefersDark = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(darkScheme).matches;
const serverScheme = () => false;

/** Only confirmed values are projected; a value that is not loaded leaves the DOM unchanged. */
const confirmed = (state: { ready: boolean; value: unknown }) =>
  state.ready ? String(state.value) : undefined;

/** Sets an attribute on `<html>` and restores the value it had before on unmount. */
function useRootAttribute(name: string, value: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute(name);
    return () => {
      if (previous === null) root.removeAttribute(name);
      else root.setAttribute(name, previous);
    };
  }, [name]);
  useEffect(() => {
    if (value !== undefined) document.documentElement.setAttribute(name, value);
  }, [name, value]);
}

/** Toggles the `dark` class and `color-scheme` on `<html>` and restores both on unmount. */
function useColorScheme(dark: boolean | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    const scheme = root.style.colorScheme;
    return () => {
      root.classList.toggle('dark', wasDark);
      root.style.colorScheme = scheme;
    };
  }, []);
  useEffect(() => {
    if (dark === undefined) return;
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
}

/**
 * Projects the appearance settings onto `<html>`: the `dark` class and `color-scheme` from
 * `shell.mode` and the system preference, `data-density`, `data-shell-corners` and, with
 * presets, `data-theme-preset`. The CSS for these attributes comes from the theme.
 */
export function ShellTheme({ children }: { children: ReactNode }) {
  const { runtime } = useBitaKit();
  const [baseline, setBaseline] = useState<ThemeBaseline>(themeDefaults);
  const mode = confirmed(useSetting('shell.mode'));
  const systemDark = useSyncExternalStore(subscribeScheme, prefersDark, serverScheme);
  useColorScheme(
    mode === undefined ? undefined : mode === 'dark' || (mode === 'system' && systemDark),
  );
  useRootAttribute('data-density', confirmed(useSetting('shell.density')));
  useRootAttribute('data-shell-corners', confirmed(useSetting('shell.corners')));
  return (
    <AppThemeContext.Provider value={baseline}>
      <ThemeProjection
        onBaseline={setBaseline}
        dark={mode === 'dark' || (mode === 'system' && systemDark)}
        modeReady={mode !== undefined}
      />
      {runtime.settings.has('shell.preset') ? <PresetProjection /> : null}
      {children}
    </AppThemeContext.Provider>
  );
}
/** Root tokens also reach portaled controls. Switching removes all previous overrides. */
function ThemeProjection({
  dark,
  modeReady,
  onBaseline,
}: {
  dark: boolean;
  modeReady: boolean;
  onBaseline: (value: ThemeBaseline) => void;
}) {
  const library = useSetting('shell.themeLibrary');
  const service = useService(themeService) as ThemeService | undefined;
  const tokens = useMemo(
    () =>
      library.ready && modeReady && service
        ? themeTokens(service.active(), dark ? 'dark' : 'light')
        : undefined,
    [library.ready, library.value, service, dark, modeReady],
  );
  useEffect(() => {
    if (!tokens) return;
    onBaseline(readAppThemeBaseline());
    const style = document.documentElement.style;
    const previous = Object.keys(tokens).map((key) => {
      const name = `--${key}`;
      const value = style.getPropertyValue(name);
      const priority = style.getPropertyPriority(name);
      style.setProperty(name, tokens[key]!);
      return { name, value, priority };
    });
    return () => {
      for (const { name, value, priority } of previous) {
        if (value) style.setProperty(name, value, priority);
        else style.removeProperty(name);
      }
    };
  }, [tokens, onBaseline]);
  return null;
}

function PresetProjection() {
  useRootAttribute('data-theme-preset', confirmed(useSetting('shell.preset')));
  return null;
}

const script = `(function(){try{var r=document.documentElement,m="system";try{var v=localStorage.getItem(${JSON.stringify(modeKey)});if(v!==null)m=JSON.parse(v)}catch(e){}var d=m==="dark"||(m!=="light"&&matchMedia(${JSON.stringify(darkScheme)}).matches);r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

/**
 * Applies the stored color scheme before hydration so dark mode does not flash. Render it in
 * `<head>` (with `suppressHydrationWarning` on `<html>`). It reads the default browser storage
 * of `shell.mode`; with a different `settings.storage`, the system scheme applies until the
 * Shell provider has loaded the value.
 */
export function ShellThemeScript({ nonce }: { nonce?: string }) {
  return (
    <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />
  );
}
