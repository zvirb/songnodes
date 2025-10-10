import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for SongNodes E2E Tests
 *
 * This configuration ensures:
 * - Only .spec.ts files in tests/e2e are executed
 * - Proper WebGL support for graph visualization tests
 * - Parallel test execution with retries
 * - Console error detection (production blocker requirement)
 */
export default defineConfig({
  // Test directory - only run tests from tests/e2e
  testDir: './tests/e2e',

  // Test file patterns - only .spec.ts files
  testMatch: '**/*.spec.ts',

  // Ignore patterns - exclude .test.ts files (like camelotConversion.test.ts)
  testIgnore: ['**/*.test.ts', '**/node_modules/**'],

  // Global setup and teardown
  globalSetup: './tests/setup/global-setup.ts',
  globalTeardown: './tests/setup/global-teardown.ts',

  // Test timeout
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:3006',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1920, height: 1080 },
  },

  // Configure projects for major browsers with WebGL support
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-accelerated-2d-canvas',
            '--enable-gpu-rasterization',
            '--force-color-profile=srgb',
            '--disable-software-rasterizer',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
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
      use: { ...devices['Desktop Safari'] },
    },

    // Graph visualization specific tests
    {
      name: 'graph-visualization',
      testMatch: '**/*.graph.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-accelerated-2d-canvas',
            '--enable-gpu-rasterization',
            '--force-color-profile=srgb',
            '--disable-software-rasterizer',
          ],
        },
      },
    },

    // Performance tests
    {
      name: 'performance',
      testMatch: '**/*.performance.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-precise-memory-info',
          ],
        },
      },
    },

    // WebGL stress tests
    {
      name: 'webgl-stress-test',
      testMatch: '**/webgl-stress.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-accelerated-2d-canvas',
            '--max-old-space-size=4096',
          ],
        },
      },
    },

    // PIXI.js specific tests
    {
      name: 'pixi',
      testMatch: '**/*.pixi.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-accelerated-2d-canvas',
          ],
        },
      },
    },

    // Visual regression tests
    {
      name: 'visual',
      testMatch: '**/*.visual.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Desktop-specific tests
    {
      name: 'desktop',
      testMatch: '**/*.desktop.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Run local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3006',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
