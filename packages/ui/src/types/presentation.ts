import type { ComponentType, ReactNode } from 'react';
import '@bitakit/core';
declare module '@bitakit/core' {
 interface PresentationTypes {
  node: ReactNode;
  component: ComponentType;
  provider: ComponentType<{ children: ReactNode }>;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
 }
}
