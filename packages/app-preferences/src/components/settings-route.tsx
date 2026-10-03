'use client';
import type { ElementType } from 'react';
import { useSettingsCatalog } from '@bitakit/ui';
import { visibleSections } from '../catalog.js';
import { groupByCategory } from '../categories.js';
import { isBasePath, sectionHref } from '../paths.js';
import { SettingsLocationContext, useSettingsLocation } from './location.js';
import { SettingsPage } from './settings-page.js';
import { SettingsShell } from './settings-shell.js';
import { useCategoryTitle } from './use-messages.js';

export type SettingsRouteProps = {
  /** Where this route is mounted. Default: `/settings`. */
  basePath?: string;
  /** The current path; the router's pathname when omitted. */
  pathname?: string;
  /** Target of the back link. Default: `/`. */
  backHref?: string;
  /** Link component for navigation; the framework adapter's link when omitted. */
  linkComponent?: ElementType;
};

/**
 * The complete settings route for `/settings/[[...section]]`: shell, navigation, breadcrumb
 * and the current page. The base path alone shows the first page, so no redirect is needed.
 */
export function SettingsRoute({
  basePath,
  pathname,
  backHref = '/',
  linkComponent,
}: SettingsRouteProps) {
  const location = useSettingsLocation({ basePath, pathname, Link: linkComponent });
  const categoryTitle = useCategoryTitle();
  const sections = visibleSections(useSettingsCatalog());
  const first = groupByCategory(sections, (section) => section.category, categoryTitle)[0]
    ?.items[0];
  const current = location.pathname ?? location.basePath;
  const resolved =
    first && isBasePath(current, location.basePath)
      ? sectionHref(location.basePath, first)
      : current;
  return (
    <SettingsLocationContext.Provider value={{ ...location, pathname: resolved }}>
      <SettingsShell backHref={backHref}>
        <SettingsPage />
      </SettingsShell>
    </SettingsLocationContext.Provider>
  );
}
