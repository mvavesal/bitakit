'use server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, localeCookie, type Locale } from './config';

/** Reads the same validated cookie used by request configuration. */
export async function loadLocale(): Promise<Locale> {
  const value = (await cookies()).get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
}
/** Cookie mutation lets Next update translated server content without remounting the app. */
export async function saveLocale(value: Locale): Promise<void> {
  if (!isLocale(value)) throw new Error('Unsupported language');
  (await cookies()).set(localeCookie, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
}
/** Removes the override; the configured default applies again. */
export async function resetLocale(): Promise<Locale> {
  (await cookies()).delete(localeCookie);
  return defaultLocale;
}
