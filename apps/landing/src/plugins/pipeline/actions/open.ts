import { defineAction } from '@bitakit/core';
import TrendUpIcon from 'reicon-react/icons/TrendUp';

export default defineAction({
  title: 'Pipeline',
  icon: TrendUpIcon,
  href: '/pipeline',
  slots: [{ slot: 'shell.navigation', order: -10 }],
});
