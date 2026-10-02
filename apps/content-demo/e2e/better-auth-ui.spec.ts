import { expect, test, type Page } from '@playwright/test';
import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization, multiSession } from 'better-auth/plugins';

// Actual Better Auth handler, completely isolated from the host database and SMTP.
function backend(baseURL: string) {
  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
    team: [],
    teamMember: [],
    apikey: [],
  };
  const mail = { reset: '', verification: '', invitation: '', invitationCount: 0 };
  const auth = betterAuth({
    baseURL,
    secret: 'isolated-browser-tests-only-32-characters',
    database: memoryAdapter(database),
    emailAndPassword: {
      enabled: true,
      sendResetPassword: async ({ url }) => {
        mail.reset = url;
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ url }) => {
        mail.verification = url;
      },
    },
    plugins: [
      organization({
        teams: { enabled: true },
        sendInvitationEmail: async ({ id }) => {
          mail.invitation = id;
          mail.invitationCount++;
        },
      }),
      multiSession(),
      apiKey([
        { configId: 'default', references: 'user' },
        { configId: 'organization', references: 'organization' },
      ]),
    ],
  });
  return { auth, mail, database };
}
async function connect(page: Page, auth: { handler: (request: Request) => Promise<Response> }) {
  await page.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const response = await auth.handler(
      new Request(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postData() ?? undefined,
      }),
    );
    const headers = Object.fromEntries(response.headers);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) headers['set-cookie'] = cookies.join('\n');
    await route.fulfill({ status: response.status, headers, body: await response.text() });
  });
}
const password = 'Local-test-password123!';
test('social login returns to the Content UI origin rather than the auth server', async ({
  page,
  baseURL,
}) => {
  const { auth } = backend(baseURL!);
  await connect(page, auth);
  await page.goto('/better-auth/auth/sign-in');
  const request = page.waitForRequest((request) =>
    request.url().endsWith('/api/auth/sign-in/social'),
  );
  await page.getByRole('button', { name: 'Mit Google fortfahren' }).click();
  expect((await request).postDataJSON().callbackURL).toBe(new URL('/', baseURL!).toString());
});
async function signup(page: Page, email: string, name: string) {
  await page.goto('/better-auth/auth/sign-up');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill(email);
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByLabel('Passwort bestätigen', { exact: true }).fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Demo als Alex öffnen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('menuitem', { name: 'Einstellungen', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Einstellungsnavigation' })
      .getByRole('link', { name: 'Profil', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'E-Mail-Adresse ändern', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Konten verwalten', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Einstellungsnavigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Benutzerprofil' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Better Auth UI', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tablist', { name: 'Einstellungen' })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Einstellungsnavigation' })
    .getByRole('link', { name: 'Sicherheit', exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/security$/);
  await expect(
    page.getByRole('heading', { name: 'E-Mail-Adresse ändern', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'API-Schlüssel', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Passwort ändern', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Einstellungsnavigation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Better Auth UI', exact: true })).toHaveCount(0);
  await page.goto('/better-auth/settings/account');
  await expect(page.getByRole('heading', { name: 'Benutzerprofil' })).toBeVisible();
}

test('native signup, user/session UI, organization creation and invitation work with real isolated auth', async ({
  page,
  browser,
  baseURL,
}) => {
  const { auth, mail, database } = backend(baseURL!);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await connect(page, auth);
  await signup(page, 'owner@example.test', 'Browser Owner');
  await expect(page.getByText('Konten verwalten', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Organisation wechseln', exact: true }).first().click();
  await page.getByRole('menuitem', { name: 'Organisation erstellen' }).click();
  await page
    .getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ })
    .getByLabel('Name', { exact: true })
    .fill('Browser Organization');
  await page
    .getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ })
    .getByRole('button', { name: 'Organisation erstellen', exact: true })
    .click();
  await expect(
    page.getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ }),
  ).toBeHidden();
  await page.goto('/better-auth/organization/people');
  await expect(page.getByRole('rowheader', { name: /owner@example.test/ })).toBeVisible();
  await page.getByRole('button', { name: 'Mitglied einladen', exact: true }).first().click();
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('member@example.test');
  await page
    .getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ })
    .getByRole('button', { name: 'Mitglied einladen', exact: true })
    .click();
  await expect(
    page.getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ }),
  ).toBeHidden();
  await expect(page.getByRole('rowheader', { name: /member@example.test/ })).toBeVisible();
  expect(mail.invitation).toBeTruthy();
  await page.getByRole('button', { name: 'Einladung erneut senden', exact: true }).click();
  await expect.poll(() => mail.invitationCount).toBe(2);
  const context = await browser.newContext({ baseURL });
  const member = await context.newPage();
  await connect(member, auth);
  await signup(member, 'member@example.test', 'Browser Member');
  await member.goto('/better-auth/auth/accept-invitation?invitationId=' + mail.invitation);
  await member.getByRole('button', { name: /annehmen/i }).click();
  await expect.poll(() => database.member.length).toBe(2);
  await page.reload();
  await expect(page.getByRole('rowheader', { name: /member@example.test/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Mitglied einladen', exact: true }).first().click();
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('cancel@example.test');
  await page
    .getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ })
    .getByRole('button', { name: 'Mitglied einladen', exact: true })
    .click();
  await expect(
    page.getByRole('alertdialog', { name: /^(Organisation erstellen|Mitglied einladen)$/ }),
  ).toBeHidden();
  await page
    .getByRole('row')
    .filter({ hasText: 'cancel@example.test' })
    .getByRole('button', { name: 'Einladung abbrechen' })
    .click();
  await expect(page.getByRole('row').filter({ hasText: 'cancel@example.test' })).toContainText(
    'Abgebrochen',
  );
  const memberRow = page
    .getByRole('grid')
    .first()
    .getByRole('row')
    .filter({ hasText: 'member@example.test' });
  await memberRow.getByRole('button', { name: 'Rolle ändern' }).click();
  const roleDialog = page.getByRole('alertdialog', { name: 'Rolle ändern' });
  await roleDialog.getByText('Administrator', { exact: true }).click();
  await expect(
    roleDialog.getByRole('checkbox', { name: 'Administrator', exact: true }),
  ).toBeChecked();
  await roleDialog.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(roleDialog).toBeHidden();
  await expect(memberRow).toContainText('Administrator');
  await page.goto('/better-auth/organization/teams');
  await page.getByRole('button', { name: 'Team erstellen', exact: true }).click();
  const teamDialog = page.getByRole('alertdialog', { name: 'Team erstellen', exact: true });
  await teamDialog.getByLabel('Name', { exact: true }).fill('Browser Team');
  await teamDialog.getByRole('button', { name: 'Team erstellen', exact: true }).click();
  await expect.poll(() => database.team.length).toBe(2); // org default team plus this team
  const createdTeam = database.team.find((team: any) => team.name === 'Browser Team') as any;
  const owner = database.user.find((user: any) => user.email === 'owner@example.test') as any;
  // The production host joins creators in its after hook; use the same public API in this fixture.
  await page.evaluate(
    async ({ teamId, userId }) => {
      const response = await fetch('/api/auth/organization/add-team-member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ teamId, userId }),
      });
      if (!response.ok) throw new Error('Team creator membership failed');
    },
    { teamId: createdTeam.id, userId: owner.id },
  );
  await page.reload();
  await page
    .getByText('Browser Team', { exact: true })
    .locator('..')
    .locator('..')
    .getByRole('button', { name: 'Verwalten' })
    .click();
  const editTeam = page.getByRole('alertdialog', { name: 'Team umbenennen', exact: true });
  await expect(editTeam.getByText('Teammitglieder', { exact: true })).toBeVisible();
  await editTeam
    .getByRole('button', { name: /Teammitglied hinzufügen/ })
    .first()
    .click();
  await page.getByRole('option', { name: 'Browser Member', exact: true }).click();
  await editTeam.getByRole('button', { name: 'Teammitglied hinzufügen', exact: true }).click();
  const teamMemberRow = editTeam
    .locator('span.truncate')
    .filter({ hasText: /^Browser Member$/ })
    .locator('..');
  await expect(teamMemberRow).toBeVisible();
  await teamMemberRow.getByRole('button', { name: 'Aus Team entfernen' }).click();
  await expect(teamMemberRow).toHaveCount(0);
  expect(
    database.teamMember.some(
      (entry: any) => entry.teamId === createdTeam.id && entry.userId === owner.id,
    ),
  ).toBe(true);
  await editTeam.getByLabel('Name', { exact: true }).fill('Renamed Team');
  await editTeam.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect
    .poll(() => database.team.some((team: any) => team.name === 'Renamed Team'))
    .toBe(true);
  await page.keyboard.press('Escape');
  // The native organization switcher selects organizations, not teams.
  // Team creation, membership and renaming are verified above on the native team page.
  await page.goto('/better-auth/organization/people');
  await memberRow.getByRole('button', { name: 'Mitglied entfernen' }).click();
  await page
    .getByRole('alertdialog', { name: 'Mitglied entfernen' })
    .getByRole('button', { name: 'Mitglied entfernen', exact: true })
    .click();
  await expect.poll(() => database.member.length).toBe(1);
  await expect(memberRow).toHaveCount(0);
  await page.goto('/better-auth/organization/settings');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Browser Organization');
  await page.getByLabel('Name', { exact: true }).fill('Updated Organization');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(
    page.getByRole('button', { name: 'Organisation wechseln', exact: true }),
  ).toContainText('Updated Organization');
  await page.goto('/better-auth/settings/account');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Browser Owner');
  await page.getByLabel('Name', { exact: true }).fill('Updated Owner');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(
    page.getByRole('button', { name: /Updated Owner owner@example.test/ }),
  ).toBeVisible();
  await page.goto('/better-auth/settings/security');
  await expect(page.getByText('Aktive Sitzungen', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.screenshot({
    animations: 'disabled',
    path: 'test-results/better-auth-security-dark-mobile.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await context.close();
});

test('native signout, signin and password reset persist a verified session', async ({
  page,
  baseURL,
}) => {
  const { auth, mail } = backend(baseURL!);
  await connect(page, auth);
  await signup(page, 'reset@example.test', 'Reset User');
  expect(mail.verification).toBeTruthy();
  await page.goto(mail.verification);
  await page.goto('/better-auth/auth/sign-out');
  await expect(page).toHaveURL(/sign-in/);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('reset@example.test');
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/better-auth/auth/sign-out');
  await expect(page).toHaveURL(/sign-in/);
  await page.goto('/better-auth/auth/forgot-password');
  await page.locator('input[type=email]').fill('reset@example.test');
  await page.locator('button[type=submit]').click();
  await expect.poll(() => mail.reset).not.toBe('');
  const token = new URL(mail.reset).pathname.split('/').pop();
  await page.goto('/better-auth/auth/reset-password?token=' + token);
  await page.locator('input[type=password]').first().fill('Changed-test-password123!');
  await page.locator('input[type=password]').nth(1).fill('Changed-test-password123!');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/sign-in/);
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('reset@example.test');
  await page.getByLabel('Passwort', { exact: true }).fill('Changed-test-password123!');
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);
});

