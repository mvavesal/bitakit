import type { ComponentType, ReactNode } from 'react';
import type { ActionGroupsViewProps } from '@bitakit/ui/actions';
/** Supply existing design-system primitives once, not wrappers per feature. */
export type FoundationUI = {
  Dialog: ComponentType<{
    open: boolean;
    onOpenChange(open: boolean): void;
    children: ReactNode;
  }>;
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
  Menu: ComponentType<ActionGroupsViewProps & { label: string }>;
};
export type FoundationLabels = {
  cancel: string;
  submit: string;
  pending: string;
  invalid: string;
  unavailable: string;
};
