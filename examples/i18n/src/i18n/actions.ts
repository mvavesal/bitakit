'use server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, localeCookie, type Locale } from './config';

// Server actions behind the language setting. Changing the cookie makes Next render the
// server parts again in the new language, without reloading the page.

export async function loadLocale(): Promise<Locale> {
  const value = (await cookies()).get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function saveLocale(value: Locale): Promise<void> {
  if (!isLocale(value)) throw new Error('Unsupported language.');
  (await cookies()).set(localeCookie, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function resetLocale(): Promise<Locale> {
  (await cookies()).delete(localeCookie);
  return defaultLocale;
}