test('native user menu switches two authenticated accounts on the same device', async ({
  page,
  baseURL,
}) => {
  const { auth } = backend(baseURL!);
  await connect(page, auth);
  await signup(page, 'first@example.test', 'First Account');
  await signup(page, 'second@example.test', 'Second Account');
  await page.getByRole('button', { name: /Second Account second@example.test/ }).click();
  await page.getByRole('menuitem', { name: 'Konto wechseln', exact: true }).hover();
  await page.getByRole('menuitem', { name: /First Account first@example.test/ }).click();
  await expect(
    page.getByRole('button', { name: /First Account first@example.test/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: /First Account first@example.test/ }),
  ).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: /First Account first@example.test/ }).click();
  await page.getByRole('menuitem', { name: 'Konto wechseln', exact: true }).hover();
  await page.getByRole('menuitem', { name: 'Konto hinzufügen', exact: true }).click();
  await expect(page).toHaveURL(/\/better-auth\/auth\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Better Auth UI', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Zurück zur Anwendung' })).toBeVisible();
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('second@example.test');
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole('button', { name: /Second Account second@example.test/ }),
  ).toBeVisible();
});

test('external HeroUI controls inherit Foundation geometry and light/dark colors', async ({
  page,
  baseURL,
}) => {
  const { auth } = backend(baseURL!);
  await connect(page, auth);
  await signup(page, 'theme@example.test', 'Theme User');
  for (const dark of [false, true]) {
    await page.evaluate((value) => document.documentElement.classList.toggle('dark', value), dark);
    await expect
      .poll(() =>
        page
          .locator('.card')
          .first()
          .evaluate((element) => {
            const probe = document.createElement('div');
            probe.style.backgroundColor = 'var(--card)';
            // Tailwind's inline theme expands radius-card; it is not a runtime variable.
            probe.style.borderRadius = 'calc(var(--radius) * 2)';
            document.body.append(probe);
            const matches =
              getComputedStyle(element).backgroundColor ===
                getComputedStyle(probe).backgroundColor &&
              getComputedStyle(element).borderRadius === getComputedStyle(probe).borderRadius;
            probe.remove();
            return matches;
          }),
      )
      .toBe(true);
    const geometry = await page.evaluate(() => {
      const reference = getComputedStyle(document.querySelector('[data-slot="button"]')!);
      const button = getComputedStyle(document.querySelector('.button--primary')!);
      const avatar = getComputedStyle(document.querySelector('.avatar')!);
      return {
        button: button.borderRadius,
        avatar: avatar.borderRadius,
        reference: reference.borderRadius,
        buttonCorner: button.getPropertyValue('corner-shape'),
        avatarCorner: avatar.getPropertyValue('corner-shape'),
        referenceCorner: reference.getPropertyValue('corner-shape'),
      };
    });
    await expect
      .poll(() =>
        page.getByRole('tab', { name: 'Sicherheit', exact: true }).evaluate((element) => {
          const probe = document.createElement('span');
          probe.style.color = 'var(--muted-foreground)';
          document.body.append(probe);
          const matches = getComputedStyle(element).color === getComputedStyle(probe).color;
          probe.remove();
          return matches;
        }),
      )
      .toBe(true);
    expect(geometry.button).toBe(geometry.reference);
    expect(geometry.avatar).toBe(geometry.reference);
    expect(geometry.buttonCorner).toBe(geometry.referenceCorner);
    expect(geometry.avatarCorner).toBe(geometry.referenceCorner);
    await page.screenshot({
      animations: 'disabled',
      path: `test-results/better-auth-native-${dark ? 'dark' : 'light'}.png`,
      fullPage: true,
    });
  }
});

