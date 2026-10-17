import type { NextConfig } from 'next';
import type { DiscoveryConfig, GenerateResult } from '@bitakit/discovery';
export type { DiscoveryConfig } from '@bitakit/discovery';
export function defineBitaKit(config: DiscoveryConfig): DiscoveryConfig;
export function generateBitaKit(root: string): Promise<GenerateResult>;
type ConfigInput =
  | NextConfig
  | ((phase: string, context: unknown) => NextConfig | Promise<NextConfig>);
export function withBitaKit(
  config?: ConfigInput,
): (phase: string, context: unknown) => Promise<NextConfig>;
