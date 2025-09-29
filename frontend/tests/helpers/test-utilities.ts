import { Page, Locator, expect } from '@playwright/test';

/**
 * Test Utilities for SongNodes UI Testing
 * Common helper functions for consistent testing across all specs
 */

export class TestUtilities {
  constructor(private page: Page) {}

  /**
   * Wait for application to fully load with all initial data
   */
  async waitForAppReady(): Promise<void> {
    await this.page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });

    // Wait for graph to initialize (if data is available)
    const graphContainer = this.page.locator('[data-testid="graph-container"]');
    if (await graphContainer.isVisible()) {
      // Wait for PIXI.js initialization
      await this.page.waitForTimeout(2000);

      // Check if nodes are rendered
      try {
        await this.page.waitForSelector('[data-testid="graph-node"]', { timeout: 5000 });
      } catch {
        console.log('No graph nodes found - continuing with empty state');
      }
    }

    // Additional wait for animations to settle
    await this.page.waitForTimeout(1000);
  }

  /**
   * Navigate to a specific right panel tab
   */
  async navigateToRightPanelTab(tab: 'analysis' | 'keymood' | 'tidal'): Promise<void> {
    const tabButton = this.page.locator(`[data-testid="right-panel-tab-${tab}"]`);
    if (await tabButton.isVisible()) {
      await tabButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Open settings panel
   */
  async openSettingsPanel(): Promise<boolean> {
    const settingsToggle = this.page.locator('[data-testid="settings-toggle"]');
    if (await settingsToggle.isVisible()) {
      await settingsToggle.click();
      await this.page.waitForTimeout(500);
      return true;
    }
    return false;
  }

  /**
   * Close any open modals or overlays
   */
  async closeAllModals(): Promise<void> {
    // Try Escape key first
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // Check for specific close buttons
    const closeButtons = this.page.locator('[data-testid*="close"], [data-testid*="modal-close"]');
    const count = await closeButtons.count();

    for (let i = 0; i < count; i++) {
      const button = closeButtons.nth(i);
      if (await button.isVisible()) {
        await button.click();
        await this.page.waitForTimeout(200);
      }
    }
  }

  /**
   * Wait for graph to finish loading/rendering
   */
  async waitForGraphReady(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="graph-container"]', { timeout: 5000 });

      // Wait for graph rendering to complete
      await this.page.waitForTimeout(2000);

      // Check if loading indicator disappears
      const loadingIndicator = this.page.locator('[data-testid="graph-loading"]');
      if (await loadingIndicator.isVisible()) {
        await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the first available graph node
   */
  async getFirstGraphNode(): Promise<Locator | null> {
    const nodes = this.page.locator('[data-testid="graph-node"]');
    const count = await nodes.count();

    if (count > 0) {
      return nodes.first();
    }

    return null;
  }

  /**
   * Trigger right-click context menu on element
   */
  async triggerContextMenu(element: Locator): Promise<boolean> {
    if (await element.isVisible()) {
      await element.click({ button: 'right' });
      await this.page.waitForTimeout(300);

      const contextMenu = this.page.locator('[data-testid="context-menu"]');
      return await contextMenu.isVisible();
    }

    return false;
  }

  /**
   * Check if element has proper ARIA attributes
   */
  async verifyAccessibilityAttributes(element: Locator): Promise<{
    hasLabel: boolean;
    hasRole: boolean;
    hasDescription: boolean;
  }> {
    const ariaLabel = await element.getAttribute('aria-label');
    const ariaLabelledby = await element.getAttribute('aria-labelledby');
    const ariaDescribedby = await element.getAttribute('aria-describedby');
    const role = await element.getAttribute('role');
    const textContent = await element.textContent();

    return {
      hasLabel: !!(ariaLabel || ariaLabelledby || textContent),
      hasRole: !!role,
      hasDescription: !!ariaDescribedby
    };
  }

  /**
   * Simulate keyboard navigation through elements
   */
  async navigateWithKeyboard(steps: number = 5): Promise<string[]> {
    const focusedElements: string[] = [];

    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press('Tab');
      await this.page.waitForTimeout(200);

      const focusedElement = await this.page.evaluate(() => {
        const el = document.activeElement;
        return el ? `${el.tagName}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').join('.') : ''}` : 'none';
      });

      focusedElements.push(focusedElement);
    }

    return focusedElements;
  }

  /**
   * Test element for proper focus indicators
   */
  async verifyFocusIndicator(element: Locator): Promise<boolean> {
    await element.focus();
    await this.page.waitForTimeout(100);

    // Check if element has focus styles
    const focusStyles = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el, ':focus');
      return {
        outline: styles.outline,
        boxShadow: styles.boxShadow,
        borderColor: styles.borderColor
      };
    });

    // Element should have some form of focus indicator
    return !!(focusStyles.outline !== 'none' ||
             focusStyles.boxShadow !== 'none' ||
             focusStyles.borderColor !== '');
  }

  /**
   * Mock network conditions for error testing
   */
  async mockNetworkError(url: string = '**/api/**'): Promise<void> {
    await this.page.route(url, route => {
      route.abort('failed');
    });
  }

  /**
   * Mock API response with specific data
   */
  async mockApiResponse(url: string, response: any, status: number = 200): Promise<void> {
    await this.page.route(url, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Take screenshot with consistent naming
   */
  async takeNamedScreenshot(name: string, element?: Locator): Promise<void> {
    if (element) {
      await expect(element).toHaveScreenshot(`${name}.png`);
    } else {
      await expect(this.page).toHaveScreenshot(`${name}.png`);
    }
  }

  /**
   * Wait for animations to complete
   */
  async waitForAnimations(): Promise<void> {
    // Wait for CSS transitions and animations
    await this.page.waitForTimeout(500);

    // Wait for JavaScript animations (D3, PIXI.js, etc.)
    await this.page.evaluate(async () => {
      return new Promise<void>((resolve) => {
        // Wait for next animation frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
    });
  }

  /**
   * Check if WebGL is available and working
   */
  async verifyWebGLSupport(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    });
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    fps: number;
    memoryUsage: number;
    nodeCount: number;
    edgeCount: number;
  }> {
    const nodeCount = await this.page.locator('[data-testid="graph-node"]').count();
    const edgeCount = await this.page.locator('[data-testid="graph-edge"]').count();

    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memInfo = (performance as any).memory;

      return {
        fps: 0, // Would need more complex FPS calculation
        memoryUsage: memInfo ? memInfo.usedJSHeapSize : 0,
        loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0
      };
    });

    return {
      ...metrics,
      nodeCount,
      edgeCount
    };
  }

  /**
   * Verify responsive behavior at breakpoint
   */
  async testResponsiveBreakpoint(width: number, height: number): Promise<{
    isResponsive: boolean;
    hasHorizontalScroll: boolean;
    hasVerticalScroll: boolean;
  }> {
    await this.page.setViewportSize({ width, height });
    await this.page.waitForTimeout(500);

    const scrollInfo = await this.page.evaluate(() => {
      return {
        hasHorizontalScroll: document.body.scrollWidth > window.innerWidth,
        hasVerticalScroll: document.body.scrollHeight > window.innerHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    });

    return {
      isResponsive: scrollInfo.viewportWidth === width && scrollInfo.viewportHeight === height,
      hasHorizontalScroll: scrollInfo.hasHorizontalScroll,
      hasVerticalScroll: scrollInfo.hasVerticalScroll
    };
  }
}

