'use client';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/use-auth.js';
import { UIContext } from '../providers/action-context.js';

export type AuthBoundaryProps = {
  children: ReactNode;
  pending?: ReactNode;
  unauthenticated?: ReactNode;
  renderError?: (error: unknown) => ReactNode;
  /** Safe internal destination after login. Defaults to the current browser URL. */
  returnTo?: string;
  /** Set false to render the unauthenticated state without starting login. */
  redirect?: boolean;
};

/** Client rendering/redirect convenience; server routes and data still enforce authorization. */
export function AuthBoundary({
  children,
  pending = null,
  unauthenticated = null,
  renderError,
  returnTo,
  redirect = true,
}: AuthBoundaryProps) {
  const auth = useAuth();
  const { pathname } = useContext(UIContext);
  const [failure, setFailure] = useState<{
    signIn: typeof auth.signIn;
    target?: string;
    error: unknown;
  }>();
  const attempt = useRef<{
    signIn: typeof auth.signIn;
    target: string;
    promise: Promise<void>;
  } | null>(null);
  useEffect(() => {
    if (auth.pending || auth.error || auth.signOutRequested || !redirect) return;
    if (auth.user) {
      attempt.current = null;
      return;
    }
    const target =
      returnTo ??
      (pathname && pathname !== window.location.pathname
        ? pathname
        : `${window.location.pathname}${window.location.search}${window.location.hash}`);
    // Avoid a redirect loop when the host accidentally wraps its login page too.
    if (
      auth.paths &&
      new URL(auth.paths.signIn, window.location.origin).pathname.replace(/\/+$/, '') ===
        (pathname ?? window.location.pathname).replace(/\/+$/, '')
    )
      return;
    if (
      !attempt.current ||
      attempt.current.signIn !== auth.signIn ||
      attempt.current.target !== target
    ) {
      attempt.current = { signIn: auth.signIn, target, promise: auth.signIn({ returnTo: target }) };
    }
    let active = true;
    void attempt.current.promise.catch((error) => {
      if (active) setFailure({ signIn: auth.signIn, target: returnTo, error });
    });
    return () => {
      active = false;
    };
  }, [
    auth.pending,
    auth.error,
    auth.signOutRequested,
    auth.user,
    auth.signIn,
    auth.paths,
    pathname,
    returnTo,
    redirect,
  ]);
  const error =
    auth.error ??
    (!auth.user &&
    !auth.pending &&
    redirect &&
    failure?.signIn === auth.signIn &&
    failure?.target === returnTo
      ? failure?.error
      : null);
  if (error) {
    if (renderError) return renderError(error);
    throw error;
  }
  if (auth.pending) return pending;
  return auth.user ? children : unauthenticated;
}
