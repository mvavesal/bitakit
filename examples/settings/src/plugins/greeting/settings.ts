import { defineSettings, setting } from '@bitakit/core';

// One declaration: typed keys (`greeting.name`, ...), saved values and the /settings/greeting page.
export default defineSettings(
  {
    name: setting({ default: 'friend', label: 'Your name' }),
    formal: setting({
      default: false,
      label: 'Formal greeting',
      description: 'Use "Good day" instead of "Hello".',
    }),
    language: setting({
      default: 'en',
      label: 'Language',
      options: [
        { value: 'en', label: 'English' },
        { value: 'de', label: 'German' },
        { value: 'es', label: 'Spanish' },
      ],
    }),
    size: setting({
      default: 'medium',
      label: 'Text size',
      control: 'radio',
      options: [
        { value: 'small', label: 'Small' },
        { value: 'medium', label: 'Medium' },
        { value: 'large', label: 'Large' },
      ],
    }),
  },
  { title: 'Greeting', description: 'How the greeting page talks to you.', order: 10 },
);
