/** The handbook's chapters. Not a discovered file: pages import it directly. */
export const chapters = [
  {
    slug: 'welcome',
    title: 'Welcome',
    summary: 'Who we are and how this handbook works.',
    body: 'We write things down so nobody has to ask twice. Every team owns its chapter.',
  },
  {
    slug: 'working-hours',
    title: 'Working hours',
    summary: 'Core hours, time off and being reachable.',
    body: 'Core hours are 10:00 to 15:00 in your time zone. Outside them, answer when you can.',
  },
  {
    slug: 'shipping',
    title: 'Shipping work',
    summary: 'From a pull request to production.',
    body: 'Small changes, reviewed by one person, released from main every day.',
  },
] as const;
