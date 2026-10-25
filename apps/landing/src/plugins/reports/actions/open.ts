import { defineAction } from '@bitakit/core';
import ChartBarIcon from 'reicon-react/icons/ChartBar';

export default defineAction({
  title: 'Reports',
  icon: ChartBarIcon,
  href: '/reports',
  slots: ['features'],
});
