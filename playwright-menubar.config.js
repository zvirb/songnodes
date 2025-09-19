module.exports = {
  testDir: '.',
  testMatch: '**/songnodes-menubar-validation-test.js',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
  },
  timeout: 60000,
  // Ignore problematic directories
  testIgnore: ['**/data/**', '**/node_modules/**', '**/dist/**'],
  // Run from current directory only
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
};