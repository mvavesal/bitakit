/** Shared demo inspector copy; source files are discovered from src/plugins. */
export const pluginInfo: Record<string, { name: string; role: string }> = {
  reports: { name: 'Reports', role: 'A table of monthly snapshots in your currency and language' },
  tasks: { name: 'Tasks', role: 'A small service and an Action to complete or reopen tasks' },
  notes: { name: 'Notes', role: 'A page of sample project notes' },
  revenue: {
    name: 'Revenue',
    role: 'Chart widget, a setting, a toolbar Action',
  },
  pipeline: {
    name: 'Pipeline',
    role: 'Deals page, chart widget, events, guarded Actions',
  },
  goals: {
    name: 'Goals',
    role: 'Progress widget and target setting; needs Pipeline',
  },
  activity: {
    name: 'Activity',
    role: 'Listens to pipeline events; widget and header badge',
  },
  contacts: {
    name: 'Contacts',
    role: 'Page, widget and Mod+K search source',
  },
  guard: {
    name: 'Guard',
    role: 'Interceptor: won deals cannot be deleted',
  },
  'quick-search': {
    name: 'Quick Search',
    role: 'Mod+K search, a package plugin',
  },
  dashboard: {
    name: 'Dashboard',
    role: 'The page and its widget and toolbar slots',
  },
};

/** Two or three values: shown side by side. */
export const segmentedOptions = {
  'shell.mode': {
    label: 'Color scheme',
    options: [
      ['light', 'Light'],
      ['dark', 'Dark'],
      ['system', 'System'],
    ],
  },
  'shell.layout': {
    label: 'Navigation',
    options: [
      ['sidebar', 'Sidebar'],
      ['navbar', 'Top bar'],
    ],
  },
} as const;

/** Shown as selects. */
export const pickerOptions = {
  'shell.density': {
    label: 'Density',
    options: [
      ['comfortable', 'Comfortable'],
      ['compact', 'Compact'],
    ],
  },
  'shell.corners': {
    label: 'Corners',
    options: [
      ['default', 'Default'],
      ['round', 'Round'],
      ['square', 'Square'],
    ],
  },
} as const;

export const languages = [
  ['en', 'English'],
  ['de', 'Deutsch'],
] as const;
