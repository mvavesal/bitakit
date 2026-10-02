import Icon from 'reicon-react/icons/Widget';
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Nav.dashboard',
  href: '/dashboard',
  icon: Icon,
  groups: ['navigation.main'],
  order: 10,
});
