import { defineConfig, devices } from '@playwright/test';

/**
 * Simple Playwright config for visualization testing without complex setup
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['line']],

  use: {
    baseURL: 'http://localhost:3009',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },

  outputDir: 'test-results',

  // No global setup/teardown for simple testing
  // No webServer since we're running it manually
});