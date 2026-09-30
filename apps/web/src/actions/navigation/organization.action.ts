import Icon from 'reicon-react/icons/Building';
import { defineURLAction } from '@bitakit/core';

export default defineURLAction({
  title: 'OrgSettings.title',
  href: '/settings/organization',
  icon: Icon,
  groups: ['navigation.main'],
  order: 20,
});
