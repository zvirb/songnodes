import { test, expect } from '@playwright/test';

/**
 * Interactive Components Tests
 * Testing ContextMenu.tsx, RadialMenu.tsx, SmartTooltip.tsx, InfoCard.tsx
 */
test.describe('Interactive Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Context Menus', () => {
    test('should show right-click context menu on nodes', async ({ page }) => {
      // Wait for graph nodes to load
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });

      const firstNode = page.locator('[data-testid="graph-node"]').first();

      // Right-click to open context menu
      await firstNode.click({ button: 'right' });
      await page.waitForTimeout(500);

      const contextMenu = page.locator('[data-testid="context-menu"]');
      if (await contextMenu.isVisible()) {
        await expect(contextMenu).toHaveScreenshot('node-context-menu.png');

        // Test menu item clicks
        const menuItems = contextMenu.locator('[data-testid^="context-menu-item-"]');
        const itemCount = await menuItems.count();

        if (itemCount > 0) {
          // Click first menu item
          await menuItems.first().click();
          await page.waitForTimeout(500);
          await expect(page).toHaveScreenshot('context-menu-action-executed.png');
        }
      }
    });

    test('should show context menu on edges', async ({ page }) => {
      // Wait for graph edges to be rendered
      await page.waitForSelector('[data-testid="graph-edge"]', { timeout: 10000 });

      const firstEdge = page.locator('[data-testid="graph-edge"]').first();
      if (await firstEdge.isVisible()) {
        await firstEdge.click({ button: 'right' });
        await page.waitForTimeout(500);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        if (await contextMenu.isVisible()) {
          await expect(contextMenu).toHaveScreenshot('edge-context-menu.png');
        }
      }
    });

    test('should show different context menu for empty space', async ({ page }) => {
      // Right-click on empty graph area
      const graphContainer = page.locator('[data-testid="graph-container"]');
      await graphContainer.click({ button: 'right', position: { x: 100, y: 100 } });
      await page.waitForTimeout(500);

      const contextMenu = page.locator('[data-testid="context-menu"]');
      if (await contextMenu.isVisible()) {
        await expect(contextMenu).toHaveScreenshot('empty-space-context-menu.png');
      }
    });

    test('should close context menu with escape key', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      if (await firstNode.isVisible()) {
        await firstNode.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        if (await contextMenu.isVisible()) {
          // Press escape to close
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          await expect(contextMenu).not.toBeVisible();
        }
      }
    });

    test('should navigate context menu with keyboard', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      if (await firstNode.isVisible()) {
        await firstNode.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        if (await contextMenu.isVisible()) {
          // Use arrow keys to navigate
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
          await expect(contextMenu).toHaveScreenshot('context-menu-keyboard-nav.png');

          // Enter to select
          await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('Radial Menus', () => {
    test('should show radial menu on touch/long press', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      if (await firstNode.isVisible()) {
        // Simulate long press (mouse down, wait, mouse up)
        await firstNode.hover();
        await page.mouse.down();
        await page.waitForTimeout(800); // Long press duration
        await page.mouse.up();

        const radialMenu = page.locator('[data-testid="radial-menu"]');
        if (await radialMenu.isVisible()) {
          await expect(radialMenu).toHaveScreenshot('radial-menu-open.png');

          // Test radial selection by moving mouse
          const menuCenter = radialMenu.locator('[data-testid="radial-menu-center"]');
          if (await menuCenter.isVisible()) {
            // Move to different angles to test selection
            const box = await radialMenu.boundingBox();
            if (box) {
              // Move to top-right quadrant
              await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
              await page.waitForTimeout(200);
              await expect(radialMenu).toHaveScreenshot('radial-menu-top-right-selection.png');
            }
          }
        }
      }
    });

    test('should execute radial menu actions', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      if (await firstNode.isVisible()) {
        await firstNode.hover();
        await page.mouse.down();
        await page.waitForTimeout(800);

        const radialMenu = page.locator('[data-testid="radial-menu"]');
        if (await radialMenu.isVisible()) {
          // Click on a radial menu item
          const radialItem = radialMenu.locator('[data-testid="radial-item"]').first();
          if (await radialItem.isVisible()) {
            await radialItem.click();
            await page.waitForTimeout(500);
            await expect(page).toHaveScreenshot('radial-menu-action-executed.png');
          }
        }

        await page.mouse.up();
      }
    });
  });

  test.describe('Smart Tooltips', () => {
    test('should show tooltips on hover', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      if (await firstNode.isVisible()) {
        await firstNode.hover();
        await page.waitForTimeout(300);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        if (await tooltip.isVisible()) {
          await expect(tooltip).toHaveScreenshot('node-tooltip.png');
        }
      }
    });

    test('should position tooltips intelligently', async ({ page }) => {
      // Test tooltips near screen edges
      const nodes = page.locator('[data-testid="graph-node"]');
      const nodeCount = await nodes.count();

      for (let i = 0; i < Math.min(3, nodeCount); i++) {
        const node = nodes.nth(i);
        await node.hover();
        await page.waitForTimeout(300);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        if (await tooltip.isVisible()) {
          await expect(tooltip).toHaveScreenshot(`tooltip-positioning-${i}.png`);
        }

        // Move away to hide tooltip
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
      }
    });

    test('should show rich content in tooltips', async ({ page }) => {
      const trackNode = page.locator('[data-testid="track-node"]').first();
      if (await trackNode.isVisible()) {
        await trackNode.hover();
        await page.waitForTimeout(500);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        if (await tooltip.isVisible()) {
          // Check for rich content elements
          const waveform = tooltip.locator('[data-testid="tooltip-waveform"]');
          const trackInfo = tooltip.locator('[data-testid="tooltip-track-info"]');
          const actions = tooltip.locator('[data-testid="tooltip-actions"]');

          if (await waveform.isVisible()) {
            await expect(tooltip).toHaveScreenshot('rich-tooltip-with-waveform.png');
          }
        }
      }
    });

    test('should support interactive tooltips', async ({ page }) => {
      const node = page.locator('[data-testid="graph-node"]').first();
      if (await node.isVisible()) {
        await node.hover();
        await page.waitForTimeout(300);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        if (await tooltip.isVisible()) {
          const actionButton = tooltip.locator('[data-testid="tooltip-action-button"]');
          if (await actionButton.isVisible()) {
            await actionButton.click();
            await page.waitForTimeout(500);
            await expect(page).toHaveScreenshot('interactive-tooltip-action.png');
          }
        }
      }
    });
  });

  test.describe('Info Cards', () => {
    test('should display track info cards', async ({ page }) => {
      const trackNode = page.locator('[data-testid="track-node"]').first();
      if (await trackNode.isVisible()) {
        await trackNode.click();
        await page.waitForTimeout(500);

        const infoCard = page.locator('[data-testid="info-card"]');
        if (await infoCard.isVisible()) {
          await expect(infoCard).toHaveScreenshot('track-info-card.png');

          // Test copy functionality
          const copyButton = infoCard.locator('[data-testid="copy-info-button"]');
          if (await copyButton.isVisible()) {
            await copyButton.click();
            await page.waitForTimeout(300);
            await expect(infoCard).toHaveScreenshot('track-info-copied.png');
          }
        }
      }
    });

    test('should display node info cards', async ({ page }) => {
      const graphNode = page.locator('[data-testid="graph-node"]').first();
      if (await graphNode.isVisible()) {
        await graphNode.click();
        await page.waitForTimeout(500);

        const infoCard = page.locator('[data-testid="info-card-node"]');
        if (await infoCard.isVisible()) {
          await expect(infoCard).toHaveScreenshot('node-info-card.png');
        }
      }
    });

    test('should display performance info cards', async ({ page }) => {
      // Trigger performance info (might be from a monitoring button)
      const perfButton = page.locator('[data-testid="performance-info-button"]');
      if (await perfButton.isVisible()) {
        await perfButton.click();
        await page.waitForTimeout(500);

        const performanceCard = page.locator('[data-testid="info-card-performance"]');
        if (await performanceCard.isVisible()) {
          await expect(performanceCard).toHaveScreenshot('performance-info-card.png');
        }
      }
    });

    test('should display setlist info cards', async ({ page }) => {
      const setlistItem = page.locator('[data-testid="setlist-item"]').first();
      if (await setlistItem.isVisible()) {
        await setlistItem.click();
        await page.waitForTimeout(500);

        const setlistCard = page.locator('[data-testid="info-card-setlist"]');
        if (await setlistCard.isVisible()) {
          await expect(setlistCard).toHaveScreenshot('setlist-info-card.png');
        }
      }
    });

    test('should close info cards properly', async ({ page }) => {
      const trackNode = page.locator('[data-testid="track-node"]').first();
      if (await trackNode.isVisible()) {
        await trackNode.click();
        await page.waitForTimeout(500);

        const infoCard = page.locator('[data-testid="info-card"]');
        if (await infoCard.isVisible()) {
          // Test close button
          const closeButton = infoCard.locator('[data-testid="info-card-close"]');
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await page.waitForTimeout(300);
            await expect(infoCard).not.toBeVisible();
          }
        }
      }
    });
  });

  test.describe('General Interactions', () => {
    test('should handle overlapping interactive elements', async ({ page }) => {
      // Test when multiple interactive elements are present
      const node = page.locator('[data-testid="graph-node"]').first();
      if (await node.isVisible()) {
        // Show tooltip first
        await node.hover();
        await page.waitForTimeout(300);

        // Right-click to show context menu
        await node.click({ button: 'right' });
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot('overlapping-interactive-elements.png');
      }
    });

    test('should respect z-index ordering', async ({ page }) => {
      // Create multiple overlays and verify proper stacking
      const node = page.locator('[data-testid="graph-node"]').first();
      if (await node.isVisible()) {
        // Open context menu
        await node.click({ button: 'right' });
        await page.waitForTimeout(300);

        // Try to trigger another overlay
        const settingsButton = page.locator('[data-testid="settings-toggle"]');
        if (await settingsButton.isVisible()) {
          await settingsButton.click();
          await page.waitForTimeout(300);
          await expect(page).toHaveScreenshot('z-index-ordering.png');
        }
      }
    });

    test('should be accessible with screen readers', async ({ page }) => {
      // Test ARIA attributes and labels
      const contextMenuTrigger = page.locator('[data-testid="graph-node"]').first();
      if (await contextMenuTrigger.isVisible()) {
        const ariaLabel = await contextMenuTrigger.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();

        await contextMenuTrigger.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        if (await contextMenu.isVisible()) {
          const menuRole = await contextMenu.getAttribute('role');
          expect(menuRole).toBe('menu');

          const menuItems = contextMenu.locator('[role="menuitem"]');
          const itemCount = await menuItems.count();
          expect(itemCount).toBeGreaterThan(0);
        }
      }
    });
  });
});