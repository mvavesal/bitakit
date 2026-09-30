'use client';
import { createElement, type ReactNode } from 'react';
import { useFoundation } from '../providers/foundation-context.js';
import { useFoundationReady } from './plugin-slot.js';
import { findPluginPage } from '@bitakit/core';

/** Host supplies its router's current pathname and missing-page presentation. */
export function PluginPage({
  pathname,
  fallback = null,
}: {
  pathname: string;
  fallback?: ReactNode;
}) {
  const { runtime } = useFoundation();
  const ready = useFoundationReady();
  if (!ready) return null;
  const page = findPluginPage(runtime.modules, pathname);
  return page ? createElement(page.component, { key: page.key }) : fallback;
}
