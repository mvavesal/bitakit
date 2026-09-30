import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadEnvConfig } from '@next/env';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

// Explicit opt-in: creates and removes only its own disposable test records.
test('real auth and organization boundaries', async ({ page, context, browser }) => {
  test.skip(process.env.AUTH_INTEGRATION !== '1', 'Requires the configured test database.');
  test.setTimeout(120000);
  loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const suffix = randomUUID();
  const ownerEmail = `owner-${suffix}@example.invalid`;
  const outsiderEmail = `outsider-${suffix}@example.invalid`;
  const password = randomUUID();
  const ids: string[] = [];
  const outsider = await browser.newContext({ baseURL: 'http://127.0.0.1:3101' });
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const post = (path: string, data: object) =>
    page.request.post(`/api/auth/${path}`, { data, headers: { origin: 'http://127.0.0.1:3101' } });
  try {
    const anonymousUpload = await page.request.post('/api/organizations', {
      headers: { origin: 'http://127.0.0.1:3101' },
      multipart: { name: 'Denied', slug: 'denied' },
    });
    expect(anonymousUpload.status()).toBe(401);
    expect(
      (
        await page.request.post('/api/organizations/invitations', {
          headers: { origin: 'http://127.0.0.1:3101' },
          data: {},
        })
      ).status(),
    ).toBe(401);
    await page.goto('/register');
    await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(
      (await context.cookies()).some(
        (cookie) => cookie.name.includes('session_token') && cookie.httpOnly,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: 'Create an organization', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Create an organization' })).toBeVisible();
    const websiteInput = page.getByLabel('Website (optional)', { exact: true });
    await websiteInput.fill('not a website');
    await websiteInput.press('Tab');
    await expect(websiteInput).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText(
        'Enter a valid http:// or https:// address without login details, or leave this field empty.',
        { exact: true },
      ),
    ).toBeVisible();
    await websiteInput.fill('https://example.com');
    await expect(websiteInput).toHaveAttribute('aria-invalid', 'false');
    await websiteInput.fill('https://user:secret@example.com');
    await expect(websiteInput).toHaveAttribute('aria-invalid', 'true');
    await websiteInput.fill('');
    await expect(websiteInput).toHaveAttribute('aria-invalid', 'false');
    await page.getByRole('button', { name: 'Create organization', exact: true }).click();
    await expect(page.getByLabel('Organization name', { exact: true })).toBeFocused();
    await expect(
      page.getByText('Enter an organization name (1–100 characters).', { exact: true }),
    ).toBeVisible();
    const invalidDetails = await page.request.post('/api/organizations', {
      headers: { origin: 'http://127.0.0.1:3101' },
      multipart: { name: 'Invalid', slug: 'invalid', website: 'not a website' },
    });
    expect(invalidDetails.status()).toBe(400);
    expect((await invalidDetails.json()).fields).toContain('website');
    const invalidImage = await page.request.post('/api/organizations', {
      headers: { origin: 'http://127.0.0.1:3101' },
      multipart: {
        name: 'Invalid',
        slug: 'invalid',
        logo: { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('not an image') },
      },
    });
    expect(invalidImage.status()).toBe(400);
    expect((await invalidImage.json()).error).toBe('logoInvalid');
    const wrongOrigin = await page.request.post('/api/organizations', {
      headers: { origin: 'https://untrusted.example' },
      multipart: { name: 'Denied', slug: 'denied' },
    });
    expect(wrongOrigin.status()).toBe(403);
    await page.getByLabel('Organization name', { exact: true }).fill('First test workspace');
    await page.getByLabel('Organization identifier', { exact: true }).fill(`first-${suffix}`);
    await page.getByLabel('Logo (optional)', { exact: true }).setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: await sharp({ create: { width: 64, height: 64, channels: 3, background: '#446688' } })
        .png()
        .toBuffer(),
    });
    await page.getByLabel('Website (optional)', { exact: true }).fill('https://example.com');
    await page.route(
      '**/api/organizations',
      (route) =>
        route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'logoUploadError' }),
        }),
      { times: 1 },
    );
    await page.getByRole('button', { name: 'Create organization', exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText(
      'Could not create the organization',
    );
    await expect(page.getByLabel('Organization name', { exact: true })).toHaveValue(
      'First test workspace',
    );
    await page.getByRole('button', { name: 'Create organization', exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText(
      'Organization created',
    );
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'First test workspace', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: '/tmp/organization-toast.png' });
    const list = await (await page.request.get('/api/auth/organization/list')).json();
    expect(list).toHaveLength(1);
    ids.push(list[0].id);
    expect(list[0].logo).toContain('/storage/v1/object/public/assets/users/');
    expect((await page.request.get(list[0].logo)).ok()).toBe(true);
    const metadata =
      typeof list[0].metadata === 'string' ? JSON.parse(list[0].metadata) : list[0].metadata;
    expect(metadata.website).toBe('https://example.com');
    await expect(
      page.getByRole('button', { name: 'Switch organization', exact: true }).locator('img'),
    ).toHaveAttribute('src', list[0].logo);
    const invalidWebsite = await post('organization/update', {
      organizationId: ids[0],
      data: { metadata: { website: 'javascript:alert(1)' } },
    });
    expect(invalidWebsite.status()).toBe(400);
    const second = await post('organization/create', {
      name: 'Second test workspace',
      slug: `second-${suffix}`,
    });
    expect(second.ok()).toBe(true);
    ids.push((await second.json()).id);
    await page.reload();
    await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
    await page.getByRole('combobox', { name: 'Find organization…' }).fill('does not exist');
    await expect(page.getByText('No organizations found.', { exact: true })).toBeVisible();
    await page.getByRole('combobox', { name: 'Find organization…' }).fill('First');
    await expect(page.getByRole('option', { name: /^Second test workspace/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Find organization…' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Find organization…' })).toBeFocused();
    await expect(page.getByRole('option', { name: /^Second test workspace/ })).toBeVisible();
    await page.getByRole('option', { name: /^First test workspace/ }).click();
    await expect(
      page.getByRole('heading', { name: 'First test workspace', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Organization settings', exact: true }).last().click();
    await page.getByRole('link', { name: 'Members', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: ownerEmail, exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Find people…' }).fill('no-such-member');
    await expect(page.getByText('No matching people', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/q=no-such-member/);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Find people…' })).toHaveValue('no-such-member');
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    await page.getByRole('button', { name: 'Filter by role', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Member', exact: true }).click();
    await expect(page.getByText('No matching people', { exact: true })).toBeVisible();
    await page
      .getByRole('tabpanel')
      .getByRole('button', { name: 'Clear filters', exact: true })
      .click();
    await expect(page.getByRole('cell', { name: ownerEmail, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Invite member', exact: true }).click();
    const inviteDialog = page.getByRole('dialog', { name: 'Invite member' });
    const expiryInput = inviteDialog.getByRole('spinbutton', { name: 'Expires after' });
    await expect(expiryInput).toHaveValue('30');
    for (const invalidDays of ['', '0', '1.5', '366']) {
      await expiryInput.fill(invalidDays);
      await expiryInput.press('Tab');
      await expect(
        inviteDialog.getByText('Enter a whole number between 1 and 365 days.'),
      ).toBeVisible();
    }
    await expiryInput.fill('7');
    await expect(expiryInput).toHaveAttribute('aria-invalid', 'false');
    await inviteDialog.getByLabel('Email', { exact: true }).fill('invalid');
    await inviteDialog.getByLabel('Email', { exact: true }).press('Tab');
    await expect(inviteDialog.getByText('Enter a valid email address.')).toBeVisible();
    const invitedEmail = `invited-${suffix}@example.invalid`;
    await inviteDialog.getByLabel('Email', { exact: true }).fill(invitedEmail);
    await inviteDialog.getByLabel('Email', { exact: true }).press('Enter');
    await inviteDialog.getByRole('button', { name: 'Create invitation', exact: true }).click();
    await expect(inviteDialog).toHaveCount(0);
    const storedInvitation = (
      await pool.query(
        'SELECT "createdAt", "expiresAt" FROM invitation WHERE "organizationId"=$1 AND email=$2',
        [ids[0], invitedEmail],
      )
    ).rows[0];
    const dayMs = 24 * 60 * 60 * 1000;
    expect(
      Math.abs(
        storedInvitation.expiresAt.getTime() - storedInvitation.createdAt.getTime() - 7 * dayMs,
      ),
    ).toBeLessThan(5000);

    // Concurrent requests keep their own duration; absent values use the default.
    await Promise.all(
      [1, 365, undefined].map(async (expiresInDays) => {
        const response = await page.request.post('/api/organizations/invitations', {
          headers: { origin: 'http://127.0.0.1:3101' },
          data: {
            organizationId: ids[0],
            email: `expiry-${expiresInDays ?? 'default'}-${suffix}@example.invalid`,
            role: 'member',
            expiresInDays,
          },
        });
        expect(response.ok()).toBe(true);
        const invitation = await response.json();
        const duration =
          new Date(invitation.expiresAt).getTime() - new Date(invitation.createdAt).getTime();
        expect(Math.abs(duration - (expiresInDays ?? 30) * dayMs)).toBeLessThan(5000);
        await post('organization/cancel-invitation', { invitationId: invitation.id });
      }),
    );
    for (const expiresInDays of [0, -1, 1.5, 366, null, '7']) {
      const rejected = await page.request.post('/api/organizations/invitations', {
        headers: { origin: 'http://127.0.0.1:3101' },
        data: {
          organizationId: ids[0],
          email: `invalid-${suffix}@example.invalid`,
          role: 'member',
          expiresInDays,
        },
      });
      expect(rejected.status()).toBe(400);
    }
    expect(
      (
        await page.request.post('/api/organizations/invitations', {
          headers: { origin: 'https://untrusted.example' },
          data: {
            organizationId: ids[0],
            email: `origin-${suffix}@example.invalid`,
            role: 'member',
            expiresInDays: 7,
          },
        })
      ).status(),
    ).toBe(403);
    await expect(page.getByRole('cell', { name: invitedEmail, exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Actions for ${invitedEmail}`, exact: true }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Resend invitation', exact: true }),
    ).toBeDisabled();
    await page.getByRole('menuitem', { name: 'Cancel invitation', exact: true }).click();
    await expect(page.getByRole('cell', { name: invitedEmail, exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'General', exact: true }).click();
    const general = page.locator('main').last();
    await expect(general.getByLabel('Organization name', { exact: true })).toHaveValue(
      'First test workspace',
    );
    await expect(general.getByRole('img', { name: 'Organization logo preview' })).toHaveAttribute(
      'src',
      list[0].logo,
    );
    await general.getByLabel('Website (optional)', { exact: true }).fill('https://example.org');
    await general.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText(
      'Organization updated',
    );
    const updated = await (await page.request.get('/api/organizations')).json();
    expect(updated.find((org: { id: string }) => org.id === ids[0]).logo).toBe(list[0].logo);

    // A separate disposable organization covers logo removal, delete cancellation and confirmation.
    const third = await post('organization/create', {
      name: 'Temporary workspace',
      slug: `temporary-${suffix}`,
      logo: list[0].logo,
    });
    const thirdId = (await third.json()).id;
    ids.push(thirdId);
    await post('organization/set-active', { organizationId: thirdId });
    await page.goto('/settings/organization');
    await general.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(general.getByRole('img', { name: 'Organization logo preview' })).toHaveCount(0);
    await general.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText(
      'Organization updated',
    );
    const withoutLogo = await (await page.request.get('/api/organizations')).json();
    expect(withoutLogo.find((org: { id: string }) => org.id === thirdId).logo).toBe('');
    await general.getByRole('button', { name: 'Delete organization', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(general.getByLabel('Organization name', { exact: true })).toHaveValue(
      'Temporary workspace',
    );
    await general.getByRole('button', { name: 'Delete organization', exact: true }).click();
    await confirmation.getByRole('button', { name: 'Delete organization', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(
      (
        await page.request.get(
          '/api/auth/organization/get-full-organization?organizationId=' + thirdId,
        )
      ).ok(),
    ).toBe(false);
    // Deleting an org using the same logo URL must never delete another org's file.
    expect((await page.request.get(list[0].logo)).ok()).toBe(true);
    await post('organization/set-active', { organizationId: ids[0] });
    await page.reload();
    const own = await page.request.get(
      `/api/auth/organization/get-full-organization?organizationId=${ids[0]}`,
    );
    expect(own.ok()).toBe(true);
    expect((await own.json()).members[0].role).toBe('owner');

    const signup = await outsider.request.post('/api/auth/sign-up/email', {
      data: { name: 'Test outsider', email: outsiderEmail, password },
      headers: { origin: 'http://127.0.0.1:3101' },
    });
    expect(signup.ok()).toBe(true);
    const deniedInvitation = (organizationId: string) =>
      outsider.request.post('/api/organizations/invitations', {
        headers: { origin: 'http://127.0.0.1:3101' },
        data: {
          organizationId,
          email: `denied-${suffix}@example.invalid`,
          role: 'member',
          expiresInDays: 7,
        },
      });
    const notAMember = await deniedInvitation(ids[0]);
    expect(notAMember.status()).toBe(400);
    expect((await notAMember.json()).code).toBe('MEMBER_NOT_FOUND');
    const expiringResponse = await page.request.post('/api/organizations/invitations', {
      headers: { origin: 'http://127.0.0.1:3101' },
      data: { organizationId: ids[0], email: outsiderEmail, role: 'member', expiresInDays: 1 },
    });
    expect(expiringResponse.ok()).toBe(true);
    const expiringInvitation = await expiringResponse.json();
    // Simulate time passing for this disposable invitation, without waiting a day.
    await pool.query(
      'UPDATE invitation SET "expiresAt"=NOW() - INTERVAL \'1 second\' WHERE id=$1',
      [expiringInvitation.id],
    );
    const expiredAcceptance = await outsider.request.post(
      '/api/auth/organization/accept-invitation',
      {
        headers: { origin: 'http://127.0.0.1:3101' },
        data: { invitationId: expiringInvitation.id },
      },
    );
    expect(expiredAcceptance.status()).toBe(400);
    expect((await expiredAcceptance.json()).code).toBe('INVITATION_NOT_FOUND');
    expect((await outsider.request.get('/api/organizations/active')).status()).toBe(404);
    const deniedDetail = await outsider.request.get(`/dashboard/organizations/${ids[0]}`);
    expect(await deniedDetail.text()).not.toContain(ownerEmail);
    expect(await (await outsider.request.get('/api/auth/organization/list')).json()).toEqual([]);
    for (const [path, data] of [
      ['organization/set-active', { organizationId: ids[0] }],
      ['organization/update', { organizationId: ids[0], data: { name: 'Forbidden rename' } }],
    ] as const) {
      const denied = await outsider.request.post(`/api/auth/${path}`, {
        data,
        headers: { origin: 'http://127.0.0.1:3101' },
      });
      expect(denied.status()).toBe(path === 'organization/update' ? 400 : 403);
      expect((await denied.json()).code).toBe('USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION');
    }
    expect(await (await outsider.request.get('/api/organizations')).json()).toEqual([]);
    const deniedUpload = await outsider.request.patch(`/api/organizations?id=${ids[0]}`, {
      headers: { origin: 'http://127.0.0.1:3101' },
      multipart: { name: 'Forbidden', slug: 'forbidden', website: '' },
    });
    expect(deniedUpload.status()).toBe(403);
    expect(
      (
        await outsider.request.delete(`/api/organizations?id=${ids[0]}`, {
          headers: { origin: 'http://127.0.0.1:3101' },
        })
      ).status(),
    ).toBe(403);
    const deniedRead = await outsider.request.get(
      `/api/auth/organization/get-full-organization?organizationId=${ids[0]}`,
    );
    expect(deniedRead.status()).toBe(403);
    const outsiderSession = await (await outsider.request.get('/api/auth/get-session')).json();
    const outsiderUser = outsiderSession.user;
    await pool.query('UPDATE session SET "activeOrganizationId"=$1 WHERE id=$2', [
      ids[0],
      outsiderSession.session.id,
    ]);
    expect((await outsider.request.get('/api/organizations/active')).status()).toBe(403);
    await pool.query('UPDATE session SET "activeOrganizationId"=NULL WHERE id=$1', [
      outsiderSession.session.id,
    ]);
    await pool.query(
      'INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1,$2,$3,$4,NOW())',
      [randomUUID(), ids[1], outsiderUser.id, 'member'],
    );
    const memberOrganizations = await (await outsider.request.get('/api/organizations')).json();
    expect(memberOrganizations).toHaveLength(1);
    expect(memberOrganizations[0].role).toBe('member');
    expect((await deniedInvitation(ids[1])).status()).toBe(403);
    expect(
      (
        await outsider.request.patch(`/api/organizations?id=${ids[1]}`, {
          headers: { origin: 'http://127.0.0.1:3101' },
          multipart: { name: 'Forbidden', slug: 'forbidden', website: '' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await outsider.request.delete(`/api/organizations?id=${ids[1]}`, {
          headers: { origin: 'http://127.0.0.1:3101' },
        })
      ).status(),
    ).toBe(403);
    await post('organization/set-active', { organizationId: ids[1] });
    await page.goto('/settings/organization-members');
    await page.getByRole('button', { name: 'Actions for Test outsider', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Promote to admin', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: outsiderEmail })
        .getByRole('cell', { name: 'Admin', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Test outsider', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Disable access', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: outsiderEmail })
        .getByText('Disabled', { exact: true }),
    ).toBeVisible();
    expect(
      (
        await outsider.request.get(
          `/api/auth/organization/get-full-organization?organizationId=${ids[1]}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await outsider.request.post('/api/auth/organization/set-active', {
          data: { organizationId: ids[1] },
          headers: { origin: 'http://127.0.0.1:3101' },
        })
      ).status(),
    ).toBe(403);
    expect(await (await outsider.request.get('/api/organizations')).json()).toHaveLength(0);
    expect((await deniedInvitation(ids[1])).status()).toBe(403);
    expect(await (await outsider.request.get('/api/auth/organization/list')).json()).toHaveLength(
      0,
    );
    expect((await outsider.request.get('/api/auth/get-session')).status()).toBe(200);
    const secondMembershipId = randomUUID();
    await pool.query(
      'INSERT INTO member (id, "organizationId", "userId", role, "createdAt") VALUES ($1,$2,$3,$4,NOW())',
      [secondMembershipId, ids[0], outsiderUser.id, 'member'],
    );
    expect(
      (
        await outsider.request.get(
          `/api/auth/organization/get-full-organization?organizationId=${ids[0]}`,
        )
      ).status(),
    ).toBe(200);
    const suspendedSlug = (await pool.query('SELECT slug FROM organization WHERE id=$1', [ids[1]]))
      .rows[0].slug;
    expect(
      (
        await outsider.request.get(
          `/api/auth/organization/get-full-organization?organizationId=${ids[0]}&organizationSlug=${suspendedSlug}`,
        )
      ).status(),
    ).toBe(403);
    await pool.query('DELETE FROM member WHERE id=$1', [secondMembershipId]);

    const suspendedMember = (
      await pool.query('SELECT id FROM member WHERE "userId" = $1 AND "organizationId" = $2', [
        outsiderUser.id,
        ids[1],
      ])
    ).rows[0];
    expect(
      (
        await outsider.request.patch('/api/organizations/members', {
          data: { organizationId: ids[1], memberId: suspendedMember.id, disabled: false },
          headers: { origin: 'http://127.0.0.1:3101' },
        })
      ).status(),
    ).toBe(403);
    await page.getByRole('button', { name: 'Actions for Test outsider', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Enable access', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: outsiderEmail })
        .getByText('Disabled', { exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await outsider.request.get(
          `/api/auth/organization/get-full-organization?organizationId=${ids[1]}`,
        )
      ).status(),
    ).toBe(200);
    await page.getByRole('button', { name: 'Actions for Test outsider', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Downgrade to member', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Save changes', exact: true })
      .click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: outsiderEmail })
        .getByRole('cell', { name: 'Member', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Test outsider', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .click();
    await expect(page.getByRole('cell', { name: outsiderEmail, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Actions for Test outsider', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Remove from organization', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Remove from organization', exact: true })
      .click();
    await expect(page.getByRole('cell', { name: outsiderEmail, exact: true })).toHaveCount(0);
    const maliciousOrigin = await page.request.post('/api/auth/organization/create', {
      data: { name: 'Forbidden', slug: `forbidden-${suffix}` },
      headers: { origin: 'https://untrusted.example' },
    });
    expect(maliciousOrigin.status()).toBe(403);

    // A direct Settings edit persists to this user only and updates the Action-driven toggle.
    await page.goto('/settings/appearance');
    const dark = page.getByRole('radio', { name: 'Dark', exact: true });
    await expect(dark)
      .toBeEnabled()
      .catch(async (error) => {
        throw new Error(
          `${error.message} Settings error: ${await page.getByRole('alert').allTextContents()}`,
        );
      });
    await dark.click();
    await expect(dark).toBeChecked();
    await expect(page.locator('html')).toHaveClass('dark');
    const storedTheme = async () =>
      (
        await pool.query(
          'SELECT s.value FROM app_setting s JOIN "user" u ON u.id=s."userId" WHERE u.email=$1 AND s.key=$2',
          [ownerEmail, 'appearance.theme'],
        )
      ).rows[0]?.value;
    await expect.poll(storedTheme).toBe('dark');
    await expect(page.locator('[data-sonner-toast][data-type="success"]')).toContainText(
      'Changes saved',
    );
    await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
    await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
    await expect.poll(storedTheme).toBe('light');
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
    expect(
      (
        await pool.query(
          'SELECT s.id FROM app_setting s JOIN "user" u ON u.id=s."userId" WHERE u.email=$1',
          [outsiderEmail],
        )
      ).rows,
    ).toEqual([]);
    await page.goto('/dashboard');

    const exposed = await pool.query(
      "SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relname = ANY($1) AND (NOT relrowsecurity OR has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('authenticated',oid,'SELECT'))",
      [
        [
          'user',
          'session',
          'account',
          'verification',
          'organization',
          'member',
          'invitation',
          'app_setting',
        ],
      ],
    );
    expect(exposed.rows).toEqual([]);
    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await (await page.request.get('/api/auth/get-session')).json()).toBeNull();
    await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.screenshot({ path: '/tmp/foundation-organizations.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('heading', { name: /test workspace/ })).toBeVisible();
    await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
    await page.getByRole('option', { name: /^Second test workspace/ }).click();
    await expect(page.getByRole('combobox', { name: 'Find organization…' })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Switch organization', exact: true }),
    ).toContainText('Second test workspace');
    expect(
      (await (await page.request.get('/api/auth/get-session')).json()).session.activeOrganizationId,
    ).toBe(ids[1]);
    await page.screenshot({ path: '/tmp/foundation-sidebar-mobile.png' });
    await page.getByRole('button', { name: 'Switch organization', exact: true }).click();
    await page.getByRole('option', { name: 'Create an organization', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Create an organization', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Sidebar', exact: true })).toHaveCount(0);
    await page
      .getByRole('dialog', { name: 'Create an organization', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
    expect(errors).toEqual([]);
  } finally {
    if (test.info().status !== test.info().expectedStatus)
      await test.info().attach('browser-errors', {
        body: JSON.stringify({ errors, consoleErrors }),
        contentType: 'application/json',
      });
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } },
    ).storage.from('assets');
    const rows = (await pool.query('SELECT id FROM "user" WHERE email=$1', [ownerEmail])).rows;
    for (const user of rows) {
      const prefix = `users/${user.id}/organizations`;
      const objects = await storage.list(prefix);
      if (objects.data?.length)
        await storage.remove(objects.data.map((file) => `${prefix}/${file.name}`));
    }
    // Also catch partially created organizations if an assertion failed before IDs were recorded.
    await pool.query('DELETE FROM "organization" WHERE slug = ANY($1)', [
      [`first-${suffix}`, `second-${suffix}`, `forbidden-${suffix}`, `temporary-${suffix}`],
    ]);
    await pool.query('DELETE FROM "user" WHERE email = ANY($1)', [[ownerEmail, outsiderEmail]]);
    await pool.end();
    await outsider.close();
  }
});
