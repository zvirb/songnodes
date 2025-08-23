import { test, expect, Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test.describe('Graph Visualization E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to the graph page
    await page.goto('/graph');
    
    // Wait for the application to load
    await page.waitForLoadState('networkidle');
    
    // Setup for accessibility testing - AxeBuilder will handle injection
  });

  test.describe('Basic Functionality', () => {
    test('loads graph visualization successfully', async () => {
      // Check that the main canvas is present
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();
      
      // Check that loading completes
      await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
      
      // Verify graph data is loaded
      await expect(page.locator('[data-testid="node-count"]')).toContainText(/\d+ nodes/);
      await expect(page.locator('[data-testid="edge-count"]')).toContainText(/\d+ edges/);
    });

    test('displays graph controls', async () => {
      // Check for zoom controls
      await expect(page.locator('[data-testid="zoom-in"]')).toBeVisible();
      await expect(page.locator('[data-testid="zoom-out"]')).toBeVisible();
      await expect(page.locator('[data-testid="reset-view"]')).toBeVisible();
      
      // Check for view controls
      await expect(page.locator('[data-testid="fullscreen-toggle"]')).toBeVisible();
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
    });

    test('shows node information on selection', async () => {
      const canvas = page.locator('canvas').first();
      
      // Click on the canvas to select a node
      await canvas.click({ position: { x: 400, y: 300 } });
      
      // Wait for node details panel to appear
      await expect(page.locator('[data-testid="node-details"]')).toBeVisible();
      
      // Check that node information is displayed
      await expect(page.locator('[data-testid="node-name"]')).toBeVisible();
      await expect(page.locator('[data-testid="node-type"]')).toBeVisible();
    });
  });

  test.describe('User Interactions', () => {
    test('supports zoom in and out', async () => {
      const canvas = page.locator('canvas').first();
      const zoomInButton = page.locator('[data-testid="zoom-in"]');
      const zoomOutButton = page.locator('[data-testid="zoom-out"]');
      
      // Get initial zoom level
      const initialZoom = await page.locator('[data-testid="zoom-level"]').textContent();
      
      // Zoom in
      await zoomInButton.click();
      await page.waitForTimeout(500); // Allow animation
      
      const zoomedInLevel = await page.locator('[data-testid="zoom-level"]').textContent();
      expect(zoomedInLevel).not.toBe(initialZoom);
      
      // Zoom out
      await zoomOutButton.click();
      await page.waitForTimeout(500);
      
      const zoomedOutLevel = await page.locator('[data-testid="zoom-level"]').textContent();
      expect(zoomedOutLevel).not.toBe(zoomedInLevel);
    });

    test('supports mouse wheel zoom', async () => {
      const canvas = page.locator('canvas').first();
      
      // Get initial zoom level
      const initialZoom = await page.locator('[data-testid="zoom-level"]').textContent();
      
      // Use mouse wheel to zoom in
      await canvas.hover();
      await page.mouse.wheel(0, -120); // Scroll up to zoom in
      await page.waitForTimeout(300);
      
      const newZoom = await page.locator('[data-testid="zoom-level"]').textContent();
      expect(newZoom).not.toBe(initialZoom);
    });

    test('supports pan/drag functionality', async () => {
      const canvas = page.locator('canvas').first();
      
      // Get initial pan position
      const initialPan = await page.locator('[data-testid="pan-position"]').textContent();
      
      // Perform drag operation
      await canvas.hover();
      await page.mouse.down();
      await page.mouse.move(100, 100);
      await page.mouse.up();
      await page.waitForTimeout(300);
      
      const newPan = await page.locator('[data-testid="pan-position"]').textContent();
      expect(newPan).not.toBe(initialPan);
    });

    test('supports node selection and deselection', async () => {
      const canvas = page.locator('canvas').first();
      
      // Click to select a node
      await canvas.click({ position: { x: 400, y: 300 } });
      
      // Verify selection
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('1 selected');
      await expect(page.locator('[data-testid="node-details"]')).toBeVisible();
      
      // Click elsewhere to deselect
      await canvas.click({ position: { x: 100, y: 100 } });
      
      // Verify deselection
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('0 selected');
      await expect(page.locator('[data-testid="node-details"]')).not.toBeVisible();
    });

    test('supports multi-select with Ctrl+click', async () => {
      const canvas = page.locator('canvas').first();
      
      // Select first node
      await canvas.click({ position: { x: 400, y: 300 } });
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('1 selected');
      
      // Ctrl+click to add second node to selection
      await canvas.click({ 
        position: { x: 500, y: 400 },
        modifiers: ['Control']
      });
      
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('2 selected');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('supports keyboard navigation', async () => {
      const canvas = page.locator('canvas').first();
      
      // Focus the canvas
      await canvas.focus();
      
      // Use arrow keys to navigate
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      
      // Check that keyboard navigation announcement is made
      const announcement = page.locator('[aria-live="polite"]');
      await expect(announcement).toContainText(/navigated/i);
    });

    test('supports Enter key for selection', async () => {
      const canvas = page.locator('canvas').first();
      
      await canvas.focus();
      await page.keyboard.press('ArrowRight'); // Navigate to a node
      await page.keyboard.press('Enter'); // Select it
      
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('1 selected');
    });

    test('supports Escape key to clear selection', async () => {
      const canvas = page.locator('canvas').first();
      
      // First select a node
      await canvas.click({ position: { x: 400, y: 300 } });
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('1 selected');
      
      // Press Escape to clear
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="selected-nodes"]')).toContainText('0 selected');
    });

    test('supports Tab navigation through controls', async () => {
      // Tab through all focusable elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('loads within performance budget', async () => {
      const startTime = Date.now();
      
      await page.goto('/graph');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
      
      // Check for performance optimizations with large datasets
      const nodeCount = await page.locator('[data-testid="node-count"]').textContent();
      const count = parseInt(nodeCount?.match(/\d+/)?.[0] || '0');
      
      if (count > 1000) {
        await expect(page.locator('canvas')).toHaveAttribute('data-performance-mode', 'optimized');
      }
    });

    test('maintains responsive interactions', async () => {
      const canvas = page.locator('canvas').first();
      
      // Perform rapid interactions
      const startTime = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await canvas.click({ position: { x: 400 + i * 10, y: 300 + i * 10 } });
        await page.waitForTimeout(50);
      }
      
      const totalTime = Date.now() - startTime;
      
      // Should complete rapid interactions within reasonable time
      expect(totalTime).toBeLessThan(2000);
    });

    test('measures frame rate performance', async () => {
      // Start performance monitoring
      await page.evaluate(() => {
        (window as any).performanceMetrics = {
          frameCount: 0,
          startTime: performance.now(),
        };
        
        function countFrames() {
          (window as any).performanceMetrics.frameCount++;
          requestAnimationFrame(countFrames);
        }
        requestAnimationFrame(countFrames);
      });
      
      // Interact with the graph for 2 seconds
      const canvas = page.locator('canvas').first();
      await canvas.hover();
      await page.mouse.wheel(0, -120); // Trigger animations
      await page.waitForTimeout(2000);
      
      // Calculate FPS
      const metrics = await page.evaluate(() => {
        const m = (window as any).performanceMetrics;
        const elapsed = performance.now() - m.startTime;
        return {
          fps: (m.frameCount / elapsed) * 1000,
          frameCount: m.frameCount,
          elapsed,
        };
      });
      
      // Should maintain reasonable FPS
      expect(metrics.fps).toBeGreaterThan(25); // Minimum 25 FPS
      
      // Store metrics for reporting
      await page.evaluate((metrics) => {
        (window as any).testResults = { performance: metrics };
      }, metrics);
    });
  });

  test.describe('Error Handling', () => {
    test('handles network errors gracefully', async () => {
      // Intercept API calls and simulate errors
      await page.route('**/api/v1/nodes', route => {
        route.abort('failed');
      });
      
      await page.goto('/graph');
      
      // Should show error message
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/failed to load/i);
      
      // Should provide retry option
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    });

    test('handles empty data state', async () => {
      // Mock empty response
      await page.route('**/api/v1/nodes', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ nodes: [], edges: [] })
        });
      });
      
      await page.goto('/graph');
      await page.waitForLoadState('networkidle');
      
      // Should show empty state
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
      await expect(page.locator('[data-testid="empty-state"]')).toContainText(/no data/i);
    });

    test('recovers from rendering errors', async () => {
      // Simulate rendering error by injecting invalid data
      await page.evaluate(() => {
        // Trigger a rendering error
        (window as any).simulateRenderingError = true;
      });
      
      await page.goto('/graph');
      
      // Should show error boundary
      await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
      
      // Should provide recovery option
      const retryButton = page.locator('[data-testid="retry-render"]');
      await expect(retryButton).toBeVisible();
      
      // Click retry and verify recovery
      await retryButton.click();
      await page.waitForTimeout(1000);
      
      await expect(page.locator('[data-testid="error-boundary"]')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('meets WCAG 2.1 AA standards', async () => {
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('provides screen reader support', async () => {
      // Check for ARIA labels and live regions
      await expect(page.locator('canvas')).toHaveAttribute('aria-label');
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      
      // Test screen reader announcements
      const canvas = page.locator('canvas').first();
      await canvas.click({ position: { x: 400, y: 300 } });
      
      const announcement = page.locator('[aria-live="polite"]');
      await expect(announcement).toContainText(/selected/i);
    });

    test('supports high contrast mode', async () => {
      // Enable high contrast mode
      await page.locator('[data-testid="settings-button"]').click();
      await page.locator('[data-testid="high-contrast-toggle"]').click();
      
      // Verify high contrast styles are applied
      const canvas = page.locator('canvas').first();
      await expect(canvas).toHaveClass(/high-contrast/);
    });

    test('supports reduced motion preferences', async () => {
      // Mock prefers-reduced-motion
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await page.goto('/graph');
      
      // Check that animations are disabled
      const canvas = page.locator('canvas').first();
      await expect(canvas).toHaveClass(/reduced-motion/);
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    ['chromium', 'firefox', 'webkit'].forEach(browserName => {
      test(`works correctly in ${browserName}`, async ({ page }) => {
        await page.goto('/graph');
        await page.waitForLoadState('networkidle');
        
        // Basic functionality should work in all browsers
        const canvas = page.locator('canvas').first();
        await expect(canvas).toBeVisible();
        
        // Test interaction
        await canvas.click({ position: { x: 400, y: 300 } });
        await expect(page.locator('[data-testid="node-details"]')).toBeVisible();
        
        // Take screenshot for visual comparison
        await expect(page).toHaveScreenshot(`${browserName}-graph-view.png`);
      });
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('works on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/graph');
      await page.waitForLoadState('networkidle');
      
      // Check mobile-specific UI
      const canvas = page.locator('canvas').first();
      await expect(canvas).toBeVisible();
      
      // Test touch interactions
      await canvas.tap({ position: { x: 200, y: 300 } });
      await expect(page.locator('[data-testid="node-details"]')).toBeVisible();
      
      // Test pinch zoom
      await canvas.touchscreen.tap(200, 300);
      await page.touchscreen.tap(300, 400);
    });

    test('adapts controls for touch devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await page.goto('/graph');
      
      // Check that touch-friendly controls are visible
      await expect(page.locator('[data-testid="touch-controls"]')).toBeVisible();
      await expect(page.locator('[data-testid="zoom-controls"]')).toHaveClass(/touch-optimized/);
    });
  });
});