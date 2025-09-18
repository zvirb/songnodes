module.exports = {
  testDir: '.',
  testMatch: '**/songnodes-ui-test.js',
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
  },
  timeout: 60000,
};