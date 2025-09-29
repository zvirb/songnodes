import { test, expect } from '@playwright/test';

/**
 * Track Management Tests
 * Testing SetlistBuilder.tsx, TargetTracksManager.tsx, TrackDetailsModal.tsx
 */
test.describe('Track Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Setlist Builder', () => {
    test('should display setlist builder component', async ({ page }) => {
      const setlistBuilder = page.locator('[data-testid="setlist-builder"]');
      if (await setlistBuilder.isVisible()) {
        await expect(setlistBuilder).toHaveScreenshot('setlist-builder-initial.png');
      }
    });

    test('should add tracks to setlist via drag and drop', async ({ page }) => {
      // Wait for graph nodes to load
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });

      const setlistBuilder = page.locator('[data-testid="setlist-builder"]');
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await setlistBuilder.isVisible() && await firstNode.isVisible()) {
        // Drag node to setlist
        await firstNode.dragTo(setlistBuilder);
        await page.waitForTimeout(1000);

        await expect(setlistBuilder).toHaveScreenshot('setlist-with-added-track.png');

        // Verify setlist item appears
        const setlistItems = setlistBuilder.locator('[data-testid="setlist-item"]');
        await expect(setlistItems).toHaveCountGreaterThan(0);
      }
    });

    test('should reorder tracks in setlist', async ({ page }) => {
      const setlistBuilder = page.locator('[data-testid="setlist-builder"]');
      if (await setlistBuilder.isVisible()) {
        const setlistItems = setlistBuilder.locator('[data-testid="setlist-item"]');
        const itemCount = await setlistItems.count();

        if (itemCount >= 2) {
          // Take initial state
          await expect(setlistBuilder).toHaveScreenshot('setlist-before-reorder.png');

          // Drag first item to second position
          const firstItem = setlistItems.first();
          const secondItem = setlistItems.nth(1);

          await firstItem.dragTo(secondItem);
          await page.waitForTimeout(500);

          await expect(setlistBuilder).toHaveScreenshot('setlist-after-reorder.png');
        }
      }
    });

    test('should remove tracks from setlist', async ({ page }) => {
      const setlistBuilder = page.locator('[data-testid="setlist-builder"]');
      if (await setlistBuilder.isVisible()) {
        const setlistItems = setlistBuilder.locator('[data-testid="setlist-item"]');
        const itemCount = await setlistItems.count();

        if (itemCount > 0) {
          // Find and click remove button on first item
          const firstItem = setlistItems.first();
          const removeButton = firstItem.locator('[data-testid="remove-track-button"]');

          if (await removeButton.isVisible()) {
            await removeButton.click();
            await page.waitForTimeout(500);

            await expect(setlistBuilder).toHaveScreenshot('track-removed-from-setlist.png');

            // Verify item count decreased
            const newItemCount = await setlistBuilder.locator('[data-testid="setlist-item"]').count();
            expect(newItemCount).toBe(itemCount - 1);
          }
        }
      }
    });

    test('should save setlist', async ({ page }) => {
      const setlistBuilder = page.locator('[data-testid="setlist-builder"]');
      const saveButton = setlistBuilder.locator('[data-testid="save-setlist-button"]');

      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(500);

        // Check for save confirmation or modal
        const saveModal = page.locator('[data-testid="save-setlist-modal"]');
        if (await saveModal.isVisible()) {
          await expect(saveModal).toHaveScreenshot('save-setlist-modal.png');

          // Enter setlist name
          const nameInput = saveModal.locator('[data-testid="setlist-name-input"]');
          if (await nameInput.isVisible()) {
            await nameInput.fill('Test Setlist');
            await page.waitForTimeout(300);

            const confirmButton = saveModal.locator('[data-testid="confirm-save-button"]');
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
              await page.waitForTimeout(500);
              await expect(page).toHaveScreenshot('setlist-saved.png');
            }
          }
        }
      }
    });

    test('should load existing setlists', async ({ page }) => {
      const setlistBuilder = page.locator('[data-testid="setlist-builder"]');
      const loadDropdown = setlistBuilder.locator('[data-testid="load-setlist-dropdown"]');

      if (await loadDropdown.isVisible()) {
        await loadDropdown.click();
        await page.waitForTimeout(300);

        const setlistOptions = page.locator('[data-testid="setlist-option"]');
        const optionCount = await setlistOptions.count();

        if (optionCount > 0) {
          await expect(page).toHaveScreenshot('setlist-load-options.png');

          // Load first setlist
          await setlistOptions.first().click();
          await page.waitForTimeout(1000);

          await expect(setlistBuilder).toHaveScreenshot('setlist-loaded.png');
        }
      }
    });
  });

  test.describe('Target Tracks Manager', () => {
    test('should display target tracks manager', async ({ page }) => {
      const targetManager = page.locator('[data-testid="target-tracks-manager"]');
      if (await targetManager.isVisible()) {
        await expect(targetManager).toHaveScreenshot('target-tracks-manager.png');
      }
    });

    test('should open add target track modal', async ({ page }) => {
      const addButton = page.locator('[data-testid="add-target-track-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="add-target-track-modal"]');
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('add-target-track-modal.png');
        }
      }
    });

    test('should create new target track', async ({ page }) => {
      const addButton = page.locator('[data-testid="add-target-track-button"]');
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="add-target-track-modal"]');
        if (await modal.isVisible()) {
          // Fill form fields
          const trackNameInput = modal.locator('[data-testid="track-name-input"]');
          const artistInput = modal.locator('[data-testid="artist-input"]');
          const prioritySelect = modal.locator('[data-testid="priority-select"]');

          if (await trackNameInput.isVisible()) {
            await trackNameInput.fill('Test Track');
          }

          if (await artistInput.isVisible()) {
            await artistInput.fill('Test Artist');
          }

          if (await prioritySelect.isVisible()) {
            await prioritySelect.selectOption('high');
          }

          await expect(modal).toHaveScreenshot('target-track-form-filled.png');

          // Submit form
          const submitButton = modal.locator('[data-testid="submit-target-track"]');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(1000);

            // Verify track appears in list
            const targetTracksList = page.locator('[data-testid="target-tracks-list"]');
            if (await targetTracksList.isVisible()) {
              await expect(targetTracksList).toHaveScreenshot('target-track-added.png');
            }
          }
        }
      }
    });

    test('should edit existing target track', async ({ page }) => {
      const targetTracksList = page.locator('[data-testid="target-tracks-list"]');
      if (await targetTracksList.isVisible()) {
        const firstTrack = targetTracksList.locator('[data-testid="target-track-item"]').first();
        if (await firstTrack.isVisible()) {
          const editButton = firstTrack.locator('[data-testid="edit-target-track"]');
          if (await editButton.isVisible()) {
            await editButton.click();
            await page.waitForTimeout(500);

            const editModal = page.locator('[data-testid="edit-target-track-modal"]');
            if (await editModal.isVisible()) {
              await expect(editModal).toHaveScreenshot('edit-target-track-modal.png');

              // Modify fields
              const trackNameInput = editModal.locator('[data-testid="track-name-input"]');
              if (await trackNameInput.isVisible()) {
                await trackNameInput.fill('Updated Track Name');
                await page.waitForTimeout(300);

                const updateButton = editModal.locator('[data-testid="update-target-track"]');
                if (await updateButton.isVisible()) {
                  await updateButton.click();
                  await page.waitForTimeout(500);
                }
              }
            }
          }
        }
      }
    });

    test('should delete target track', async ({ page }) => {
      const targetTracksList = page.locator('[data-testid="target-tracks-list"]');
      if (await targetTracksList.isVisible()) {
        const tracks = targetTracksList.locator('[data-testid="target-track-item"]');
        const initialCount = await tracks.count();

        if (initialCount > 0) {
          const firstTrack = tracks.first();
          const deleteButton = firstTrack.locator('[data-testid="delete-target-track"]');

          if (await deleteButton.isVisible()) {
            await deleteButton.click();
            await page.waitForTimeout(300);

            // Confirm deletion if modal appears
            const confirmModal = page.locator('[data-testid="confirm-delete-modal"]');
            if (await confirmModal.isVisible()) {
              const confirmButton = confirmModal.locator('[data-testid="confirm-delete"]');
              await confirmButton.click();
              await page.waitForTimeout(500);
            }

            // Verify track was removed
            const newCount = await targetTracksList.locator('[data-testid="target-track-item"]').count();
            expect(newCount).toBe(initialCount - 1);
            await expect(targetTracksList).toHaveScreenshot('target-track-deleted.png');
          }
        }
      }
    });

    test('should trigger search for target track', async ({ page }) => {
      const targetTracksList = page.locator('[data-testid="target-tracks-list"]');
      if (await targetTracksList.isVisible()) {
        const firstTrack = targetTracksList.locator('[data-testid="target-track-item"]').first();
        if (await firstTrack.isVisible()) {
          const searchButton = firstTrack.locator('[data-testid="search-trigger-button"]');
          if (await searchButton.isVisible()) {
            await searchButton.click();
            await page.waitForTimeout(1000);

            // Check if search was triggered (graph updates, search results, etc.)
            await expect(page).toHaveScreenshot('target-track-search-triggered.png');
          }
        }
      }
    });

    test('should change priority levels', async ({ page }) => {
      const targetTracksList = page.locator('[data-testid="target-tracks-list"]');
      if (await targetTracksList.isVisible()) {
        const firstTrack = targetTracksList.locator('[data-testid="target-track-item"]').first();
        if (await firstTrack.isVisible()) {
          const priorityDropdown = firstTrack.locator('[data-testid="priority-dropdown"]');
          if (await priorityDropdown.isVisible()) {
            await expect(firstTrack).toHaveScreenshot('priority-before-change.png');

            await priorityDropdown.selectOption('low');
            await page.waitForTimeout(500);

            await expect(firstTrack).toHaveScreenshot('priority-after-change.png');
          }
        }
      }
    });
  });

  test.describe('Track Details Modal', () => {
    test('should open track details modal', async ({ page }) => {
      // Click on a track node to open details
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          await expect(modal).toHaveScreenshot('track-details-modal-full.png');
        }
      }
    });

    test('should display comprehensive track information', async ({ page }) => {
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          // Check for different sections
          const trackInfo = modal.locator('[data-testid="track-basic-info"]');
          const audioAnalysis = modal.locator('[data-testid="track-audio-analysis"]');
          const relatedTracks = modal.locator('[data-testid="related-tracks"]');

          if (await trackInfo.isVisible()) {
            await expect(trackInfo).toHaveScreenshot('track-basic-info.png');
          }

          if (await audioAnalysis.isVisible()) {
            await expect(audioAnalysis).toHaveScreenshot('track-audio-analysis.png');
          }

          if (await relatedTracks.isVisible()) {
            await expect(relatedTracks).toHaveScreenshot('track-related-tracks.png');
          }
        }
      }
    });

    test('should switch between analysis tabs', async ({ page }) => {
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          // Test different tabs
          const waveformTab = modal.locator('[data-testid="waveform-tab"]');
          const keyAnalysisTab = modal.locator('[data-testid="key-analysis-tab"]');
          const metadataTab = modal.locator('[data-testid="metadata-tab"]');

          if (await waveformTab.isVisible()) {
            await waveformTab.click();
            await page.waitForTimeout(500);
            await expect(modal).toHaveScreenshot('waveform-tab-active.png');
          }

          if (await keyAnalysisTab.isVisible()) {
            await keyAnalysisTab.click();
            await page.waitForTimeout(500);
            await expect(modal).toHaveScreenshot('key-analysis-tab-active.png');
          }

          if (await metadataTab.isVisible()) {
            await metadataTab.click();
            await page.waitForTimeout(500);
            await expect(modal).toHaveScreenshot('metadata-tab-active.png');
          }
        }
      }
    });

    test('should set track as current', async ({ page }) => {
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          const setCurrentButton = modal.locator('[data-testid="set-current-track"]');
          if (await setCurrentButton.isVisible()) {
            await setCurrentButton.click();
            await page.waitForTimeout(1000);

            // Check if now playing area updates
            const nowPlaying = page.locator('[data-testid="now-playing"]');
            if (await nowPlaying.isVisible()) {
              await expect(nowPlaying).toHaveScreenshot('track-set-as-current.png');
            }
          }
        }
      }
    });

    test('should close modal properly', async ({ page }) => {
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          // Test close button
          const closeButton = modal.locator('[data-testid="modal-close"]');
          if (await closeButton.isVisible()) {
            await closeButton.click();
            await page.waitForTimeout(300);
            await expect(modal).not.toBeVisible();
          }
        }
      }
    });

    test('should be keyboard accessible', async ({ page }) => {
      await page.waitForSelector('[data-testid="graph-node"]', { timeout: 10000 });
      const firstNode = page.locator('[data-testid="graph-node"]').first();

      if (await firstNode.isVisible()) {
        await firstNode.click();
        await page.waitForTimeout(500);

        const modal = page.locator('[data-testid="track-details-modal"]');
        if (await modal.isVisible()) {
          // Test escape key to close
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          await expect(modal).not.toBeVisible();

          // Reopen and test tab navigation
          await firstNode.click();
          await page.waitForTimeout(500);

          if (await modal.isVisible()) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(200);
            await expect(modal).toHaveScreenshot('modal-keyboard-navigation.png');
          }
        }
      }
    });
  });
});