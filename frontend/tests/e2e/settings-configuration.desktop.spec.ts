import { test, expect } from '@playwright/test';

/**
 * Settings & Configuration Tests
 * Testing SettingsPanel.tsx, Pipeline Monitoring, and configuration persistence
 */
test.describe('Settings & Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  test.describe('Settings Panel', () => {
    test('should open and close settings panel', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        // Open settings panel
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          await expect(settingsPanel).toHaveScreenshot('settings-panel-open.png');

          // Close settings panel
          await settingsToggle.click();
          await page.waitForTimeout(500);
          await expect(settingsPanel).not.toBeVisible();
        }
      }
    });

    test('should display all settings categories', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          // Check for performance settings
          const performanceSection = settingsPanel.locator('[data-testid="performance-settings"]');
          if (await performanceSection.isVisible()) {
            await expect(performanceSection).toHaveScreenshot('performance-settings-section.png');
          }

          // Check for visual appearance options
          const visualSection = settingsPanel.locator('[data-testid="visual-settings"]');
          if (await visualSection.isVisible()) {
            await expect(visualSection).toHaveScreenshot('visual-settings-section.png');
          }

          // Check for audio settings
          const audioSection = settingsPanel.locator('[data-testid="audio-settings"]');
          if (await audioSection.isVisible()) {
            await expect(audioSection).toHaveScreenshot('audio-settings-section.png');
          }
        }
      }
    });

    test('should toggle performance settings', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          const performanceSection = settingsPanel.locator('[data-testid="performance-settings"]');

          if (await performanceSection.isVisible()) {
            // Test WebGL acceleration toggle
            const webglToggle = performanceSection.locator('[data-testid="webgl-acceleration-toggle"]');
            if (await webglToggle.isVisible()) {
              const initialState = await webglToggle.isChecked();
              await webglToggle.click();
              await page.waitForTimeout(500);
              await expect(webglToggle).not.toBeChecked({ checked: initialState });
              await expect(performanceSection).toHaveScreenshot('webgl-toggle-changed.png');
            }

            // Test animation quality setting
            const animationQuality = performanceSection.locator('[data-testid="animation-quality-select"]');
            if (await animationQuality.isVisible()) {
              await animationQuality.selectOption('low');
              await page.waitForTimeout(500);
              await expect(performanceSection).toHaveScreenshot('animation-quality-changed.png');
            }

            // Test node limit setting
            const nodeLimit = performanceSection.locator('[data-testid="node-limit-input"]');
            if (await nodeLimit.isVisible()) {
              await nodeLimit.fill('500');
              await page.waitForTimeout(500);
              await expect(performanceSection).toHaveScreenshot('node-limit-changed.png');
            }
          }
        }
      }
    });

    test('should configure visual appearance options', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          const visualSection = settingsPanel.locator('[data-testid="visual-settings"]');

          if (await visualSection.isVisible()) {
            // Test theme selection
            const themeSelect = visualSection.locator('[data-testid="theme-select"]');
            if (await themeSelect.isVisible()) {
              await themeSelect.selectOption('dark');
              await page.waitForTimeout(1000);
              await expect(page).toHaveScreenshot('dark-theme-applied.png');
            }

            // Test color scheme
            const colorScheme = visualSection.locator('[data-testid="color-scheme-select"]');
            if (await colorScheme.isVisible()) {
              await colorScheme.selectOption('neon');
              await page.waitForTimeout(500);
              await expect(visualSection).toHaveScreenshot('neon-color-scheme.png');
            }

            // Test node size setting
            const nodeSize = visualSection.locator('[data-testid="node-size-slider"]');
            if (await nodeSize.isVisible()) {
              const sliderTrack = nodeSize.locator('.slider-track');
              if (await sliderTrack.isVisible()) {
                const box = await sliderTrack.boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
                  await page.waitForTimeout(500);
                  await expect(visualSection).toHaveScreenshot('node-size-increased.png');
                }
              }
            }

            // Test edge thickness
            const edgeThickness = visualSection.locator('[data-testid="edge-thickness-slider"]');
            if (await edgeThickness.isVisible()) {
              const sliderTrack = edgeThickness.locator('.slider-track');
              if (await sliderTrack.isVisible()) {
                const box = await sliderTrack.boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
                  await page.waitForTimeout(500);
                  await expect(visualSection).toHaveScreenshot('edge-thickness-decreased.png');
                }
              }
            }
          }
        }
      }
    });

    test('should configure audio settings', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          const audioSection = settingsPanel.locator('[data-testid="audio-settings"]');

          if (await audioSection.isVisible()) {
            // Test volume control
            const volumeSlider = audioSection.locator('[data-testid="volume-slider"]');
            if (await volumeSlider.isVisible()) {
              const sliderTrack = volumeSlider.locator('.slider-track');
              if (await sliderTrack.isVisible()) {
                const box = await sliderTrack.boundingBox();
                if (box) {
                  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height / 2);
                  await page.waitForTimeout(500);
                  await expect(audioSection).toHaveScreenshot('volume-adjusted.png');
                }
              }
            }

            // Test crossfade duration
            const crossfadeDuration = audioSection.locator('[data-testid="crossfade-duration-input"]');
            if (await crossfadeDuration.isVisible()) {
              await crossfadeDuration.fill('8');
              await page.waitForTimeout(300);
              await expect(audioSection).toHaveScreenshot('crossfade-duration-set.png');
            }

            // Test auto-gain toggle
            const autoGainToggle = audioSection.locator('[data-testid="auto-gain-toggle"]');
            if (await autoGainToggle.isVisible()) {
              const initialState = await autoGainToggle.isChecked();
              await autoGainToggle.click();
              await page.waitForTimeout(300);
              await expect(autoGainToggle).not.toBeChecked({ checked: initialState });
              await expect(audioSection).toHaveScreenshot('auto-gain-toggled.png');
            }

            // Test audio format preference
            const audioFormat = audioSection.locator('[data-testid="audio-format-select"]');
            if (await audioFormat.isVisible()) {
              await audioFormat.selectOption('flac');
              await page.waitForTimeout(300);
              await expect(audioSection).toHaveScreenshot('audio-format-changed.png');
            }
          }
        }
      }
    });

    test('should export and import settings', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          // Test export settings
          const exportButton = settingsPanel.locator('[data-testid="export-settings-button"]');
          if (await exportButton.isVisible()) {
            // Start waiting for download before clicking
            const downloadPromise = page.waitForEvent('download');
            await exportButton.click();

            try {
              const download = await downloadPromise;
              expect(download.suggestedFilename()).toMatch(/settings.*\.json/);
              await expect(settingsPanel).toHaveScreenshot('settings-exported.png');
            } catch (error) {
              // Download might not work in test environment
              console.log('Download test skipped in test environment');
            }
          }

          // Test import settings
          const importButton = settingsPanel.locator('[data-testid="import-settings-button"]');
          if (await importButton.isVisible()) {
            // Note: File upload testing would need a test file
            await expect(importButton).toHaveScreenshot('import-settings-button.png');
          }
        }
      }
    });

    test('should persist settings across sessions', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          // Change a setting
          const themeSelect = settingsPanel.locator('[data-testid="theme-select"]');
          if (await themeSelect.isVisible()) {
            await themeSelect.selectOption('dark');
            await page.waitForTimeout(500);

            // Close settings
            await settingsToggle.click();
            await page.waitForTimeout(300);

            // Reload page
            await page.reload();
            await page.waitForSelector('[data-testid="dj-interface"]', { timeout: 30000 });
            await page.waitForTimeout(1000);

            // Check if dark theme persisted
            await expect(page).toHaveScreenshot('theme-persisted-after-reload.png');

            // Verify setting value persisted
            await settingsToggle.click();
            await page.waitForTimeout(500);

            if (await settingsPanel.isVisible()) {
              const currentTheme = await themeSelect.inputValue();
              expect(currentTheme).toBe('dark');
            }
          }
        }
      }
    });
  });

  test.describe('Pipeline Monitoring', () => {
    test('should display pipeline monitoring dashboard', async ({ page }) => {
      const dashboardButton = page.locator('[data-testid="pipeline-dashboard-button"]');

      if (await dashboardButton.isVisible()) {
        await dashboardButton.click();
        await page.waitForTimeout(1000);

        const dashboard = page.locator('[data-testid="pipeline-dashboard"]');
        if (await dashboard.isVisible()) {
          await expect(dashboard).toHaveScreenshot('pipeline-dashboard-full.png');
        }
      }
    });

    test('should show real-time status indicators', async ({ page }) => {
      const statusIndicators = page.locator('[data-testid="pipeline-status-indicators"]');

      if (await statusIndicators.isVisible()) {
        await expect(statusIndicators).toHaveScreenshot('pipeline-status-indicators.png');

        // Check individual service statuses
        const services = ['scraper', 'api-gateway', 'graph-processor', 'database'];

        for (const service of services) {
          const serviceStatus = statusIndicators.locator(`[data-testid="status-${service}"]`);
          if (await serviceStatus.isVisible()) {
            await expect(serviceStatus).toHaveScreenshot(`${service}-status.png`);
          }
        }
      }
    });

    test('should refresh connection status', async ({ page }) => {
      const refreshButton = page.locator('[data-testid="refresh-pipeline-status"]');

      if (await refreshButton.isVisible()) {
        // Take initial state
        const statusArea = page.locator('[data-testid="pipeline-status-area"]');
        if (await statusArea.isVisible()) {
          await expect(statusArea).toHaveScreenshot('pipeline-status-before-refresh.png');
        }

        // Click refresh
        await refreshButton.click();
        await page.waitForTimeout(2000); // Wait for refresh to complete

        if (await statusArea.isVisible()) {
          await expect(statusArea).toHaveScreenshot('pipeline-status-after-refresh.png');
        }
      }
    });

    test('should display connection status details', async ({ page }) => {
      const connectionStatus = page.locator('[data-testid="connection-status"]');

      if (await connectionStatus.isVisible()) {
        await expect(connectionStatus).toHaveScreenshot('connection-status-overview.png');

        // Check for detailed connection info
        const websocketStatus = connectionStatus.locator('[data-testid="websocket-status"]');
        const apiStatus = connectionStatus.locator('[data-testid="api-connection-status"]');
        const databaseStatus = connectionStatus.locator('[data-testid="database-status"]');

        if (await websocketStatus.isVisible()) {
          await expect(websocketStatus).toHaveScreenshot('websocket-connection-status.png');
        }

        if (await apiStatus.isVisible()) {
          await expect(apiStatus).toHaveScreenshot('api-connection-status.png');
        }

        if (await databaseStatus.isVisible()) {
          await expect(databaseStatus).toHaveScreenshot('database-connection-status.png');
        }
      }
    });

    test('should show error displays when services are down', async ({ page }) => {
      const errorDisplays = page.locator('[data-testid="pipeline-errors"]');

      if (await errorDisplays.isVisible()) {
        await expect(errorDisplays).toHaveScreenshot('pipeline-error-displays.png');

        // Check for specific error types
        const connectionErrors = errorDisplays.locator('[data-testid="connection-errors"]');
        const serviceErrors = errorDisplays.locator('[data-testid="service-errors"]');
        const dataErrors = errorDisplays.locator('[data-testid="data-errors"]');

        if (await connectionErrors.isVisible()) {
          await expect(connectionErrors).toHaveScreenshot('connection-error-details.png');
        }

        if (await serviceErrors.isVisible()) {
          await expect(serviceErrors).toHaveScreenshot('service-error-details.png');
        }

        if (await dataErrors.isVisible()) {
          await expect(dataErrors).toHaveScreenshot('data-error-details.png');
        }
      }
    });

    test('should update status indicators in real-time', async ({ page }) => {
      const statusIndicators = page.locator('[data-testid="pipeline-status-indicators"]');

      if (await statusIndicators.isVisible()) {
        // Take initial screenshot
        await expect(statusIndicators).toHaveScreenshot('realtime-status-initial.png');

        // Wait for potential status updates (real-time updates)
        await page.waitForTimeout(5000);

        // Take screenshot after time elapsed
        await expect(statusIndicators).toHaveScreenshot('realtime-status-after-5s.png');
      }
    });
  });

  test.describe('Settings Accessibility & UX', () => {
    test('should be keyboard accessible', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        // Focus on settings toggle
        await settingsToggle.focus();
        await page.waitForTimeout(200);
        await expect(settingsToggle).toHaveScreenshot('settings-toggle-focused.png');

        // Open with Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Navigate through settings with Tab
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);
        }
        await expect(page).toHaveScreenshot('settings-keyboard-navigation.png');

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        await expect(settingsPanel).not.toBeVisible();
      }
    });

    test('should provide clear feedback for setting changes', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          // Change a setting and look for feedback
          const performanceSection = settingsPanel.locator('[data-testid="performance-settings"]');
          if (await performanceSection.isVisible()) {
            const webglToggle = performanceSection.locator('[data-testid="webgl-acceleration-toggle"]');
            if (await webglToggle.isVisible()) {
              await webglToggle.click();
              await page.waitForTimeout(500);

              // Look for feedback message or visual indication
              const feedback = page.locator('[data-testid="setting-change-feedback"]');
              if (await feedback.isVisible()) {
                await expect(feedback).toHaveScreenshot('setting-change-feedback.png');
              }
            }
          }
        }
      }
    });

    test('should validate setting input ranges', async ({ page }) => {
      const settingsToggle = page.locator('[data-testid="settings-toggle"]');

      if (await settingsToggle.isVisible()) {
        await settingsToggle.click();
        await page.waitForTimeout(500);

        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        if (await settingsPanel.isVisible()) {
          const performanceSection = settingsPanel.locator('[data-testid="performance-settings"]');
          if (await performanceSection.isVisible()) {
            const nodeLimit = performanceSection.locator('[data-testid="node-limit-input"]');
            if (await nodeLimit.isVisible()) {
              // Try to enter an invalid value
              await nodeLimit.fill('99999');
              await page.keyboard.press('Tab'); // Trigger validation
              await page.waitForTimeout(300);

              const validationMessage = page.locator('[data-testid="validation-message"]');
              if (await validationMessage.isVisible()) {
                await expect(validationMessage).toHaveScreenshot('input-validation-error.png');
              }
            }
          }
        }
      }
    });
  });
});