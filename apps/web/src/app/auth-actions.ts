'use server';

import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authReturnPath } from '@/lib/auth/return-path';
import { getAuth } from '@/lib/auth';

export type AuthState = { error: string };

async function authenticate(formData: FormData, registering: boolean): Promise<AuthState> {
  const t = await getTranslations('Auth');
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    password.length < (registering ? 8 : 1) ||
    password.length > 128
  ) {
    return { error: t('invalid') };
  }
  try {
    const auth = getAuth();
    const requestHeaders = await headers();
    if (registering) {
      await auth.api.signUpEmail({
        body: { email, password, name: email.split('@')[0] },
        headers: requestHeaders,
      });
    } else {
      await auth.api.signInEmail({ body: { email, password }, headers: requestHeaders });
    }
  } catch {
    return { error: registering ? t('createError') : t('loginError') };
  }
  redirect(authReturnPath(formData.get('returnTo')));
}
export async function login(_state: AuthState, formData: FormData) {
  return authenticate(formData, false);
}
export async function register(_state: AuthState, formData: FormData) {
  return authenticate(formData, true);
}
export async function logout() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect('/login');
}
