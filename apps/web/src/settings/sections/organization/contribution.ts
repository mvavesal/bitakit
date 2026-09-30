import { SettingsSection } from '@bitakit/app-preferences';
import BuildingIcon from 'reicon-react/icons/Building';
import UsersIcon from 'reicon-react/icons/Users';
import { OrganizationGeneralSettings, OrganizationMembersSettings } from './organization-settings';
export function organizationSettings(t: (key: string) => string) {
  const scope = {
    id: 'organization',
    title: t('OrgSettings.title'),
    home: '/settings/organization',
  };
  return [
    new SettingsSection({
      id: 'organization',
      showHeader: false,
      title: t('OrgSettings.general'),
      description: t('OrgSettings.generalDescription'),
      icon: BuildingIcon,
      component: OrganizationGeneralSettings,
      scope,
    }),
    new SettingsSection({
      id: 'organization-members',
      showHeader: false,
      title: t('OrgSettings.members'),
      description: t('OrgSettings.membersDescription'),
      icon: UsersIcon,
      component: OrganizationMembersSettings,
      scope,
    }),
  ];
}
