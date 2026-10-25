import { defineSettings, setting } from '@bitakit/core';
import TargetIcon from 'reicon-react/icons/Target';

export default defineSettings(
  {
    target: setting({
      default: '200000',
      label: 'Quarter target',
      options: [
        { value: '100000', label: '100,000' },
        { value: '200000', label: '200,000' },
        { value: '400000', label: '400,000' },
      ],
    }),
  },
  { title: 'Goals', icon: TargetIcon, order: 20 },
);
