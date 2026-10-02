import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`workspace requires real authentication at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Anmelden', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Demo als Alex öffnen' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Zurück zur Anwendung' })).toHaveCount(0);
  });
}