test('native personal and organization API keys can be created and revoked', async ({
  page,
  baseURL,
}) => {
  const { auth, database } = backend(baseURL!);
  await connect(page, auth);
  await signup(page, 'key-owner@example.test', 'Key Owner');
  await page.evaluate(async () => {
    const response = await fetch('/api/auth/organization/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Key Organization', slug: 'key-organization' }),
    });
    if (!response.ok) throw new Error('Organization creation failed');
  });
  for (const path of ['settings/security', 'organization/settings']) {
    await page.goto('/better-auth/' + path);
    await page
      .getByRole('button', { name: 'API-Schlüssel erstellen', exact: true })
      .first()
      .click();
    const dialog = page.getByRole('alertdialog', { name: 'API-Schlüssel erstellen' });
    await dialog.getByLabel('Name', { exact: true }).fill('Ephemeral test key');
    await dialog.getByRole('button', { name: 'API-Schlüssel erstellen', exact: true }).click();
    await page
      .getByRole('button', { name: 'Ich habe meinen Schlüssel gespeichert', exact: true })
      .click();
    await expect(page.getByText('Ephemeral test key', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'API-Schlüssel löschen', exact: true }).click();
    await page
      .getByRole('alertdialog', { name: 'API-Schlüssel löschen' })
      .getByRole('button', { name: 'API-Schlüssel löschen', exact: true })
      .click();
    await expect(page.getByText('Ephemeral test key', { exact: true })).toHaveCount(0);
  }
  expect(database.apikey).toHaveLength(0);
});

