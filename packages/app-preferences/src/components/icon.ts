import type { ComponentType } from 'react';

export type IconComponent = ComponentType<{
  className?: string;
  'aria-hidden'?: boolean | 'true';
  'data-icon'?: string;
}>;
/** Icons are opaque presentation values in the catalog; components render, anything else does not. */
export function iconOf(icon: unknown): IconComponent | undefined {
  return typeof icon === 'function' || (typeof icon === 'object' && icon !== null)
    ? (icon as IconComponent)
    : undefined;
}
