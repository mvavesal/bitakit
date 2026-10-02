import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3101', ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run dev -- --port 3101',
    url: 'http://127.0.0.1:3101/app-preview',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
