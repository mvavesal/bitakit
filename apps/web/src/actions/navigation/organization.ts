import Icon from 'reicon-react/icons/Building';
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'OrgSettings.title',
  href: '/settings/organization',
  icon: Icon,
  groups: ['navigation.main'],
  order: 20,
});
