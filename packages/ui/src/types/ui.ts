import type { ComponentType, ReactNode } from 'react';
import type { BoundGroup } from '../hooks/use-action-group.js';
/** Supply existing design-system primitives once, not wrappers per feature. */
export type FoundationUI = {
  Dialog: ComponentType<{ open: boolean; onOpenChange(open: boolean): void; children: ReactNode }>;
  DialogContent: ComponentType<any>;
  DialogHeader: ComponentType<any>;
  DialogTitle: ComponentType<any>;
  DialogDescription: ComponentType<any>;
  DialogFooter: ComponentType<any>;
  Button: ComponentType<any>;
  Input: ComponentType<any>;
  Field: ComponentType<any>;
  FieldLabel: ComponentType<any>;
  FieldGroup: ComponentType<any>;
  FieldError: ComponentType<any>;
  /** Shows bound action groups; the standard one is a dropdown menu. */
  Menu: ComponentType<{ groups: readonly BoundGroup[]; label: string }>;
};
export type FoundationLabels = {
  cancel: string;
  confirm: string;
  submit: string;
  pending: string;
  invalid: string;
  unavailable: string;
};
