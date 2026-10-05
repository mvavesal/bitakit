'use client';
import { createElement, useSyncExternalStore, type ReactNode } from 'react';
import { useFoundation } from '../providers/foundation-context.js';
import { useFoundationNavigation } from '../hooks/use-foundation-navigation.js';
import { useFoundationReady } from './plugin-slot.js';
import { findPluginPage } from '@bitakit/core';

/**
 * Renders the plugin page registered for the current path and passes its `params`
 * (`ui/pages/tasks/[id].tsx` receives `{ id }`). The pathname defaults to the framework
 * adapter's router; pass it explicitly for other hosts.
 */
export function PluginPage({
  pathname,
  fallback = null,
  unavailable = null,
}: {
  pathname?: string;
  fallback?: ReactNode;
  /** Shown while the matched page's owner is updating, failed or blocked. */
  unavailable?: ReactNode;
}) {
  const { runtime } = useFoundation();
  const navigation = useFoundationNavigation();
  useSyncExternalStore(runtime.lifecycle.subscribe, runtime.lifecycle.get, runtime.lifecycle.get);
  const page = findPluginPage(runtime.modules, pathname ?? navigation.pathname ?? '/');
  const ready = useFoundationReady(page?.plugin);
  if (!ready) return unavailable;
  return page
    ? createElement(page.component as never, { key: page.key, params: page.params })
    : fallback;
}
/**
 * The current plugin page, its parameters and layout name; undefined outside plugin pages.
 * Pages are static, so layouts can read this before the runtime is ready.
 */
export function useCurrentPage(pathname?: string) {
  const { runtime } = useFoundation();
  const navigation = useFoundationNavigation();
  useSyncExternalStore(runtime.lifecycle.subscribe, runtime.lifecycle.get, runtime.lifecycle.get);
  return findPluginPage(runtime.modules, pathname ?? navigation.pathname ?? '/');
}
