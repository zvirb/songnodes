import { test, expect, Page } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * Visual Regression Test Suite
 * Tests visual consistency, screenshot comparison, and UI stability
 */
test.describe('Visual Regression Testing', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await expect(page.locator('h1')).toContainText('SongNodes DJ');

    // Wait for graph initialization (critical for visual consistency)
    await graphUtils.waitForGraphInitialization();

    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });

    // Wait for any animations to settle
    await page.waitForTimeout(1000);
  });

  test.describe('Application Layout Screenshots', () => {
    test('should maintain consistent application header layout', async ({ page }) => {
      await test.step('Capture header consistency', async () => {
        // Take full page screenshot focusing on header
        await expect(page.locator('.app-header')).toBeVisible();

        // Take header-specific screenshot
        const header = page.locator('.app-header');
        await expect(header).toHaveScreenshot('app-header-layout.png');
      });
    });

    test('should maintain consistent toolbar layout', async ({ page }) => {
      await test.step('Capture toolbar consistency', async () => {
        const toolbar = page.locator('.toolbar');
        if (await toolbar.isVisible()) {
          await expect(toolbar).toHaveScreenshot('toolbar-layout.png');

          // Test different tool states
          const tools = ['1', '2', '3', '4'];
          for (const tool of tools) {
            await page.keyboard.press(tool);
            await page.waitForTimeout(200);

            await expect(toolbar).toHaveScreenshot(`toolbar-tool-${tool}-active.png`);
          }
        }
      });
    });

    test('should maintain consistent main application layout', async ({ page }) => {
      await test.step('Capture main layout consistency', async () => {
        // Full application layout
        const appContainer = page.locator('.app-container');
        await expect(appContainer).toHaveScreenshot('main-app-layout.png');

        // Main content area
        const mainContent = page.locator('.app-main');
        await expect(mainContent).toHaveScreenshot('main-content-layout.png');
      });
    });

    test('should maintain consistent panel layouts', async ({ page }) => {
      await test.step('Capture panel layouts', async () => {
        // Test different panels
        const panelTests = [
          { key: 'Control+f', name: 'search', panel: '.panel-left' },
          { button: '[title*="Stats"]', name: 'stats', panel: '.panel-right' },
        ];

        for (const panelTest of panelTests) {
          if (panelTest.key) {
            await page.keyboard.press(panelTest.key);
          } else if (panelTest.button) {
            const button = page.locator(panelTest.button);
            if (await button.isVisible()) {
              await button.click();
            }
          }

          await page.waitForTimeout(500);

          const panel = page.locator(panelTest.panel);
          if (await panel.isVisible()) {
            await expect(panel).toHaveScreenshot(`${panelTest.name}-panel.png`);
          }

          // Close panel
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      });
    });
  });

  test.describe('Graph Canvas Visual Tests', () => {
    test('should maintain consistent graph rendering', async ({ page }) => {
      await test.step('Capture baseline graph rendering', async () => {
        // Ensure consistent viewport
        await page.setViewportSize({ width: 1920, height: 1080 });

        // Wait for stable rendering
        await graphUtils.waitForAnimation();

        // Take canvas-only screenshot
        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot('graph-baseline-rendering.png');

        // Verify graph has content
        const metrics = await graphUtils.getPerformanceMetrics();
        expect(metrics.nodeCount).toBeGreaterThan(240);
        expect(metrics.edgeCount).toBeGreaterThan(1549);
      });
    });

    test('should maintain consistent node visualization', async ({ page }) => {
      await test.step('Test node visual consistency', async () => {
        // Zoom in to focus on nodes
        await graphUtils.zoomIn(4);
        await graphUtils.waitForAnimation();

        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot('nodes-zoomed-in.png');

        // Test node selection visual state
        await page.keyboard.press('1'); // Select tool
        await graphUtils.clickOnCanvas(500, 400);
        await page.waitForTimeout(300);

        await expect(canvas).toHaveScreenshot('node-selected-state.png');
      });
    });

    test('should maintain consistent edge visualization', async ({ page }) => {
      await test.step('Test edge visual consistency', async () => {
        // Ensure edges are visible
        const edgeToggle = page.locator('[title*="Edges"]').or(page.locator('text=🔗'));
        if (await edgeToggle.isVisible()) {
          await edgeToggle.click();
          await graphUtils.waitForAnimation();
        }

        // Zoom to see edges clearly
        await graphUtils.zoomIn(3);
        await graphUtils.waitForAnimation();

        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot('edges-visible-zoomed.png');
      });
    });

    test('should maintain consistent label rendering', async ({ page }) => {
      await test.step('Test label visual consistency', async () => {
        // Enable labels
        const labelToggle = page.locator('[title*="Labels"]').or(page.locator('text=🏷️'));
        if (await labelToggle.isVisible()) {
          await labelToggle.click();
          await graphUtils.waitForAnimation();
        }

        // Zoom to see labels clearly
        await graphUtils.zoomIn(5);
        await graphUtils.waitForAnimation();

        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot('labels-visible-zoomed.png');
      });
    });
  });

  test.describe('UI State Visual Tests', () => {
    test('should maintain consistent tool state visuals', async ({ page }) => {
      await test.step('Test tool selection visuals', async () => {
        const tools = [
          { key: '1', name: 'select' },
          { key: '2', name: 'path' },
          { key: '3', name: 'setlist' },
          { key: '4', name: 'filter' },
        ];

        for (const tool of tools) {
          await page.keyboard.press(tool.key);
          await page.waitForTimeout(300);

          // Capture full app state for each tool
          const appContainer = page.locator('.app-container');
          await expect(appContainer).toHaveScreenshot(`tool-${tool.name}-state.png`);

          // Capture just the toolbar for focused comparison
          const toolbar = page.locator('.toolbar');
          if (await toolbar.isVisible()) {
            await expect(toolbar).toHaveScreenshot(`toolbar-${tool.name}-active.png`);
          }
        }
      });
    });

    test('should maintain consistent search state visuals', async ({ page }) => {
      await test.step('Test search state consistency', async () => {
        // Open search
        await page.keyboard.press('Control+f');
        await page.waitForTimeout(500);

        // Capture search panel opened state
        await expect(page).toHaveScreenshot('search-panel-opened.png');

        // Perform search
        const searchInput = page.locator('input[type="text"]').or(page.locator('input[placeholder*="search"]'));
        if (await searchInput.isVisible()) {
          await searchInput.fill('Bangarang');
          await page.waitForTimeout(500);

          // Capture search results state
          await expect(page).toHaveScreenshot('search-results-bangarang.png');

          // Capture graph with highlights
          const canvas = page.locator('canvas');
          await expect(canvas).toHaveScreenshot('graph-search-highlights-bangarang.png');
        }
      });
    });

    test('should maintain consistent performance monitor visuals', async ({ page }) => {
      await test.step('Test performance monitor consistency', async () => {
        // Enable performance monitor
        await graphUtils.enablePerformanceMonitor();

        // Wait for metrics to stabilize
        await graphUtils.waitForAnimation();

        // Capture performance monitor
        const perfMonitor = page.locator('.performance-monitor');
        if (await perfMonitor.isVisible()) {
          await expect(perfMonitor).toHaveScreenshot('performance-monitor.png');
        }

        // Full app with performance monitor
        await expect(page).toHaveScreenshot('app-with-performance-monitor.png');
      });
    });
  });

  test.describe('Responsive Design Visual Tests', () => {
    test('should maintain visual consistency across different screen sizes', async ({ page }) => {
      const screenSizes = [
        { width: 1920, height: 1080, name: 'desktop-large' },
        { width: 1366, height: 768, name: 'desktop-medium' },
        { width: 1280, height: 720, name: 'desktop-small' },
        { width: 768, height: 1024, name: 'tablet-portrait' },
        { width: 1024, height: 768, name: 'tablet-landscape' },
      ];

      for (const size of screenSizes) {
        await test.step(`Test ${size.name} layout`, async () => {
          await page.setViewportSize({ width: size.width, height: size.height });
          await page.waitForTimeout(500);

          // Wait for responsive layout changes
          await graphUtils.waitForAnimation();

          // Capture full layout
          await expect(page).toHaveScreenshot(`responsive-${size.name}.png`);

          // Capture just the canvas to see how graph adapts
          const canvas = page.locator('canvas');
          await expect(canvas).toHaveScreenshot(`graph-${size.name}.png`);
        });
      }
    });

    test('should maintain consistent mobile interface', async ({ page }) => {
      await test.step('Test mobile-specific layouts', async () => {
        // Mobile portrait
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500);

        await graphUtils.waitForAnimation();
        await expect(page).toHaveScreenshot('mobile-portrait.png');

        // Mobile landscape
        await page.setViewportSize({ width: 667, height: 375 });
        await page.waitForTimeout(500);

        await graphUtils.waitForAnimation();
        await expect(page).toHaveScreenshot('mobile-landscape.png');
      });
    });
  });

  test.describe('Theme and Color Consistency', () => {
    test('should maintain consistent color schemes', async ({ page }) => {
      await test.step('Test color scheme consistency', async () => {
        // Test with different graph states that might show different colors
        const colorTests = [
          { action: 'baseline', description: 'Default graph colors' },
          { action: 'search', description: 'Search highlight colors', setup: async () => {
            await page.keyboard.press('Control+f');
            await page.waitForTimeout(300);
            const searchInput = page.locator('input[type="text"]').first();
            if (await searchInput.isVisible()) {
              await searchInput.fill('Energy');
              await page.waitForTimeout(500);
            }
          }},
          { action: 'selection', description: 'Node selection colors', setup: async () => {
            await page.keyboard.press('1');
            await graphUtils.clickOnCanvas(500, 400);
            await page.waitForTimeout(300);
          }},
          { action: 'path', description: 'Path building colors', setup: async () => {
            await page.keyboard.press('2');
            await graphUtils.clickOnCanvas(400, 400);
            await page.waitForTimeout(300);
            await graphUtils.clickOnCanvas(600, 600);
            await page.waitForTimeout(300);
          }},
        ];

        for (const colorTest of colorTests) {
          if (colorTest.setup) {
            await colorTest.setup();
          }

          await graphUtils.waitForAnimation();

          // Capture color state
          const canvas = page.locator('canvas');
          await expect(canvas).toHaveScreenshot(`colors-${colorTest.action}.png`);

          // Reset for next test
          await page.reload();
          await graphUtils.waitForGraphInitialization();
          await page.waitForTimeout(1000);
        }
      });
    });

    test('should maintain consistent UI theme elements', async ({ page }) => {
      await test.step('Test UI theme consistency', async () => {
        // Capture different UI elements for theme consistency
        const uiElements = [
          { selector: '.app-header', name: 'header-theme' },
          { selector: '.toolbar', name: 'toolbar-theme' },
          { selector: 'button', name: 'buttons-theme' },
        ];

        for (const element of uiElements) {
          const locator = page.locator(element.selector);
          if (await locator.isVisible()) {
            await expect(locator.first()).toHaveScreenshot(`${element.name}.png`);
          }
        }
      });
    });
  });

  test.describe('Error State Visual Tests', () => {
    test('should maintain consistent error state visuals', async ({ page }) => {
      await test.step('Test error state appearance', async () => {
        // Simulate API error
        await page.route('**/graph/data', route => {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Simulated API error' })
          });
        });

        await page.reload();
        await page.waitForTimeout(2000);

        // Capture error state
        await expect(page).toHaveScreenshot('error-state.png');
      });
    });

    test('should maintain consistent loading state visuals', async ({ page }) => {
      await test.step('Test loading state appearance', async () => {
        // Simulate slow loading
        await page.route('**/graph/data', route => {
          setTimeout(() => {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ nodes: [], edges: [] })
          });
          }, 2000);
        });

        await page.reload();

        // Capture loading state quickly
        await page.waitForTimeout(500);
        await expect(page).toHaveScreenshot('loading-state.png');
      });
    });
  });

  test.describe('Animation and Transition Visual Tests', () => {
    test('should capture key animation frames', async ({ page }) => {
      await test.step('Test animation consistency', async () => {
        // Re-enable animations for this test
        await page.addStyleTag({
          content: `
            * {
              animation-duration: 0.3s !important;
              transition-duration: 0.3s !important;
            }
          `
        });

        // Test zoom animation frames
        await graphUtils.zoomIn(1);
        await page.waitForTimeout(100); // Mid-animation

        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot('zoom-animation-frame.png');

        // Wait for animation complete
        await graphUtils.waitForAnimation();
        await expect(canvas).toHaveScreenshot('zoom-animation-complete.png');
      });
    });

    test('should maintain consistent hover states', async ({ page }) => {
      await test.step('Test hover state visuals', async () => {
        // Hover over different UI elements
        const hoverElements = [
          { selector: 'button', name: 'button-hover' },
          { selector: '.toolbar button', name: 'toolbar-button-hover' },
        ];

        for (const element of hoverElements) {
          const locator = page.locator(element.selector).first();
          if (await locator.isVisible()) {
            await locator.hover();
            await page.waitForTimeout(200);

            await expect(locator).toHaveScreenshot(`${element.name}.png`);
          }
        }
      });
    });
  });

  test.describe('Cross-Browser Visual Consistency', () => {
    test('should maintain visual consistency in different browsers', async ({ page, browserName }) => {
      await test.step(`Test ${browserName} specific rendering`, async () => {
        // Capture browser-specific baseline
        await expect(page).toHaveScreenshot(`${browserName}-baseline.png`);

        // Capture canvas rendering in this browser
        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot(`${browserName}-graph-rendering.png`);

        // Test WebGL-specific rendering
        const webglInfo = await graphUtils.getWebGLInfo();
        console.log(`${browserName} WebGL info:`, webglInfo);

        // Capture zoomed view for detail comparison
        await graphUtils.zoomIn(3);
        await graphUtils.waitForAnimation();
        await expect(canvas).toHaveScreenshot(`${browserName}-graph-zoomed.png`);
      });
    });
  });

  test.describe('Visual Regression Baseline Management', () => {
    test('should generate comprehensive visual baselines', async ({ page }) => {
      await test.step('Generate master baseline screenshots', async () => {
        // This test generates the authoritative baseline screenshots
        // Run with --update-snapshots to refresh baselines

        // Complete application state
        await expect(page).toHaveScreenshot('master-baseline-full-app.png');

        // Graph-only baseline
        const canvas = page.locator('canvas');
        await expect(canvas).toHaveScreenshot('master-baseline-graph-only.png');

        // Different zoom levels for baseline
        const zoomLevels = [1, 3, 5];
        for (const zoom of zoomLevels) {
          await graphUtils.resetView();
          await graphUtils.zoomIn(zoom);
          await graphUtils.waitForAnimation();

          await expect(canvas).toHaveScreenshot(`master-baseline-zoom-${zoom}x.png`);
        }

        // Different tool states for baseline
        const tools = ['1', '2', '3', '4'];
        for (const tool of tools) {
          await page.keyboard.press(tool);
          await page.waitForTimeout(300);

          await expect(page).toHaveScreenshot(`master-baseline-tool-${tool}.png`);
        }

        console.log('Visual regression baselines generated successfully');
      });
    });
  });
});