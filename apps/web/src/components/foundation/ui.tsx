'use client';
import type { FoundationUI } from '@bitakit/ui';
import { StandardActionMenu } from '@bitakit/ui/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/** Map the design system once; feature plugins contain no dialog/menu plumbing. */
export const foundationUI: FoundationUI = {
  Button,
  Input,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Menu: StandardActionMenu,
};
