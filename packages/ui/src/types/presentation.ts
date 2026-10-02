import type { ComponentType, ReactNode } from 'react';
import '@bitakit/core';
declare module '@bitakit/core' {
  interface PresentationTypes {
    node: ReactNode;
    /** Pages receive `params`, dialogs `{ input, close, services }`, slots nothing; the host passes the props. */
    component: ComponentType<any>;
    provider: ComponentType<{ children: ReactNode }>;
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  }
}