test('security cards share separators and destructive button finish across themes and widths', async ({
  page,
  baseURL,
}) => {
  const { auth } = backend(baseURL!);
  await connect(page, auth);
  await signup(page, 'security-theme@example.test', 'Security Theme');
  await page.goto('/settings/security');
  await expect(page.getByRole('button', { name: 'Überall abmelden', exact: true })).toBeVisible();
  for (const width of [390, 768, 1386]) {
    await page.setViewportSize({ width, height: 900 });
    for (const dark of [false, true]) {
      await page.evaluate(
        (value) => document.documentElement.classList.toggle('dark', value),
        dark,
      );
      const styles = await page.evaluate(() => {
        const danger = getComputedStyle(document.querySelector('.button--danger')!);
        const primary = getComputedStyle(document.querySelector('.button--primary')!);
        const separators = [
          ...document.querySelectorAll('.card .border-dashed, .card .border-divider'),
        ];
        return {
          radius: danger.borderRadius,
          primaryRadius: primary.borderRadius,
          corner: danger.getPropertyValue('corner-shape'),
          primaryCorner: primary.getPropertyValue('corner-shape'),
          fill: danger.backgroundImage,
          shadow: danger.boxShadow,
          separators: separators.map((el) => getComputedStyle(el).borderTopStyle),
          sessionInsets: (() => {
            const button = document.querySelector('.button--danger')!;
            const card = button.closest('.card')!;
            const footer = button.parentElement!;
            const row = card.querySelector('.card__content > .border-divider')!;
            return {
              outer: getComputedStyle(card).padding,
              row: getComputedStyle(row).padding,
              footer: getComputedStyle(footer).padding,
              lineWidth: footer.getBoundingClientRect().width,
              cardWidth: card.getBoundingClientRect().width,
            };
          })(),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(styles.radius).toBe(styles.primaryRadius);
      expect(styles.corner).toBe(styles.primaryCorner);
      expect(styles.fill).toContain('linear-gradient');
      expect(styles.shadow).not.toBe('none');
      expect(styles.separators.length).toBeGreaterThan(0);
      expect(styles.separators.every((style) => style === 'solid')).toBe(true);
      expect(styles.sessionInsets.outer).toBe('0px');
      expect(styles.sessionInsets.row).toBe('16px');
      expect(styles.sessionInsets.footer).toBe('16px');
      expect(styles.sessionInsets.lineWidth).toBeCloseTo(styles.sessionInsets.cardWidth, 0);
      expect(styles.overflow).toBe(false);
    }
  }
});

test('studio organization plugin persists real organizations and isolates account switches', async ({
  page,
  baseURL,
}) => {
  const { auth, database } = backend(baseURL!);
  await connect(page, auth);
  await signup(page, 'organization-owner@example.test', 'Organization Owner');
  await page.goto('/');
  await page.getByRole('button', { name: 'Organisation wechseln', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /Studio Nord/ })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Organisation erstellen', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Organisation erstellen', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Persistent Studio');
  await dialog.getByRole('button', { name: 'Organisation erstellen', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Organisation wechseln', exact: true }),
  ).toContainText('Persistent Studio');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Organisation wechseln', exact: true }),
  ).toContainText('Persistent Studio');
  expect(database.organization).toHaveLength(1);
  expect(database.member).toHaveLength(1);
  await page.goto('/settings/organization');
  await page.getByRole('textbox', { name: /^Website/ }).fill('https://www.mva');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByText('Ungültige URL.', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /^Website/ }).fill('https://example.com');
  await page.getByRole('textbox', { name: /^Name/ }).fill('Updated Studio');
  await page.getByRole('button', { name: 'Änderungen speichern', exact: true }).click();
  await expect(page.getByText('Änderungen gespeichert.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Updated Studio');
  await page.goto('/settings/organization-members');
  await expect(page.getByRole('cell', { name: /Organization Owner/ })).toBeVisible();
  await signup(page, 'other-owner@example.test', 'Other Owner');
  await page.goto('/');
  await page.getByRole('button', { name: 'Organisation wechseln', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: /Updated Studio/ })).toHaveCount(0);
  expect(database.organization).toHaveLength(1);
});

// Validates the package-owned controls without relying on the removed local demo service.
test('authenticated host renders owned shell and organization controls', async ({
  page,
  baseURL,
}) => {
  const { auth } = backend(baseURL!);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await connect(page, auth);
  await signup(page, 'owned-ui@example.test', 'Owned UI');
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Organisation wechseln', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Owned UI/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('language preference updates plugin UI, persists and resets through App Preferences', async ({
  page,
  baseURL,
}) => {
  const { auth } = backend(baseURL!);
  await connect(page, auth);
  await page.goto('/better-auth/auth/sign-up');
  await page.getByLabel('Name', { exact: true }).fill('Locale Test');
  await page.getByLabel('E-Mail-Adresse', { exact: true }).fill('locale@example.test');
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByLabel('Passwort bestätigen', { exact: true }).fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/settings/language');
  await expect(page.getByRole('combobox')).toHaveText('🇩🇪 Deutsch');
  await page.evaluate(() => {
    (window as unknown as { localeMarker: string }).localeMarker = 'mounted';
  });
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: '🇬🇧 English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Language', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reset to default: Interface language', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { localeMarker: string }).localeMarker),
  ).toBe('mounted');
  await page.reload();
  await expect(page.getByRole('combobox')).toHaveText('🇬🇧 English');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.setViewportSize({ width: 390, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page
    .getByRole('button', { name: 'Reset to default: Interface language', exact: true })
    .click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('combobox')).toHaveText('🇩🇪 Deutsch');
});
