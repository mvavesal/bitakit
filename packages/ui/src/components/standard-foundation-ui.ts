import type { FoundationUI } from '../types/ui.js';
import { Button } from './primitives/button.js';
import { Input } from './primitives/input.js';
import { Field, FieldError, FieldGroup, FieldLabel } from './primitives/field.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './primitives/dialog.js';
import { StandardActionMenu } from './standard-action-menu.js';

/** Ready-to-use standard visuals for Foundation bindings, inheriting host theme tokens. */
export const standardFoundationUI: FoundationUI = {
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
