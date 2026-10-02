'use client';
import UsersIcon from 'reicon-react/icons/Users';
import { type AppPreferences, type SectionOptions } from '@bitakit/app-preferences/core';
import { definePlugin, type Plugin } from '@bitakit/core';
import { organizationActions } from './actions/organizations.js';
import { IncomingInvitations } from './components/organizations/incoming-invitations.js';
import { OrganizationsPage } from './components/organizations/pages.js';
import {
  OrganizationSettings,
  OrganizationMembersSettings,
  registerOrganizationSettings,
} from './settings/organizations.js';

/** UI and navigation are optional; all toolbars render public extension groups. */
export function organizationUIPlugin(
  options: {
    /** False omits the standalone management page while retaining Settings contributions. */
    path?: string | false;
    groups?: readonly string[];
    demo?: boolean;
    settings?: AppPreferences;
    settingsCategory?: SectionOptions['category'];
    invitationsCategory?: SectionOptions['category'];
  } = {},
): Plugin {
  return definePlugin({
    id: 'organizations-ui',
    metadata: {
      icon: UsersIcon,
      name: 'Organization management',
      description: 'Members, invitations and organization profile.',
    },
    dependencies: ['organizations'],
    pages: [
      { path: '/settings/organization', component: OrganizationSettings },
      { path: '/settings/organization-members', component: OrganizationMembersSettings },
      { path: '/settings/organization-invitations', component: OrganizationMembersSettings },
      { path: '/settings/received-invitations', component: IncomingInvitations },
      ...(options.path === false
        ? []
        : [
            {
              path: options.path ?? '/organizations',
              component: () => <OrganizationsPage demo={options.demo} />,
            },
          ]),
    ],
    actions: organizationActions(options),
    setup(context) {
      registerOrganizationSettings(options, context);
    },
  });
}
