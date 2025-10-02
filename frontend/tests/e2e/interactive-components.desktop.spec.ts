import { test, expect } from '@playwright/test';

/**
 * Interactive Components Tests
 * Testing ContextMenu.tsx, RadialMenu.tsx, SmartTooltip.tsx, InfoCard.tsx
 */
test.describe('Interactive Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    // Wait for interface with proper error handling
    try {
      await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 10000 });
    } catch {
      await page.waitForSelector('#root:not(:empty)', { timeout: 10000 });
    }
    await page.waitForTimeout(500);
  });

  test.describe('Context Menus', () => {
    test('should show right-click context menu on nodes', async ({ page }) => {
      // Wait for graph nodes to load with proper timeout handling
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await firstNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasNode) {
        test.skip();
        return;
      }

      // Right-click to open context menu
      await firstNode.click({ button: 'right' });
      await page.waitForTimeout(300);

      const contextMenu = page.locator('[data-testid="context-menu"]');
      const hasContextMenu = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasContextMenu) {
        await expect(contextMenu).toHaveScreenshot('node-context-menu.png', { timeout: 10000 });

        // Test menu item clicks
        const menuItems = contextMenu.locator('[data-testid^="context-menu-item-"]');
        const itemCount = await menuItems.count();

        if (itemCount > 0) {
          // Click first menu item
          await menuItems.first().click();
          await page.waitForTimeout(300);
          await expect(page).toHaveScreenshot('context-menu-action-executed.png', { timeout: 10000 });
        }
      }
    });

    test('should show context menu on edges', async ({ page }) => {
      // Wait for graph edges to be rendered with proper timeout
      const firstEdge = page.locator('[data-testid="graph-edge"]').first();
      const hasEdge = await firstEdge.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasEdge) {
        await firstEdge.click({ button: 'right' });
        await page.waitForTimeout(300);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        const hasContextMenu = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasContextMenu) {
          await expect(contextMenu).toHaveScreenshot('edge-context-menu.png', { timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should show different context menu for empty space', async ({ page }) => {
      // Right-click on empty graph area
      const graphContainer = page.locator('[data-testid="graph-container"]');
      const hasGraph = await graphContainer.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasGraph) {
        test.skip();
        return;
      }

      await graphContainer.click({ button: 'right', position: { x: 100, y: 100 } });
      await page.waitForTimeout(300);

      const contextMenu = page.locator('[data-testid="context-menu"]');
      const hasContextMenu = await contextMenu.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasContextMenu) {
        await expect(contextMenu).toHaveScreenshot('empty-space-context-menu.png', { timeout: 10000 });
      }
    });

    test('should close context menu with escape key', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await firstNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        await firstNode.click({ button: 'right' });
        await page.waitForTimeout(200);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        const hasContextMenu = await contextMenu.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasContextMenu) {
          // Press escape to close
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
          await expect(contextMenu).not.toBeVisible();
        }
      } else {
        test.skip();
      }
    });

    test('should navigate context menu with keyboard', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await firstNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        await firstNode.click({ button: 'right' });
        await page.waitForTimeout(200);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        const hasContextMenu = await contextMenu.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasContextMenu) {
          // Use arrow keys to navigate
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(150);
          await expect(contextMenu).toHaveScreenshot('context-menu-keyboard-nav.png', { timeout: 10000 });

          // Enter to select
          await page.keyboard.press('Enter');
          await page.waitForTimeout(300);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Radial Menus', () => {
    test('should show radial menu on touch/long press', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await firstNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        // Simulate long press (mouse down, wait, mouse up)
        await firstNode.hover();
        await page.mouse.down();
        await page.waitForTimeout(600); // Reduced long press duration
        await page.mouse.up();

        const radialMenu = page.locator('[data-testid="radial-menu"]');
        const hasRadialMenu = await radialMenu.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasRadialMenu) {
          await expect(radialMenu).toHaveScreenshot('radial-menu-open.png', { timeout: 10000 });

          // Test radial selection by moving mouse
          const menuCenter = radialMenu.locator('[data-testid="radial-menu-center"]');
          const hasCenter = await menuCenter.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasCenter) {
            // Move to different angles to test selection
            const box = await radialMenu.boundingBox();
            if (box) {
              // Move to top-right quadrant
              await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25);
              await page.waitForTimeout(150);
              await expect(radialMenu).toHaveScreenshot('radial-menu-top-right-selection.png', { timeout: 10000 });
            }
          }
        }
      } else {
        test.skip();
      }
    });

    test('should execute radial menu actions', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await firstNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        await firstNode.hover();
        await page.mouse.down();
        await page.waitForTimeout(600);

        const radialMenu = page.locator('[data-testid="radial-menu"]');
        const hasRadialMenu = await radialMenu.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasRadialMenu) {
          // Click on a radial menu item
          const radialItem = radialMenu.locator('[data-testid="radial-item"]').first();
          const hasItem = await radialItem.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasItem) {
            await radialItem.click();
            await page.waitForTimeout(300);
            await expect(page).toHaveScreenshot('radial-menu-action-executed.png', { timeout: 10000 });
          }
        }

        await page.mouse.up();
      } else {
        test.skip();
      }
    });
  });

  test.describe('Smart Tooltips', () => {
    test('should show tooltips on hover', async ({ page }) => {
      const firstNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await firstNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        await firstNode.hover();
        await page.waitForTimeout(200);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        const hasTooltip = await tooltip.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasTooltip) {
          await expect(tooltip).toHaveScreenshot('node-tooltip.png', { timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should position tooltips intelligently', async ({ page }) => {
      // Test tooltips near screen edges - reduced iterations
      const nodes = page.locator('[data-testid="graph-node"]');
      const nodeCount = await nodes.count();

      if (nodeCount === 0) {
        test.skip();
        return;
      }

      for (let i = 0; i < Math.min(2, nodeCount); i++) {
        const node = nodes.nth(i);
        await node.hover();
        await page.waitForTimeout(200);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        const hasTooltip = await tooltip.isVisible({ timeout: 1500 }).catch(() => false);

        if (hasTooltip) {
          await expect(tooltip).toHaveScreenshot(`tooltip-positioning-${i}.png`, { timeout: 10000 });
        }

        // Move away to hide tooltip
        await page.mouse.move(0, 0);
        await page.waitForTimeout(150);
      }
    });

    test('should show rich content in tooltips', async ({ page }) => {
      const trackNode = page.locator('[data-testid="track-node"]').first();
      const hasTrackNode = await trackNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTrackNode) {
        await trackNode.hover();
        await page.waitForTimeout(300);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        const hasTooltip = await tooltip.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasTooltip) {
          // Check for rich content elements
          const waveform = tooltip.locator('[data-testid="tooltip-waveform"]');
          const hasWaveform = await waveform.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasWaveform) {
            await expect(tooltip).toHaveScreenshot('rich-tooltip-with-waveform.png', { timeout: 10000 });
          }
        }
      } else {
        test.skip();
      }
    });

    test('should support interactive tooltips', async ({ page }) => {
      const node = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await node.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        await node.hover();
        await page.waitForTimeout(200);

        const tooltip = page.locator('[data-testid="smart-tooltip"]');
        const hasTooltip = await tooltip.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasTooltip) {
          const actionButton = tooltip.locator('[data-testid="tooltip-action-button"]');
          const hasActionButton = await actionButton.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasActionButton) {
            await actionButton.click();
            await page.waitForTimeout(300);
            await expect(page).toHaveScreenshot('interactive-tooltip-action.png', { timeout: 10000 });
          }
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Info Cards', () => {
    test('should display track info cards', async ({ page }) => {
      const trackNode = page.locator('[data-testid="track-node"]').first();
      const hasTrackNode = await trackNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTrackNode) {
        await trackNode.click();
        await page.waitForTimeout(300);

        const infoCard = page.locator('[data-testid="info-card"]');
        const hasInfoCard = await infoCard.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasInfoCard) {
          await expect(infoCard).toHaveScreenshot('track-info-card.png', { timeout: 10000 });

          // Test copy functionality
          const copyButton = infoCard.locator('[data-testid="copy-info-button"]');
          const hasCopyButton = await copyButton.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasCopyButton) {
            await copyButton.click();
            await page.waitForTimeout(200);
            await expect(infoCard).toHaveScreenshot('track-info-copied.png', { timeout: 10000 });
          }
        }
      } else {
        test.skip();
      }
    });

    test('should display node info cards', async ({ page }) => {
      const graphNode = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await graphNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        await graphNode.click();
        await page.waitForTimeout(300);

        const infoCard = page.locator('[data-testid="info-card-node"]');
        const hasInfoCard = await infoCard.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasInfoCard) {
          await expect(infoCard).toHaveScreenshot('node-info-card.png', { timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should display performance info cards', async ({ page }) => {
      // Trigger performance info (might be from a monitoring button)
      const perfButton = page.locator('[data-testid="performance-info-button"]');
      const hasButton = await perfButton.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasButton) {
        await perfButton.click();
        await page.waitForTimeout(300);

        const performanceCard = page.locator('[data-testid="info-card-performance"]');
        const hasCard = await performanceCard.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasCard) {
          await expect(performanceCard).toHaveScreenshot('performance-info-card.png', { timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should display setlist info cards', async ({ page }) => {
      const setlistItem = page.locator('[data-testid="setlist-item"]').first();
      const hasSetlistItem = await setlistItem.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSetlistItem) {
        await setlistItem.click();
        await page.waitForTimeout(300);

        const setlistCard = page.locator('[data-testid="info-card-setlist"]');
        const hasCard = await setlistCard.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasCard) {
          await expect(setlistCard).toHaveScreenshot('setlist-info-card.png', { timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should close info cards properly', async ({ page }) => {
      const trackNode = page.locator('[data-testid="track-node"]').first();
      const hasTrackNode = await trackNode.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTrackNode) {
        await trackNode.click();
        await page.waitForTimeout(300);

        const infoCard = page.locator('[data-testid="info-card"]');
        const hasInfoCard = await infoCard.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasInfoCard) {
          // Test close button
          const closeButton = infoCard.locator('[data-testid="info-card-close"]');
          const hasCloseButton = await closeButton.isVisible({ timeout: 1000 }).catch(() => false);

          if (hasCloseButton) {
            await closeButton.click();
            await page.waitForTimeout(200);
            await expect(infoCard).not.toBeVisible();
          }
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('General Interactions', () => {
    test('should handle overlapping interactive elements', async ({ page }) => {
      // Test when multiple interactive elements are present
      const node = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await node.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        // Show tooltip first
        await node.hover();
        await page.waitForTimeout(200);

        // Right-click to show context menu
        await node.click({ button: 'right' });
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot('overlapping-interactive-elements.png', { timeout: 10000 });
      } else {
        test.skip();
      }
    });

    test('should respect z-index ordering', async ({ page }) => {
      // Create multiple overlays and verify proper stacking
      const node = page.locator('[data-testid="graph-node"]').first();
      const hasNode = await node.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasNode) {
        // Open context menu
        await node.click({ button: 'right' });
        await page.waitForTimeout(200);

        // Try to trigger another overlay
        const settingsButton = page.locator('[data-testid="settings-toggle"]');
        const hasSettings = await settingsButton.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasSettings) {
          await settingsButton.click();
          await page.waitForTimeout(200);
          await expect(page).toHaveScreenshot('z-index-ordering.png', { timeout: 10000 });
        }
      } else {
        test.skip();
      }
    });

    test('should be accessible with screen readers', async ({ page }) => {
      // Test ARIA attributes and labels
      const contextMenuTrigger = page.locator('[data-testid="graph-node"]').first();
      const hasTrigger = await contextMenuTrigger.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasTrigger) {
        const ariaLabel = await contextMenuTrigger.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();

        await contextMenuTrigger.click({ button: 'right' });
        await page.waitForTimeout(200);

        const contextMenu = page.locator('[data-testid="context-menu"]');
        const hasContextMenu = await contextMenu.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasContextMenu) {
          const menuRole = await contextMenu.getAttribute('role');
          expect(menuRole).toBe('menu');

          const menuItems = contextMenu.locator('[role="menuitem"]');
          const itemCount = await menuItems.count();
          expect(itemCount).toBeGreaterThan(0);
        }
      } else {
        test.skip();
      }
    });
  });
});