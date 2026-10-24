import { defineConfig, devices } from '@playwright/test';
import { CHROMIUM_GL_ARGS } from './tests/setup/webgl';

// Set PLAYWRIGHT_BASE_URL to test an already running frontend (for example the dev
// Compose stack from inside the Playwright container); otherwise Vite is started.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3006';

/**
 * Playwright configuration for the SongNodes E2E suite (tests/e2e, CLAUDE.md §4).
 *
 * - Sequential (one worker) and no retries: a flaky test is a failing test.
 * - Every test fails on a console error or uncaught page error (tests/e2e/fixtures.ts).
 * - Chromium uses SwiftShader for WebGL so the graph renders without a GPU.
 * - Visual baselines are made only in the Linux Playwright image (scripts/e2e-docker.sh)
 *   and are checked in chromium only.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  globalSetup: './tests/setup/global-setup.ts',
  globalTeardown: './tests/setup/global-teardown.ts',

  timeout: 30000,
  expect: {
    timeout: 15000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.002 },
  },

  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL,
    locale: 'en-AU',
    timezoneId: 'Australia/Melbourne',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: CHROMIUM_GL_ARGS },
      },
    },
    {
      name: 'firefox',
      testIgnore: '**/visual.spec.ts',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.force-enabled': true,
            'webgl.disabled': false,
          },
        },
      },
    },
    {
      name: 'webkit',
      testIgnore: '**/visual.spec.ts',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
