'use client';
import { FoundationProvider } from '../providers/foundation-provider.js';
import type { FoundationProviderProps } from '../types/provider.js';

/** @deprecated FoundationProvider now carries the standard visuals and `additionalPlugins` itself. */
export type StandardFoundationProviderProps = FoundationProviderProps;
/** @deprecated Use FoundationProvider. */
export const StandardFoundationProvider = FoundationProvider;
