import type { FoundationLabels } from '../types/ui.js';

/** Default copy; applications may supply translated labels without replacing the UI. */
export const defaultLabels: FoundationLabels = {
  cancel: 'Cancel',
  submit: 'Save',
  pending: 'Saving …',
  invalid: 'Please check your input.',
  unavailable: 'Unavailable',
};
