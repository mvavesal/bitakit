'use client';
import { useCallback } from 'react';
import { useTranslation } from '@bitakit/ui';
import {
  categoryTitle,
  categoryTitleKey,
  defaultMessage,
  messageKey,
  type MessageKey,
  type MessageValues,
} from '../text.js';

/** Package texts through the runtime translator, with the English defaults as fallback. */
export function useMessages() {
  const t = useTranslation();
  return useCallback(
    (key: MessageKey, values?: MessageValues) =>
      t(messageKey(key), values, defaultMessage(key, values)),
    [t],
  );
}

/** Category titles use the package's shared English fallback when untranslated. */
export function useCategoryTitle() {
  const t = useTranslation();
  return useCallback((id: string) => t(categoryTitleKey(id), undefined, categoryTitle(id)), [t]);
}
