'use client';
import UsersIcon from 'reicon-react/icons/Users';
import BuildingIcon from 'reicon-react/icons/Building';
import { definePlugin, defineSettings, type Plugin } from '@bitakit/core';
import { organizationActions, organizationSettingsPath } from './actions/organizations.js';
import { OrganizationsPage } from './components/organizations/pages.js';
import { OrganizationSettingsPage } from './settings/organizations.js';

export type OrganizationUIOptions = {
  /** Path of the standalone management page; false omits the page and its navigation action. */
  path?: string | false;
  /** Groups of the standalone page's navigation action; `navigation` by default. */
  groups?: readonly string[];
  /** Marks the standalone page as a local demo with sample data. */
  demo?: boolean;
};

/** UI and navigation are optional; all toolbars render public extension groups. */
export function organizationUIPlugin(options: OrganizationUIOptions = {}): Plugin {
  return definePlugin({
    id: 'organizations-ui',
    metadata: {
      icon: UsersIcon,
      name: 'Organization management',
      description: 'Members, invitations and organization profile.',
    },
    dependencies: ['organizations'],
    settings: defineSettings(
      {},
      {
        title: 'Organization',
        description: 'Profile, members and invitations of the active organization.',
        icon: BuildingIcon,
        category: 'organization',
        order: 10,
        path: organizationSettingsPath,
        // The settings navigation action of this section carries the shortcut.
        shortcut: 'Alt+Shift+O',
      },
    ),
    actions: organizationActions(options),
    ui: {
      settings: { component: OrganizationSettingsPage },
      pages:
        options.path === false
          ? []
          : [
              {
                path: options.path ?? '/organizations',
                component: () => <OrganizationsPage demo={options.demo} />,
              },
            ],
    },
  });
}
