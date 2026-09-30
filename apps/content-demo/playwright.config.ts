import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3102', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3102',
    reuseExistingServer: !process.env.CI,
  },
});
