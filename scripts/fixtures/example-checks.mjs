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
};
