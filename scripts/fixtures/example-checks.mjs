// What each app in examples/ must show and do in the browser: `visits` are `[route, text, act?]`
// in order, `expected` matches console errors a page causes on purpose. Each check follows the
// example's README, so a reader sees the same result.

const counter = async (page) => {
  const count = page.getByLabel('Count');
  const increment = page.getByRole('button', { name: 'Increment' });
  await increment.click();
  await increment.click();
  await count.filter({ hasText: /^2$/ }).waitFor();
  await page.getByRole('button', { name: 'Reset' }).click();
  await count.filter({ hasText: /^0$/ }).waitFor();
};

const todo = async (page) => {
  const input = page.getByLabel('New todo');
  for (const title of ['Write docs', 'Ship it']) {
    await input.fill(title);
    await input.press('Enter');
    await page.getByRole('listitem').filter({ hasText: title }).waitFor();
  }
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Write docs' })
    .getByRole('button', { name: 'Done' })
    .click();
  await page.getByText('1 of 2 left').waitFor();
  await page.getByRole('button', { name: 'Clear completed' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('Completed todos deleted').waitFor();
  await page.getByText('Write docs').waitFor({ state: 'detached' });
  // The navigation Action is also a Quick Search destination.
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('dialog').getByText('Todos').first().waitFor();
};

const greeting = async (page) => {
  await page.getByText('Hello, friend!').waitFor();
  // The same setting from a field on the feature page.
  await page.getByRole('switch', { name: 'Formal greeting' }).click();
  await page.getByText('Good day, friend!').waitFor();
  await page.goto(page.url().replace('/greeting', '/settings/greeting'));
  await page.getByText('These choices are saved in this browser.').waitFor();
  const name = page.getByRole('textbox', { name: 'Your name' });
  await name.fill('Ada');
  await name.blur();
  await page.getByRole('radio', { name: 'Large' }).click();
  await page.goto(page.url().replace('/settings/greeting', '/greeting'));
  // Saved values survive a reload.
  await page.reload();
  await page.getByText('Good day, Ada!').waitFor();
  await page.getByRole('button', { name: 'Reset greeting settings' }).click();
  await page.getByText('Greeting settings reset').waitFor();
  await page.getByText('Hello, friend!').waitFor();
};

const radius = (page, value) =>
  page.waitForFunction(
    (expected) =>
      getComputedStyle(document.documentElement).getPropertyValue('--radius').trim() === expected,
    value,
  );

const theme = async (page) => {
  await page.getByRole('button', { name: 'Use Sunset' }).click();
  await radius(page, '0.25rem');
  // The selection is a saved setting, so it survives a reload.
  await page.reload();
  await radius(page, '0.25rem');
  await page.getByRole('button', { name: 'Use Ocean' }).click();
  await radius(page, '0.875rem');
};

const crash = async (page) => {
  await page.getByRole('button', { name: 'Break this page' }).click();
  await page.getByText('That did not work').waitFor();
  await page.getByRole('button', { name: 'Try again' }).waitFor();
};

const workspace = async (page) => {
  const input = page.getByLabel('New note');
  const note = (title) => page.getByRole('listitem').filter({ hasText: new RegExp(`^${title}`) });
  for (const title of ['Plan launch', 'Write docs', 'Write docs']) {
    await input.fill(title);
    await input.press('Enter');
    await note(title).first().waitFor();
  }
  // guard skipped the duplicate; activity counts and reports from its own folder.
  await page.getByText('2 notes').waitFor();
  if ((await note('Write docs').count()) !== 1) throw new Error('The duplicate note was added.');
  await page.getByText('Added "Write docs"').waitFor();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export as Markdown' }).click();
  if ((await download).suggestedFilename() !== 'notes.md') throw new Error('No notes.md download.');
  await page.getByText('Exported 2 notes').waitFor();
  await note('Plan launch').getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Removed "Plan launch"').waitFor();
  // The notes plugin's Quick Search source finds its own data.
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('dialog').getByRole('combobox').fill('Write');
  await page.getByRole('dialog').getByText('Write docs').first().waitFor();
};

const bookmarks = async (page) => {
  const titles = page.locator('[data-slot=item-title]');
  await titles.filter({ hasText: 'BitaKit documentation' }).waitFor();
  const input = page.getByLabel('Link to save');
  await input.fill('https://example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await titles.first().filter({ hasText: 'example.com' }).waitFor();
  // The server rejects a duplicate; the Action shows its message.
  await input.fill('https://example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('This link is already saved.').waitFor();
  // SQLite keeps it across a reload.
  await page.reload();
  const saved = page.locator('[data-slot=item]').filter({ hasText: 'example.com' });
  await saved.first().waitFor();
  await saved.first().getByRole('button', { name: 'Delete' }).click();
  await page.getByText('Bookmark deleted').waitFor();
};

const crm = async (page) => {
  await page.getByText('Ada Lovelace').waitFor();
  // The contacts plugin's card on the companies plugin's page.
  await page.getByLabel('Contact name').fill('Edsger Dijkstra');
  await page.getByLabel('Contact email').fill('edsger@northwind.example');
  await page.getByRole('button', { name: 'Add contact' }).click();
  await page.getByText('Edsger Dijkstra added').waitFor();
  // activity heard contacts.added.
  await page.getByText('1 new').waitFor();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('dialog').getByRole('combobox').fill('Edsger');
  await page.getByRole('dialog').getByText('edsger@northwind.example').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Deals', exact: true }).click();
  const card = page.locator('[data-slot=card]').filter({ hasText: 'Support renewal' });
  await card.getByRole('button', { name: 'Advance' }).click();
  await page.getByRole('region', { name: 'Qualified' }).getByText('Support renewal').waitFor();
  await card.getByRole('button', { name: 'Advance' }).click();
  await card.getByRole('button', { name: 'Mark won' }).click();
  await page.getByRole('region', { name: 'Won' }).getByText('Support renewal').waitFor();
  await page.getByText('2 new').waitFor();
};

const dashboard = async (page) => {
  const count = page.getByLabel('Orders this month');
  await count.waitFor();
  const before = Number(await count.textContent());
  const revenue = page.getByLabel('Revenue in six months');
  const revenueBefore = await revenue.textContent();
  await page.getByRole('button', { name: 'Record a sample order' }).click();
  await page.getByText('Order recorded').waitFor();
  await count.filter({ hasText: new RegExp(`^${before + 1}$`) }).waitFor();
  // sales heard orders.created and reloaded its own numbers.
  await page.waitForFunction(
    (previous) =>
      document.querySelector('[aria-label="Revenue in six months"]')?.textContent !== previous,
    revenueBefore,
  );
  await page.getByLabel('Low stock').getByText('Backpack').waitFor();
};

const forms = async (page) => {
  await page.getByText('Cannot sign in on mobile').waitFor();
  await page.getByRole('button', { name: 'New ticket' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Create ticket' }).click();
  // The shared schema's messages, one per field.
  await dialog.getByText('Use at least 5 characters.').waitFor();
  await dialog.getByText('Describe the problem in at least 20 characters.').waitFor();
  await dialog.getByLabel('Title').fill('Export button missing');
  await dialog.getByLabel('Your email').fill('alan@example.com');
  await dialog.getByRole('radio', { name: 'High' }).click();
  await dialog.getByLabel('What happened?').fill('The CSV export button disappeared.');
  await dialog.getByRole('button', { name: 'Create ticket' }).click();
  await page.getByText('Ticket created').waitFor();
  await dialog.waitFor({ state: 'detached' });
  const ticket = page.locator('[data-slot=item]').filter({ hasText: 'Export button missing' });
  await ticket.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('Ticket closed').waitFor();
  await ticket.getByText('closed', { exact: true }).waitFor();
};

const customSettings = async (page) => {
  await page.getByLabel('Preview').getByText('Ada Lovelace').waitFor();
  const name = page.getByRole('textbox', { name: 'Display name' });
  await name.fill('A');
  await name.blur();
  // The schema's message; nothing is saved.
  await page.getByText('Use at least 2 characters.').waitFor();
  await name.fill('Grace Hopper');
  await name.blur();
  await page.getByLabel('Preview').getByText('Grace Hopper').waitFor();
};

const profile = async (page) => {
  // A fresh page load: the name comes back from the server.
  await page.getByText('Grace Hopper').waitFor();
  await page.getByRole('button', { name: 'Pause notifications' }).click();
  await page.getByText('Notifications paused', { exact: true }).first().waitFor();
};

const playground = async (page) => {
  const tab = (name) => page.getByRole('tab', { name });
  const appBar = page.getByRole('group', { name: 'App actions' });
  const footer = page.locator('[data-sidebar=footer]');
  // 1 · Live action: every field is a function of state; the editor only changes the state.
  await page.getByRole('button', { name: 'Add action' }).click();
  await appBar.getByRole('button', { name: 'Action 1' }).waitFor();
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Deploy');
  await appBar.getByRole('button', { name: 'Deploy' }).waitFor();
  await page.getByRole('checkbox', { name: 'Sidebar footer' }).click();
  await footer.getByRole('button', { name: 'Deploy' }).waitFor();
  await page.getByRole('checkbox', { name: 'App bar' }).click();
  await appBar.getByRole('button', { name: 'Deploy' }).waitFor({ state: 'detached' });
  await page.getByRole('checkbox', { name: 'Enabled' }).click();
  await footer.getByRole('button', { name: 'Deploy', disabled: true }).waitFor();
  await page.getByRole('button', { name: 'Add action' }).click();
  await appBar.getByRole('button', { name: 'Action 2' }).waitFor();
  await page.getByRole('button', { name: 'Code' }).click();
  await page.getByRole('dialog').locator('.shiki').first().waitFor();
  await page.keyboard.press('Escape');
  // 2 · Messages
  await tab('2 · Messages').click();
  await page.getByRole('button', { name: 'Say hello' }).click();
  await page.getByText('Hello from an Action!').waitFor();
  await page.getByRole('button', { name: 'Try something risky' }).click();
  await page.getByText('That failed: The server is taking a break.').first().waitFor();
  // 3 · Input: the schema keeps Greet disabled until the name is valid.
  await tab('3 · Input').click();
  const name = page.getByRole('textbox', { name: 'Your name' });
  const greet = page.getByRole('button', { name: 'Greet' });
  await name.fill('A');
  if (await greet.isEnabled()) throw new Error('Greet ran with an invalid name.');
  await name.fill('Ada');
  await greet.click();
  await page.getByText('Nice to meet you, Ada!').waitFor();
  // 4 · While it runs
  await tab('4 · While it runs').click();
  const apple = page.locator('[data-slot=item]').filter({ hasText: 'Apple' });
  await apple.getByRole('button', { name: 'Like' }).click();
  await apple.getByText('Liked').waitFor();
  // Each keystroke starts a search; the superseded ones stop without an error.
  await page.getByRole('textbox', { name: /Search fruit|latest/ }).pressSequentially('apr', {
    delay: 50,
  });
  await page.getByText('Apricot', { exact: true }).waitFor();
  // 5 · Confirm and dialog
  await tab('5 · Confirm and dialog').click();
  await page.getByRole('button', { name: 'Open a dialog' }).click();
  await page.getByRole('dialog').getByText('you like 1 fruit').waitFor();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Unlike everything' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.getByText('All likes removed').waitFor();
  // 6 · Shortcut, link, menu
  await tab('6 · Shortcut, link, menu').click();
  await page.keyboard.press('ControlOrMeta+Shift+h');
  await page.getByText('You pressed the shortcut').waitFor();
};

const customers = async (page) => {
  const name = page.getByRole('textbox', { name: 'Customer name' });
  const add = page.getByRole('button', { name: 'Add customer' });
  await name.fill('Ada Corp');
  await add.click();
  await page.getByText('Ada Corp added').waitFor();
  await name.fill('contoso');
  await add.click();
  await page.getByText('contoso is already a customer.').first().waitFor();
  await page
    .locator('[data-slot=item]')
    .filter({ hasText: 'Northwind Traders' })
    .getByRole('button', { name: 'Archive' })
    .click();
  await page.getByText('Customer archived').waitFor();
  // The audit plugin's panel below the page shows what its interceptors recorded, live.
  const audit = page.getByLabel('Audit log');
  await audit.getByText('customers.list.add("Ada Corp")').waitFor();
  await audit.getByText('customers.add ran with "Ada Corp"').waitFor();
  await audit.getByText('customers.add failed: contoso is already a customer.').waitFor();
  await audit.getByText('customers.archive ran with 1').waitFor();
};

const readOnly = async (page) => {
  await page.getByRole('switch', { name: 'Read-only mode' }).click();
  await page.getByRole('switch', { name: 'Read-only mode', checked: true }).waitFor();
};

const blocked = async (page) => {
  const contoso = page.locator('[data-slot=item]').filter({ hasText: 'Contoso' });
  await page.getByText('Read-only', { exact: true }).waitFor();
  await contoso.getByRole('button', { name: 'Archive' }).click();
  await page.getByText('Read-only mode is on').waitFor();
  await page.getByText('Read-only · 1 blocked').waitFor();
  // The gate skipped the run: Contoso is still active.
  await contoso.getByRole('button', { name: 'Archive' }).waitFor();
};

const handbook = async (page) => {
  // The app's own frame: the navigation is in the top bar and Shell's sidebar is gone.
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await navigation.getByRole('link', { name: 'Changelog' }).waitFor();
  if (await page.locator('[data-slot=sidebar]').count())
    throw new Error("Shell's sidebar rendered instead of src/layouts/app.tsx.");
  // The status plugin's widgets appear in the slots this frame renders.
  await page.getByText('v2.4', { exact: true }).waitFor();
  await page.getByText('All systems normal').waitFor();
  await page.getByRole('link', { name: /Working hours/ }).click();
  await page.getByText('Core hours are 10:00 to 15:00').waitFor();
  await navigation.getByRole('link', { name: 'Changelog' }).click();
  await page.getByText('The handbook moved to its own app.').waitFor();
};

const tasksInEnglish = async (page) => {
  await page.getByRole('textbox', { name: 'New task' }).fill('Buy milk');
  await page.getByRole('button', { name: 'Add task' }).click();
  await page.getByText('Added "Buy milk"').waitFor();
  await page.getByText('1 task left').waitFor();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByText('Nothing left to do').waitFor();
};

const chooseGerman = async (page) => {
  await page.getByRole('combobox', { name: 'Language' }).click();
  await page.getByRole('option', { name: 'Deutsch' }).click();
  // Settings switches without a reload.
  await page.getByText('Zurück zur App').waitFor();
};

const tasksInGerman = async (page) => {
  await page.getByRole('textbox', { name: 'Neue Aufgabe' }).fill('Milch kaufen');
  await page.getByRole('button', { name: 'Aufgabe hinzufügen' }).click();
  await page.getByText('„Milch kaufen“ hinzugefügt').waitFor();
  await page.getByText('1 Aufgabe offen').waitFor();
  await page.getByRole('link', { name: 'Aufgaben' }).waitFor();
};

export const checks = {
  counter: {
    visits: [
      ['/', 'Counter example'],
      ['/counter', 'One plugin: a page, a service and two Actions.', counter],
    ],
  },
  todo: {
    visits: [
      ['/', 'Todo example'],
      ['/todos', '0 of 0 left', todo],
    ],
  },
  settings: {
    visits: [
      ['/', 'Welcome to Acme.'],
      ['/greeting', 'Settings decide every word.', greeting],
      ['/settings', 'Company name'],
    ],
  },
  theme: {
    visits: [
      ['/', 'Theme example'],
      ['/gallery', 'Every component reads the same theme tokens.', theme],
      ['/settings/theme', 'Ocean'],
    ],
  },
  layouts: {
    visits: [
      ['/', 'Layouts example'],
      ['/account/login', 'This panel comes from src/layouts/auth/split.tsx.'],
      ['/welcome', 'Step 1 of 3 · Onboarding layout'],
      ['/lab', 'The full-page family: no navigation frame.'],
      ['/nowhere', 'Nothing here'],
      ['/lab/crash', 'The button breaks this page on purpose.', crash],
    ],
    expected: /Demo failure/,
  },
  workspace: {
    visits: [
      ['/', 'Four plugins, four folders, no shared edits.'],
      ['/notes', 'Owned by the notes plugin; extended by three others.', workspace],
      ['/settings/notes', 'Newest notes first'],
    ],
  },
  bookmarks: {
    visits: [
      ['/', 'Bookmarks example'],
      ['/bookmarks', 'Saved in SQLite, loaded through an API route.', bookmarks],
    ],
    // The duplicate link is rejected on purpose: the 409 response and the logged failure.
    expected: /409 \(Conflict\)|This link is already saved/,
  },
  crm: {
    visits: [
      ['/', 'CRM example'],
      ['/companies/1', 'Northwind Traders', crm],
      ['/activity', 'Events from companies, contacts and deals.'],
    ],
  },
  dashboard: {
    visits: [
      ['/', 'Dashboard example'],
      ['/dashboard', "Each card is a plugin reading the shop's SQLite data.", dashboard],
      ['/settings/inventory', 'Low stock below'],
    ],
  },
  forms: {
    visits: [
      ['/', 'Forms example'],
      [
        '/tickets',
        'Forms in dialogs, checked by one schema in the browser and on the server.',
        forms,
      ],
    ],
  },
  'custom-settings': {
    visits: [
      ['/', 'Custom settings example'],
      [
        '/settings/profile',
        'Saved on the server in SQLite; the last group stays in this browser.',
        customSettings,
      ],
      ['/profile', 'Every value here is a setting, saved on the server.', profile],
    ],
  },
  actions: {
    visits: [
      ['/', 'Actions example'],
      [
        '/playground',
        'Six examples of defineAction. Each tab has a Code button with its files.',
        playground,
      ],
    ],
    // playground.fail fails on purpose; the Action provider logs it.
    expected: /The server is taking a break/,
  },
  interceptors: {
    visits: [
      ['/', 'Interceptors example'],
      [
        '/customers',
        'Two other plugins watch and gate these buttons without changing this folder.',
        customers,
      ],
      ['/settings/guard', 'Read-only mode', readOnly],
      [
        '/customers',
        'Two other plugins watch and gate these buttons without changing this folder.',
        blocked,
      ],
    ],
    // customers.add fails on purpose for a taken name; the Action provider logs it.
    expected: /is already a customer/,
  },
  'custom-layout': {
    visits: [
      ['/', 'Custom layout example'],
      ['/handbook', 'How we work, one chapter per topic.', handbook],
    ],
  },
  i18n: {
    visits: [
      ['/', 'Switch the language under Settings → Language; every text follows.'],
      ['/tasks', 'No tasks yet. Add the first one above.', tasksInEnglish],
      ['/settings/language', 'Choose your interface language.', chooseGerman],
      // A new page load: the server reads the cookie and renders German.
      ['/tasks', 'Noch keine Aufgaben. Füge oben die erste hinzu.', tasksInGerman],
      ['/settings/tasks', 'Zeigen, wann eine Aufgabe dazukam'],
    ],
  },
};
