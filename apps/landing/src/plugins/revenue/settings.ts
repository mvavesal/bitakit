import { defineSettings, setting } from '@bitakit/core';
import DollarCircleIcon from 'reicon-react/icons/DollarCircle';

// A plugin setting: `revenue.range`, with its own page under Settings.
export default defineSettings(
  {
    range: setting({
      default: '12',
      label: 'Months shown',
      options: [
        { value: '3', label: 'Last 3 months' },
        { value: '6', label: 'Last 6 months' },
        { value: '12', label: 'Last 12 months' },
      ],
    }),
  },
  { title: 'Revenue', icon: DollarCircleIcon, order: 10 },
);
