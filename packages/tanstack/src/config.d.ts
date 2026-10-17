import type { Plugin } from 'vite';
import type { DiscoveryConfig, GenerateResult } from '@bitakit/discovery';
export type { DiscoveryConfig } from '@bitakit/discovery';
export function bitakit(): Plugin;
export function generateBitaKit(root: string): Promise<GenerateResult>;
export function defineBitaKit(config: DiscoveryConfig): DiscoveryConfig;
