'use client';
import { useCallback, useContext } from 'react';
import { BitaKitContext } from '../providers/foundation-context.js';
import { useTranslation } from './use-translation.js';

/**
 * Display title of an Action group: its own title, otherwise the title the app gave that group
 * ID, "General" for the default `navigation` group, otherwise the group ID. Shared by navigation
 * menus and search so headings match.
 */
export function useGroupTitle() {
  const t = useTranslation();
  const groups = useContext(BitaKitContext)?.runtime.groups;
  return useCallback(
    (group: { id: string; title?: string }) =>
      group.title ??
      groups?.get(group.id)?.title ??
      (group.id === 'navigation'
        ? t('foundationUI.navigation.general', undefined, 'General')
        : group.id),
    [t, groups],
  );
}
