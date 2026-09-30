import Icon from 'reicon-react/icons/Flask';
import { defineURLAction } from '@bitakit/core';

export default defineURLAction({
  title: 'Nav.actions',
  href: '/actions-demo',
  icon: Icon,
  groups: ['navigation.main'],
  order: 30,
});
