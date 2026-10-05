'use client';
import EnvelopeIcon from 'reicon-react/icons/Envelope';
import UsersIcon from 'reicon-react/icons/Users';
import BuildingIcon from 'reicon-react/icons/Building';
import { definePlugin, defineSettings, type Plugin } from '@bitakit/core';
import { organizationSlots } from './slots.js';
import { organizationActions, organizationSettingsPath } from './actions/organizations.js';
import { OrganizationsPage } from './components/organizations/pages.js';
import {
  OrganizationSettingsPage,
  OrganizationSettingsAccess,
  OrganizationMembersAccess,
  OrganizationMembersPage,
  PersonalInvitationsPage,
  PersonalInvitationsAccess,
} from './settings/organizations.js';

export type OrganizationUIOptions = {
  /** Path of the standalone management page; false omits the page and its navigation action. */
  path?: string | false;
  /** Logical groups of the standalone page Action; `navigation` by default. */
  groups?: readonly string[];
  /** Explicit navigation placements; defaults to Shell when installed. Empty omits placement. */
  slots?: readonly string[];
  /** Marks the standalone page as a local demo with sample data. */
  demo?: boolean;
};

/** UI and navigation are optional; all owned menus and toolbars use explicit Action placements. */
export function organizationUIPlugin(options: OrganizationUIOptions = {}): Plugin {
  return definePlugin({
    id: 'organizations-ui',
    metadata: {
      tags: ['security'],
      icon: UsersIcon,
      name: 'Organization management',
      description: 'Members, invitations and organization profile.',
    },
    dependencies: ['organizations'],
    settings: defineSettings(
      {},
      {
        title: 'Organization profile',
        description: 'Manage the profile of the active organization.',
        icon: BuildingIcon,
        category: 'organization',
        order: 10,
        path: organizationSettingsPath,
        // The settings navigation action of this section carries the shortcut.
        shortcut: 'Alt+Shift+O',
      },
    ),
    slots: organizationSlots,
    actions: organizationActions(options),
    setup: ({ app }) => {
      // Shell is optional. A known target waits for its owner; absence is intentional.
      if (options.path === false) return;
      const targets =
        options.slots ?? (app.slots.has('shell.navigation') ? ['shell.navigation'] : []);
      for (const name of targets)
        app.slots.attach(
          name,
          { id: 'navigation-entry', actionId: 'organizations.open' },
          { availability: 'wait' },
        );
    },
    ui: {
      settings: {
        component: OrganizationSettingsPage,
        boundary: OrganizationSettingsAccess,
        pages: [
          {
            id: 'members',
            title: 'Members and invitations',
            category: 'organization',
            order: 20,
            path: 'organization/members',
            component: OrganizationMembersPage,
            boundary: OrganizationMembersAccess,
            icon: UsersIcon,
          },
          {
            id: 'invitations',
            icon: EnvelopeIcon,
            title: 'My invitations',
            category: 'account',
            order: 20,
            description: 'Invitations to join other organizations with your account.',
            path: 'account/invitations',
            component: PersonalInvitationsPage,
            boundary: PersonalInvitationsAccess,
          },
        ],
      },
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
