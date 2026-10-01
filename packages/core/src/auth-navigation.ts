import { safeHref } from './actions/navigation.js';

/** Application-owned destinations, independent of provider SDKs and routers. */
export type AuthPaths = Readonly<{
  signIn: string;
  afterSignIn: string;
  afterSignOut: string;
}>;
export type AuthSignInOptions = { returnTo?: string };

function internalPath(value: string | undefined): string | undefined {
  if (!value?.startsWith('/') || value.startsWith('//') || !safeHref(value)) return undefined;
  // URL normalization must not turn a root-relative path into a protocol-relative target.
  if (new URL(value, 'https://foundation.invalid').pathname.startsWith('//')) return undefined;
  return value;
}

export function configureAuthPaths(paths: AuthPaths): AuthPaths {
  for (const value of [paths.signIn, paths.afterSignIn, paths.afterSignOut]) {
    if (!internalPath(value)) throw new Error('Auth paths must be safe root-relative application URLs.');
  }
  if (pathname(paths.signIn) === pathname(paths.afterSignIn)) {
    throw new Error('The post-login destination must differ from the login page.');
  }
  return Object.freeze({ ...paths });
}

function pathname(value: string) {
  return new URL(value, 'https://foundation.invalid').pathname.replace(/\/+$/, '') || '/';
}

/** Reject external return URLs and login loops; the configured fallback is authoritative. */
export function resolveAuthReturnTo(paths: AuthPaths, returnTo?: string): string {
  configureAuthPaths(paths);
  const target = internalPath(returnTo);
  return target && pathname(target) !== pathname(paths.signIn) ? target : paths.afterSignIn;
}

export function authSignInHref(paths: AuthPaths, returnTo?: string): string {
  const url = new URL(paths.signIn, 'https://foundation.invalid');
  url.searchParams.set('returnTo', resolveAuthReturnTo(paths, returnTo));
  return `${url.pathname}${url.search}${url.hash}`;
}
