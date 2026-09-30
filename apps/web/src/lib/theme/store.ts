'use client';

import { flushSync } from 'react-dom';
import { parseThemePreference, THEME_MEDIA_QUERY, THEME_STORAGE_KEY } from './config';
import type { ThemePreference } from './config';

const CHANGE_EVENT = 'saas-foundation:theme-change';
let sessionPreference: ThemePreference | null = null;

function readPreference(): ThemePreference {
  if (sessionPreference) return sessionPreference;
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function getThemeSnapshot(): string {
  const preference = readPreference();
  const resolved =
    preference === 'system'
      ? window.matchMedia(THEME_MEDIA_QUERY).matches
        ? 'dark'
        : 'light'
      : preference;
  return `${preference}:${resolved}:${sessionPreference ? 'session' : 'saved'}`;
}

export function getServerThemeSnapshot(): string {
  return 'pending';
}

function applyTheme() {
  const [preference, resolved] = getThemeSnapshot().split(':');
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
  document.documentElement.dataset.themePreference = preference;
}

function commitPreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    sessionPreference = null;
  } catch {
    sessionPreference = preference;
  }
  applyTheme();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

let activeTransition: ViewTransition | null = null;
let preferenceRevision = 0;

export function setThemePreference(preference: ThemePreference): void {
  const revision = ++preferenceRevision;
  activeTransition?.skipTransition();
  const nextResolved =
    preference === 'system'
      ? window.matchMedia(THEME_MEDIA_QUERY).matches
        ? 'dark'
        : 'light'
      : preference;
  if (
    !document.startViewTransition ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    nextResolved === getThemeSnapshot().split(':')[1]
  ) {
    commitPreference(preference);
    return;
  }
  const transition = document.startViewTransition(() => {
    // A newer selection supersedes an update still waiting for its snapshot.
    if (revision === preferenceRevision) flushSync(() => commitPreference(preference));
  });
  activeTransition = transition;
  void transition.ready.catch(() => {
    /* Skipped animations still commit the preference. */
  });
  void transition.finished
    .catch(() => {})
    .finally(() => {
      if (activeTransition === transition) activeTransition = null;
    });
}

export function subscribeTheme(listener: () => void): () => void {
  const media = window.matchMedia(THEME_MEDIA_QUERY);
  const update = () => {
    applyTheme();
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    sessionPreference = null;
    update();
  };
  window.addEventListener(CHANGE_EVENT, update);
  window.addEventListener('storage', onStorage);
  media.addEventListener('change', update);
  applyTheme();
  return () => {
    window.removeEventListener(CHANGE_EVENT, update);
    window.removeEventListener('storage', onStorage);
    media.removeEventListener('change', update);
  };
}
