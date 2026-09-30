'use client';
import { useFoundation } from '../providers/foundation-context.js';
import type { ConfigAt, ConfigMap } from '@bitakit/core';

/** Reads the immutable runtime snapshot. A new provider composition supplies a new snapshot. */
export function usePluginConfig<K extends keyof ConfigMap & string, P extends string>(
  moduleId: K,
  path: P,
): ConfigAt<ConfigMap[K], P>;
export function usePluginConfig<T>(moduleId: string, path: string, fallback: T): T;
export function usePluginConfig(moduleId: string, path: string): unknown;
export function usePluginConfig(moduleId: string, path: string, fallback?: unknown): unknown {
  return useFoundation().runtime.configuration.plugin(moduleId).get(path, fallback);
}
