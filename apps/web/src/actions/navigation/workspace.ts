import Icon from 'reicon-react/icons/Layers';
import { defineAction } from '@bitakit/core';

export default defineAction({
  title: 'Nav.workspace',
  href: '/app-preview',
  icon: Icon,
  groups: ['navigation.main'],
  order: 0,
});
