'use client';
export { organizationUIPlugin, type OrganizationUIOptions } from './organization-plugin.js';
export { OrganizationSwitcher } from './components/organizations/switcher.js';
export { OrganizationsPage } from './components/organizations/pages.js';
export {
  OrganizationSettings,
  OrganizationSettingsPage,
  OrganizationMembersSettings,
  OrganizationInvitationsSettings,
} from './settings/organizations.js';

export { IncomingInvitations } from './components/organizations/incoming-invitations.js';

export { memberMenuSlot, organizationSlots } from './slots.js';
