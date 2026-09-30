import Icon from 'reicon-react/icons/Widget';
import { defineURLAction } from '@bitakit/core';

export default defineURLAction({
  title: 'Nav.dashboard',
  href: '/dashboard',
  icon: Icon,
  groups: ['navigation.main'],
  order: 10,
});
