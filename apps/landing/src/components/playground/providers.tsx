'use client';
import type { ReactNode } from 'react';
import { BitaKitProvider } from '@/bitakit.gen';
import { PlaygroundBridge } from './bridge';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <BitaKitProvider>
      <PlaygroundBridge />
      {children}
    </BitaKitProvider>
  );
}
