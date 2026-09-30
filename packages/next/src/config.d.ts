import type { NextConfig } from 'next';
import type { DiscoveryConfig } from '@bitakit/core/discovery';
export type { DiscoveryConfig } from '@bitakit/core/discovery';
export function defineFoundation(config: DiscoveryConfig): DiscoveryConfig;
export function generateFoundation(root: string): Promise<void>;
export function withFoundation(config?: NextConfig): (phase: string) => Promise<NextConfig>;
