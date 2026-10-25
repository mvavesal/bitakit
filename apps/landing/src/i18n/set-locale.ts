'use server';

import { cookies } from 'next/headers';
import { isLocale, localeCookie } from './config';

/** Stores the playground language in its validated cookie; the request config reads it. */
export async function setLocale(value: unknown) {
  if (!isLocale(value)) throw new Error('Unsupported language');
  (await cookies()).set(localeCookie, value, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
}
