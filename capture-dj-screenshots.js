const { chromium } = require('playwright');

async function captureScreenshots() {
  console.log('🎯 Starting DJ Interface Screenshot Capture...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // Navigate to the app
    console.log('📱 Loading DJ Interface...');
    await page.goto('http://localhost:3007', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Take full page screenshot
    console.log('📸 Capturing full DJ interface...');
    await page.screenshot({
      path: 'screenshots/dj-interface-full.png',
      fullPage: true
    });

    // Check if DJ interface loaded
    const djInterface = await page.locator('.dj-interface');
    if (await djInterface.count() > 0) {
      console.log('✅ DJ Interface detected!');

      // Capture Performer mode
      console.log('📸 Capturing Performer mode...');
      await page.screenshot({
        path: 'screenshots/dj-performer-mode.png',
        fullPage: false
      });

      // Check for Now Playing Deck
      const nowPlaying = await page.locator('.now-playing-deck');
      if (await nowPlaying.count() > 0) {
        console.log('✅ Now Playing Deck found');
        await nowPlaying.screenshot({
          path: 'screenshots/dj-now-playing.png'
        });
      }

      // Check for Intelligent Browser
      const browser = await page.locator('.intelligent-browser');
      if (await browser.count() > 0) {
        console.log('✅ Intelligent Browser found');
        await browser.screenshot({
          path: 'screenshots/dj-intelligent-browser.png'
        });
      }

      // Check for harmonic indicators
      const harmonic = await page.locator('.harmonic-indicator').first();
      if (await harmonic.count() > 0) {
        console.log('✅ Harmonic color-coding detected');
      }

      // Check for energy meters
      const energy = await page.locator('[class*="energy-meter"]').first();
      if (await energy.count() > 0) {
        console.log('✅ Visual energy meters detected');
      }

      // Toggle to Librarian mode if available
      const modeToggle = await page.locator('button:has-text("Librarian")');
      if (await modeToggle.count() > 0) {
        console.log('📸 Switching to Librarian mode...');
        await modeToggle.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: 'screenshots/dj-librarian-mode.png',
          fullPage: false
        });
      }

      // Visual hierarchy check
      console.log('\n📊 Visual Hierarchy Analysis:');

      // Check font sizes for hierarchy
      const trackName = await page.locator('.now-playing-deck h2').first();
      if (await trackName.count() > 0) {
        const fontSize = await trackName.evaluate(el =>
          window.getComputedStyle(el).fontSize
        );
        console.log(`  Track name font: ${fontSize}`);
      }

      const bpmDisplay = await page.locator('span:has-text("128")').first();
      if (await bpmDisplay.count() > 0) {
        const fontSize = await bpmDisplay.evaluate(el =>
          window.getComputedStyle(el).fontSize
        );
        console.log(`  BPM display font: ${fontSize}`);
      }

      // Check contrast
      const textElement = await page.locator('.dj-interface').first();
      const color = await textElement.evaluate(el =>
        window.getComputedStyle(el).color
      );
      const bgColor = await textElement.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );
      console.log(`  Text color: ${color}`);
      console.log(`  Background: ${bgColor}`);

      // Count recommendations (Hick's Law)
      const recommendations = await page.locator('.recommendation-card');
      const count = await recommendations.count();
      console.log(`  Recommendations shown: ${count} (Hick's Law: should be ≤20)`);

      console.log('\n✅ DJ Interface UX Analysis Complete!');

    } else {
      console.log('⚠️  DJ Interface not found, capturing classic view...');
      await page.screenshot({
        path: 'screenshots/classic-interface.png',
        fullPage: true
      });
    }

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error.message);
  } finally {
    await browser.close();
  }

  console.log('\n📁 Screenshots saved to ./screenshots/');
  console.log('Review them against The DJ\'s Co-Pilot and UI/UX Guide principles');
}

// Run the capture
captureScreenshots().catch(console.error);