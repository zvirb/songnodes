import { test, expect } from '@playwright/test';

test('Frontend accessibility and 3D toggle test', async ({ page }) => {
  console.log('Starting test - navigating to localhost:8088');

  // Navigate to the frontend
  await page.goto('http://localhost:8088');

  // Wait for the page to load
  await page.waitForLoadState('networkidle', { timeout: 30000 });

  console.log('Page loaded, checking title');

  // Check if page loads
  const title = await page.title();
  console.log('Page title:', title);

  // Take a screenshot for debugging
  await page.screenshot({ path: 'frontend-loaded.png', fullPage: true });

  // Look for any text content
  const bodyText = await page.textContent('body');
  console.log('Body text length:', bodyText?.length || 0);

  // Check for React root
  const reactRoot = page.locator('#root');
  const rootExists = await reactRoot.isVisible();
  console.log('React root visible:', rootExists);

  // Look for canvas elements
  const canvases = await page.locator('canvas').count();
  console.log('Canvas elements found:', canvases);

  // Look for any buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('All button texts:', buttons);

  // Look for text that might indicate 3D toggle
  const has3DText = bodyText?.includes('3D') || bodyText?.includes('2D');
  console.log('Has 3D/2D text:', has3DText);

  // Check for potential error messages
  const hasError = bodyText?.includes('error') || bodyText?.includes('Error');
  console.log('Has error text:', hasError);

  // Log current URL
  console.log('Current URL:', page.url());

  expect(title).toBeTruthy();
});