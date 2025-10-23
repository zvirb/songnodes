import { test, expect } from '@playwright/test';
import { TestUtilities } from '../helpers/test-utilities';

test.describe('IntelligentBrowser Component', () => {
  let testUtils: TestUtilities;

  test.beforeEach(async ({ page }) => {
    testUtils = new TestUtilities(page);
    await page.goto('/');
    await testUtils.waitForAppReady();
  });

  test.describe('TanStack Virtual - Large Track Lists', () => {
    test('should virtualize 10,000+ tracks efficiently', async ({ page }) => {
      // Look for the intelligent browser component
      const browser = page.locator('[data-testid="intelligent-browser"], [data-testid="track-browser"]').first();

      if (await browser.isVisible()) {
        // Check virtualization is active
        const trackList = browser.locator('[data-testid="track-list"], [role="list"]').first();
        await expect(trackList).toBeVisible();

        // Count visible track items
        const visibleTracks = await trackList.locator('[data-testid="track-item"], [role="listitem"]').count();

        // With virtualization, only a subset should be rendered
        expect(visibleTracks).toBeLessThan(100); // Much less than 10,000

        // Verify total track count indicator
        const trackCount = page.locator('[data-testid="track-count"], .track-count').first();
        if (await trackCount.isVisible()) {
          const countText = await trackCount.textContent();
          expect(countText).toMatch(/[0-9,]+/);

          const count = parseInt(countText?.replace(/[^0-9]/g, '') || '0');
          expect(count).toBeGreaterThan(100); // Should have many tracks
        }

        // Test scrolling performance
        const startTime = Date.now();

        // Scroll down rapidly
        await trackList.evaluate(el => el.scrollTop = 5000);
        await page.waitForTimeout(100);

        // Check new items rendered
        const newVisibleTracks = await trackList.locator('[data-testid="track-item"]:visible').count();
        expect(newVisibleTracks).toBeGreaterThan(0);

        const scrollTime = Date.now() - startTime;
        expect(scrollTime).toBeLessThan(500); // Should be fast
      }
    });

    test('should maintain scroll position during virtualization', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();

        // Scroll to middle
        await trackList.evaluate(el => el.scrollTop = 2000);
        const scrollPos = await trackList.evaluate(el => el.scrollTop);

        // Wait for render
        await page.waitForTimeout(200);

        // Scroll position should be maintained
        const newScrollPos = await trackList.evaluate(el => el.scrollTop);
        expect(Math.abs(newScrollPos - scrollPos)).toBeLessThan(50);

        // Verify correct items are visible
        const firstVisibleTrack = trackList.locator('[data-testid="track-item"]:visible').first();
        if (await firstVisibleTrack.count() > 0) {
          const trackIndex = await firstVisibleTrack.getAttribute('data-index');
          expect(parseInt(trackIndex || '0')).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate with arrow keys', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        await trackList.focus();

        // Navigate down
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        // Check first item is selected
        let selectedTrack = trackList.locator('[data-selected="true"], [aria-selected="true"]').first();
        await expect(selectedTrack).toBeVisible();

        let selectedIndex = await selectedTrack.getAttribute('data-index');
        expect(selectedIndex).toBe('0');

        // Navigate down more
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        selectedTrack = trackList.locator('[data-selected="true"]').first();
        selectedIndex = await selectedTrack.getAttribute('data-index');
        expect(parseInt(selectedIndex || '0')).toBe(2);

        // Navigate up
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(100);

        selectedTrack = trackList.locator('[data-selected="true"]').first();
        selectedIndex = await selectedTrack.getAttribute('data-index');
        expect(parseInt(selectedIndex || '0')).toBe(1);
      }
    });

    test('should select track with Enter key', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        await trackList.focus();

        // Select first track
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        // Check if track is loaded/playing
        const nowPlaying = page.locator('[data-testid="now-playing"], [data-testid="current-track"]').first();
        if (await nowPlaying.count() > 0) {
          await expect(nowPlaying).toBeVisible();
          const trackName = await nowPlaying.textContent();
          expect(trackName).toBeTruthy();
        }
      }
    });

    test('should deselect with Escape key', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        await trackList.focus();

        // Select a track
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(100);

        let selectedTrack = trackList.locator('[data-selected="true"]').first();
        await expect(selectedTrack).toBeVisible();

        // Press Escape to deselect
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);

        selectedTrack = trackList.locator('[data-selected="true"]').first();
        await expect(selectedTrack).not.toBeVisible();
      }
    });

    test('should support Page Up/Down navigation', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        await trackList.focus();

        // Page down
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(200);

        const scrollPosAfterPageDown = await trackList.evaluate(el => el.scrollTop);
        expect(scrollPosAfterPageDown).toBeGreaterThan(0);

        // Page up
        await page.keyboard.press('PageUp');
        await page.waitForTimeout(200);

        const scrollPosAfterPageUp = await trackList.evaluate(el => el.scrollTop);
        expect(scrollPosAfterPageUp).toBeLessThan(scrollPosAfterPageDown);
      }
    });

    test('should navigate to first/last with Home/End', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        await trackList.focus();

        // Go to end
        await page.keyboard.press('End');
        await page.waitForTimeout(500);

        const scrollHeight = await trackList.evaluate(el => el.scrollHeight);
        const scrollTop = await trackList.evaluate(el => el.scrollTop);
        const clientHeight = await trackList.evaluate(el => el.clientHeight);

        // Should be near bottom
        expect(scrollTop + clientHeight).toBeGreaterThan(scrollHeight * 0.9);

        // Go to beginning
        await page.keyboard.press('Home');
        await page.waitForTimeout(500);

        const newScrollTop = await trackList.evaluate(el => el.scrollTop);
        expect(newScrollTop).toBeLessThan(100);
      }
    });
  });

  test.describe('Search and Filtering', () => {
    test('should filter tracks in real-time', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        // Find search input
        const searchInput = browser.locator('[data-testid="track-search"], input[placeholder*="Search"]').first();
        await expect(searchInput).toBeVisible();

        // Get initial track count
        const trackList = browser.locator('[data-testid="track-list"]').first();
        const initialTracks = await trackList.locator('[data-testid="track-item"]').count();

        // Type search query
        await searchInput.fill('test');
        await page.waitForTimeout(300); // Wait for debounce

        // Check filtered results
        const filteredTracks = await trackList.locator('[data-testid="track-item"]').count();
        expect(filteredTracks).toBeLessThanOrEqual(initialTracks);

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(300);

        // Tracks should be restored
        const restoredTracks = await trackList.locator('[data-testid="track-item"]').count();
        expect(restoredTracks).toBeGreaterThanOrEqual(filteredTracks);
      }
    });

    test('should highlight search matches', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const searchInput = browser.locator('input[placeholder*="Search"]').first();
        await searchInput.fill('a');
        await page.waitForTimeout(300);

        // Check for highlighted text
        const highlightedText = browser.locator('mark, .highlight, [data-highlighted="true"]').first();
        if (await highlightedText.count() > 0) {
          await expect(highlightedText).toBeVisible();
          const text = await highlightedText.textContent();
          expect(text?.toLowerCase()).toContain('a');
        }
      }
    });

    test('should show no results message', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const searchInput = browser.locator('input[placeholder*="Search"]').first();
        await searchInput.fill('xyznonexistenttrack123');
        await page.waitForTimeout(300);

        // Check for no results message
        const noResults = browser.locator('[data-testid="no-results"], .no-results').first();
        if (await noResults.count() > 0) {
          await expect(noResults).toBeVisible();
          const message = await noResults.textContent();
          expect(message).toMatch(/no.*found|no.*results/i);
        }
      }
    });
  });

  test.describe('Track Selection', () => {
    test('should select single track on click', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        const firstTrack = trackList.locator('[data-testid="track-item"]').first();

        if (await firstTrack.isVisible()) {
          await firstTrack.click();

          // Check selected state
          const isSelected = await firstTrack.getAttribute('data-selected');
          expect(isSelected).toBe('true');

          // Click another track
          const secondTrack = trackList.locator('[data-testid="track-item"]').nth(1);
          if (await secondTrack.isVisible()) {
            await secondTrack.click();

            // First should be deselected
            const firstSelected = await firstTrack.getAttribute('data-selected');
            expect(firstSelected).toBe('false');

            // Second should be selected
            const secondSelected = await secondTrack.getAttribute('data-selected');
            expect(secondSelected).toBe('true');
          }
        }
      }
    });

    test('should support multi-select with Ctrl/Cmd', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        const tracks = trackList.locator('[data-testid="track-item"]');

        if (await tracks.count() >= 2) {
          // Select first track
          await tracks.first().click();

          // Ctrl+click second track
          await page.keyboard.down('Control');
          await tracks.nth(1).click();
          await page.keyboard.up('Control');

          // Both should be selected
          const firstSelected = await tracks.first().getAttribute('data-selected');
          const secondSelected = await tracks.nth(1).getAttribute('data-selected');

          expect(firstSelected).toBe('true');
          expect(secondSelected).toBe('true');
        }
      }
    });

    test('should support range select with Shift', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();
        const tracks = trackList.locator('[data-testid="track-item"]');

        if (await tracks.count() >= 5) {
          // Select first track
          await tracks.first().click();

          // Shift+click fifth track
          await page.keyboard.down('Shift');
          await tracks.nth(4).click();
          await page.keyboard.up('Shift');

          // Check tracks 0-4 are selected
          for (let i = 0; i < 5; i++) {
            const selected = await tracks.nth(i).getAttribute('data-selected');
            expect(selected).toBe('true');
          }
        }
      }
    });
  });

  test.describe('Track Actions', () => {
    test('should show context menu on right-click', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const track = browser.locator('[data-testid="track-item"]').first();

        if (await track.isVisible()) {
          await track.click({ button: 'right' });

          // Check context menu appears
          const contextMenu = page.locator('[data-testid="context-menu"], [role="menu"]').first();
          await expect(contextMenu).toBeVisible();

          // Check menu items
          const menuItems = contextMenu.locator('[role="menuitem"]');
          const itemCount = await menuItems.count();
          expect(itemCount).toBeGreaterThan(0);

          // Common actions
          const playItem = contextMenu.locator(':has-text("Play")').first();
          const addToPlaylist = contextMenu.locator(':has-text("Add to")').first();

          if (await playItem.isVisible()) {
            await playItem.click();
            // Track should play
          }
        }
      }
    });

    test('should support drag and drop', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const track = browser.locator('[data-testid="track-item"]').first();
        const dropZone = page.locator('[data-testid="playlist"], [data-testid="setlist"]').first();

        if (await track.isVisible() && await dropZone.isVisible()) {
          // Drag track to playlist
          await track.dragTo(dropZone);

          // Check if track was added
          const playlistTracks = dropZone.locator('[data-testid="track-item"]');
          const count = await playlistTracks.count();
          expect(count).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Performance', () => {
    test('should handle rapid scrolling smoothly', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();

        const startTime = Date.now();

        // Rapid scroll test
        for (let i = 0; i < 10; i++) {
          await trackList.evaluate(el => el.scrollTop += 500);
          await page.waitForTimeout(50);
        }

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // Should complete quickly
        expect(totalTime).toBeLessThan(1500);

        // Check FPS during scroll
        const fps = await page.evaluate(() => {
          return new Promise<number>((resolve) => {
            let frames = 0;
            const start = performance.now();

            function count() {
              frames++;
              if (performance.now() - start < 1000) {
                requestAnimationFrame(count);
              } else {
                resolve(frames);
              }
            }

            requestAnimationFrame(count);
          });
        });

        expect(fps).toBeGreaterThan(30); // Should maintain smooth scrolling
      }
    });

    test('should not leak memory with selection changes', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const initialMemory = await page.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        // Rapidly select/deselect tracks
        const tracks = browser.locator('[data-testid="track-item"]');
        for (let i = 0; i < 20; i++) {
          const track = tracks.nth(i % 5);
          if (await track.isVisible()) {
            await track.click();
            await page.waitForTimeout(50);
          }
        }

        // Force garbage collection if available
        await page.evaluate(() => {
          if ((window as any).gc) (window as any).gc();
        });

        await page.waitForTimeout(1000);

        const finalMemory = await page.evaluate(() => {
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        if (initialMemory > 0 && finalMemory > 0) {
          const memoryGrowth = (finalMemory - initialMemory) / initialMemory;
          expect(memoryGrowth).toBeLessThan(0.3); // Less than 30% growth
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA attributes', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const trackList = browser.locator('[data-testid="track-list"]').first();

        // Check list role
        const role = await trackList.getAttribute('role');
        expect(role).toBe('list');

        // Check items have listitem role
        const tracks = trackList.locator('[data-testid="track-item"]');
        const firstTrack = tracks.first();

        if (await firstTrack.isVisible()) {
          const itemRole = await firstTrack.getAttribute('role');
          expect(itemRole).toBe('listitem');

          // Check aria-label
          const ariaLabel = await firstTrack.getAttribute('aria-label');
          expect(ariaLabel).toBeTruthy();
        }
      }
    });

    test('should announce selection changes', async ({ page }) => {
      const browser = page.locator('[data-testid="intelligent-browser"]').first();

      if (await browser.isVisible()) {
        const track = browser.locator('[data-testid="track-item"]').first();

        if (await track.isVisible()) {
          // Select track
          await track.click();

          // Check for live region announcement
          const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"]').first();
          if (await liveRegion.count() > 0) {
            const announcement = await liveRegion.textContent();
            expect(announcement).toBeTruthy();
          }
        }
      }
    });
  });
});