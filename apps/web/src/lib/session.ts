import 'server-only';
import { headers } from 'next/headers';
import { getSessionCookie } from 'better-auth/cookies';
import { getAuth } from './auth';

export async function getSessionUser() {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders)) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
}
