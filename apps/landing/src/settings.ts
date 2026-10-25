import { defineSettings, setting } from '@bitakit/core';
import BuildingIcon from 'reicon-react/icons/Building';

// An app setting: plain key `currency`, read by every widget that shows money.
export default defineSettings(
  {
    currency: setting({
      default: 'USD',
      label: 'Currency',
      options: [
        { value: 'USD', label: 'US dollar' },
        { value: 'EUR', label: 'Euro' },
      ],
    }),
  },
  { title: 'Company', icon: BuildingIcon, order: 0 },
);
