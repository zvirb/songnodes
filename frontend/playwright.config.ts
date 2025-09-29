import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory structure
  testDir: './tests/e2e',
  outputDir: './tests/screenshots',

  // Global test configuration optimized for complex graph rendering
  timeout: 60000, // Extended for complex WebGL operations
  expect: {
    timeout: 15000, // Extended for graph loading and rendering
    toHaveScreenshot: {
      threshold: 0.2,
      mode: 'pixel',
      animations: 'disabled',
    },
    toMatchScreenshot: {
      threshold: 0.2,
      mode: 'pixel',
      animations: 'disabled',
    },
  },

  // Test execution
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'tests/reports/html' }],
    ['json', { outputFile: 'tests/reports/results.json' }],
    ['junit', { outputFile: 'tests/reports/results.xml' }],
    ['list'],
  ],

  // Global test setup
  globalSetup: './tests/setup/global-setup.ts',
  globalTeardown: './tests/setup/global-teardown.ts',

  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3008',

    // Browser context options
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Ignore HTTPS errors for local development
    ignoreHTTPSErrors: true,

    // Enhanced WebGL and PIXI.js optimizations
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu-sandbox',
        '--enable-webgl',
        '--enable-webgl2-compute-context',
        '--enable-accelerated-2d-canvas',
        '--enable-accelerated-video-decode',
        '--enable-gpu-rasterization',
        '--enable-oop-rasterization',
        '--force-color-profile=srgb',
        '--enable-zero-copy',
        '--disable-software-rasterizer',
        '--max_old_space_size=4096', // Increase memory for large graphs
        '--enable-features=VaapiVideoDecoder',
        '--disable-features=VizDisplayCompositor',
        '--enable-experimental-web-platform-features', // For cutting-edge WebGL features
      ],
    },
  },

  // Test projects for different scenarios
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: /.*\.desktop\.spec\.ts/,
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
      testMatch: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: /.*\.webkit\.spec\.ts/,
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
      testMatch: /.*\.firefox\.spec\.ts/,
    },
    {
      name: 'graph-visualization',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Extended timeouts for complex graph operations
        actionTimeout: 20000,
        navigationTimeout: 30000,
        // WebGL-specific launch options
        launchOptions: {
          args: [
            '--disable-web-security',
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-accelerated-2d-canvas',
            '--enable-gpu-rasterization',
            '--force-color-profile=srgb',
            '--enable-zero-copy',
            '--disable-software-rasterizer',
            '--max_old_space_size=6144', // More memory for graph testing
            '--enable-experimental-web-platform-features',
          ],
        },
      },
      testMatch: /.*\.graph\.spec\.ts/,
    },
    {
      name: 'webgl-stress-test',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 }, // Large viewport for stress testing
        actionTimeout: 30000,
        navigationTimeout: 60000,
        launchOptions: {
          args: [
            '--disable-web-security',
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-accelerated-2d-canvas',
            '--enable-gpu-rasterization',
            '--enable-oop-rasterization',
            '--force-color-profile=srgb',
            '--enable-zero-copy',
            '--disable-software-rasterizer',
            '--max_old_space_size=8192', // Maximum memory for stress tests
            '--enable-features=VaapiVideoDecoder',
            '--disable-features=VizDisplayCompositor',
          ],
        },
      },
      testMatch: /.*\.webgl-stress\.spec\.ts/,
    },
    {
      name: 'pixi-compatibility',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        actionTimeout: 15000,
        // PIXI.js specific optimizations
        launchOptions: {
          args: [
            '--disable-web-security',
            '--enable-webgl',
            '--enable-webgl2-compute-context',
            '--enable-accelerated-2d-canvas',
            '--force-webgl',
            '--ignore-gpu-blacklist',
            '--enable-unsafe-webgpu', // For future WebGPU support
          ],
        },
      },
      testMatch: /.*\.pixi\.spec\.ts/,
    },
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Performance-specific options
        launchOptions: {
          args: [
            '--disable-web-security',
            '--enable-webgl',
            '--enable-accelerated-2d-canvas',
            '--enable-gpu-rasterization',
            '--enable-oop-rasterization',
            '--enable-features=VaapiVideoDecoder',
            '--disable-features=VizServiceDisplay',
          ],
        },
      },
      testMatch: /.*\.performance\.spec\.ts/,
    },
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Disable animations for consistent screenshots
        reducedMotion: 'reduce',
      },
      testMatch: /.*\.visual\.spec\.ts/,
    }
  ],

  // Development server
  webServer: {
    command: 'npm run dev',
    port: 3008,
    timeout: 60000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
    },
  },
});