'use client';
import { useCallback, useContext, useMemo, useSyncExternalStore, useEffect, useRef } from 'react';
import {
  authService,
  authSignInHref,
  configureAuthPaths,
  getService,
  resolveAuthReturnTo,
  type AuthSnapshot,
  type AuthSignInOptions,
} from '@bitakit/core';
import { useFoundation } from '../providers/foundation-context.js';
import { UIContext } from '../providers/action-context.js';

const loading: AuthSnapshot = Object.freeze({ user: null, pending: true, error: null });
const missing: AuthSnapshot = Object.freeze({
  user: null,
  pending: false,
  error: new Error('No authentication service is registered.'),
});
const idle = () => () => {};
const serverSnapshot = () => loading;

/** Observes the adapter's existing session; never copies it into a second store. */
export function useAuth() {
  const { runtime, signOutIntent, setSignOutIntent } = useFoundation();
  const { navigate, pathname } = useContext(UIContext);
  const ready = useSyncExternalStore(runtime.subscribeReady, runtime.isReady, () => false);
  // The installed auth contract, read through its typed key; undefined until it is available.
  const current = () =>
    runtime.hasService('auth') ? getService(runtime.services, authService) : undefined;
  const service = ready ? current() : undefined;
  const source = useMemo(
    () => ({
      subscribe: service ? (listener: () => void) => service.subscribe(listener) : idle,
      getSnapshot: () => service?.getSnapshot() ?? (ready ? missing : loading),
    }),
    [service, ready],
  );
  const snapshot = useSyncExternalStore(source.subscribe, source.getSnapshot, serverSnapshot);
  const paths = useMemo(
    () => (service?.paths ? configureAuthPaths(service.paths) : undefined),
    [service?.paths],
  );
  const signIn = useCallback(
    async (options: AuthSignInOptions = {}) => {
      if (!service) throw new Error('Authentication is not ready.');
      const returnTo = paths ? resolveAuthReturnTo(paths, options.returnTo) : undefined;
      if (service.signIn) return service.signIn({ returnTo });
      if (!paths) throw new Error('Configure auth paths or an SDK-native signIn handler.');
      if (!navigate) throw new Error('Authentication navigation requires an ActionProvider.');
      navigate(authSignInHref(paths, returnTo));
    },
    [service, paths, navigate],
  );
  const currentPath = pathname ?? (typeof window === 'undefined' ? '' : window.location.pathname);
  const previousUser = useRef(snapshot.user);
  useEffect(() => {
    if (
      signOutIntent?.service === service &&
      signOutIntent?.completed &&
      (signOutIntent.fromPath !== currentPath || (previousUser.current === null && snapshot.user))
    )
      setSignOutIntent?.(null);
    previousUser.current = snapshot.user;
  }, [service, signOutIntent, snapshot.user, setSignOutIntent, currentPath]);
  const signOut = useCallback(async () => {
    if (!service) throw new Error('Authentication is not ready.');
    if (paths && !navigate)
      throw new Error('Authentication navigation requires an ActionProvider.');
    if (paths) setSignOutIntent?.({ service, completed: false, fromPath: currentPath });
    try {
      await service.signOut();
    } catch (error) {
      if (runtime.isReady() && current() === service) setSignOutIntent?.(null);
      throw error;
    }
    if (!runtime.isReady() || current() !== service) return;
    if (paths) setSignOutIntent?.({ service, completed: true, fromPath: currentPath });
    // A removed/replaced adapter must not redirect a newer runtime after completion.
    if (paths && runtime.isReady() && current() === service) {
      if (!navigate) throw new Error('Authentication navigation requires an ActionProvider.');
      navigate(paths.afterSignOut);
    }
  }, [service, paths, navigate, runtime, setSignOutIntent, currentPath]);
  const signOutRequested =
    !!signOutIntent &&
    signOutIntent.service === service &&
    !snapshot.user &&
    (!signOutIntent.completed || signOutIntent.fromPath === currentPath);
  return { ...snapshot, paths, signIn, signOut, signOutRequested };
}
