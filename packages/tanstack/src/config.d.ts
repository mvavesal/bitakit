import type { Plugin } from 'vite';
import type { DiscoveryConfig, GenerateResult } from '@bitakit/core/discovery';
export type { DiscoveryConfig } from '@bitakit/core/discovery';
export function bitakit(): Plugin;
/** @deprecated Use bitakit(). */
export function foundation(): Plugin;
export function generateFoundation(root: string): Promise<GenerateResult>;
export function defineBitaKit(config: DiscoveryConfig): DiscoveryConfig;
/** @deprecated Use defineBitaKit. */
export function defineFoundation(config: DiscoveryConfig): DiscoveryConfig;