/**
 * Common test data for consistent testing
 */
export const TestData = {
  sampleTrack: {
    id: 'test-track-1',
    name: 'Test Track',
    artist: 'Test Artist',
    bpm: 128,
    key: '1A',
    energy: 0.75
  },

  sampleNode: {
    id: 'test-node-1',
    label: 'Test Node',
    x: 100,
    y: 100,
    type: 'track'
  },

  testViewports: [
    { width: 320, height: 568, name: 'mobile-small' },
    { width: 375, height: 667, name: 'mobile-medium' },
    { width: 414, height: 896, name: 'mobile-large' },
    { width: 768, height: 1024, name: 'tablet-portrait' },
    { width: 1024, height: 768, name: 'tablet-landscape' },
    { width: 1280, height: 720, name: 'desktop-small' },
    { width: 1920, height: 1080, name: 'desktop-large' }
  ],

  keySignatures: ['1A', '2A', '3A', '4A', '5A', '6A', '7A', '8A', '9A', '10A', '11A', '12A',
                  '1B', '2B', '3B', '4B', '5B', '6B', '7B', '8B', '9B', '10B', '11B', '12B'],

  energyLevels: ['low', 'medium-low', 'medium', 'medium-high', 'high'],

  genres: ['house', 'techno', 'trance', 'dubstep', 'drum-and-bass', 'ambient', 'progressive']
};

/**
 * Assertion helpers for common test scenarios
 */
export class TestAssertions {
  constructor(private page: Page) {}

  /**
   * Assert that element is accessible
   */
  async assertAccessible(element: Locator): Promise<void> {
    const utils = new TestUtilities(this.page);
    const attrs = await utils.verifyAccessibilityAttributes(element);

    expect(attrs.hasLabel).toBeTruthy();

    const hasFocusIndicator = await utils.verifyFocusIndicator(element);
    expect(hasFocusIndicator).toBeTruthy();
  }

  /**
   * Assert that error is displayed properly
   */
  async assertErrorDisplayed(errorType: 'network' | 'validation' | 'general'): Promise<void> {
    const errorSelectors = {
      network: '[data-testid="network-error"]',
      validation: '[data-testid="validation-error"]',
      general: '[data-testid="error-message"]'
    };

    const errorElement = this.page.locator(errorSelectors[errorType]);
    await expect(errorElement).toBeVisible();

    const errorText = await errorElement.textContent();
    expect(errorText).toBeTruthy();
    expect(errorText!.length).toBeGreaterThan(0);
  }

  /**
   * Assert that component loads within reasonable time
   */
  async assertLoadTime(selector: string, maxTime: number = 5000): Promise<void> {
    const start = Date.now();
    await this.page.waitForSelector(selector, { timeout: maxTime });
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(maxTime);
  }

  /**
   * Assert that all critical UI elements are present
   */
  async assertCriticalElementsPresent(): Promise<void> {
    const criticalElements = [
      '[data-testid="dj-interface"]',
      '[data-testid="graph-container"]'
    ];

    for (const selector of criticalElements) {
      const element = this.page.locator(selector);
      await expect(element).toBeVisible();
    }
  }
}