'use client';
import { useCallback } from 'react';
import { fallbackTitle } from '@bitakit/core';
import { useTranslation } from '@bitakit/ui';
import {
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

/** Category titles: `settings.categories.<id>.title`, otherwise the ID in title case. */
export function useCategoryTitle() {
  const t = useTranslation();
  return useCallback(
    (id: string) => t(categoryTitleKey(id), undefined, fallbackTitle({ id })),
    [t],
  );
}
