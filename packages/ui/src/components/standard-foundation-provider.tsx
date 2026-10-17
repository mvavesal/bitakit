'use client';
import { BitaKitRuntimeProvider } from '../providers/foundation-provider.js';
import type { BitaKitRuntimeProviderProps } from '../types/provider.js';

/** @deprecated BitaKitRuntimeProvider now carries the standard visuals and `additionalPlugins` itself. */
export type StandardBitaKitRuntimeProviderProps = BitaKitRuntimeProviderProps;
/** @deprecated Use BitaKitRuntimeProvider. */
export const StandardBitaKitRuntimeProvider = BitaKitRuntimeProvider;
