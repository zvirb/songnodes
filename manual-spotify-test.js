const { chromium } = require('playwright');

(async () => {
  console.log('🎵 Manual Spotify Connection Test\n');
  console.log('This test will help you connect Spotify step-by-step\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Monitor console for debugging
  page.on('console', msg => {
    console.log(`🖥️  [${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('📍 Step 1: Opening SongNodes...');
    await page.goto('http://localhost:3006');
    await page.waitForTimeout(2000);

    console.log('📍 Step 2: Clearing old tokens...');
    await page.evaluate(() => {
      localStorage.clear();
      console.log('Cleared all localStorage');
    });
    await page.reload();
    await page.waitForTimeout(2000);

    console.log('📍 Step 3: Opening Settings...');
    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(1500);

    console.log('📍 Step 4: Clicking CONNECT SPOTIFY...');
    console.log('\n⏸️  THE BROWSER WILL STAY OPEN');
    console.log('   Please complete these steps MANUALLY:\n');
    console.log('   1. Click the green "CONNECT SPOTIFY" button');
    console.log('   2. You will be redirected to Spotify');
    console.log('   3. Log in to Spotify if needed');
    console.log('   4. Authorize the app');
    console.log('   5. You should be redirected back to localhost:3006\n');
    console.log('⏸️  The browser will stay open for 2 MINUTES\n');

    // Wait 2 minutes for manual OAuth
    await page.waitForTimeout(120000);

    console.log('\n📍 Step 5: Checking if tokens were stored...');

    const authData = await page.evaluate(() => {
      const spotify = localStorage.getItem('spotify_oauth_tokens');
      const all = Object.keys(localStorage).map(key => ({
        key,
        value: localStorage.getItem(key)
      }));
      return {
        spotifyTokens: spotify,
        allKeys: all
      };
    });

    console.log('\n📦 LocalStorage Contents:');
    authData.allKeys.forEach(item => {
      console.log(`   ${item.key}:`);
      if (item.key.includes('spotify') || item.key.includes('zustand')) {
        try {
          const parsed = JSON.parse(item.value);
          console.log(JSON.stringify(parsed, null, 4));
        } catch {
          console.log(`      ${item.value.substring(0, 100)}...`);
        }
      }
    });

    if (authData.spotifyTokens) {
      console.log('\n✅ Spotify tokens found! Testing API...\n');

      const tokens = JSON.parse(authData.spotifyTokens);
      const apiTest = await page.evaluate(async (token) => {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (!res.ok) {
            return { success: false, status: res.status };
          }

          const data = await res.json();
          return { success: true, data };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, tokens.access_token);

      if (apiTest.success) {
        console.log('🎉 SUCCESS! Spotify API is working!\n');
        console.log('Your playlists:');
        apiTest.data.items.forEach((pl, i) => {
          console.log(`   ${i + 1}. ${pl.name} (${pl.tracks.total} tracks)`);
        });
      } else {
        console.log(`❌ API test failed: ${apiTest.status || apiTest.error}`);
      }
    } else {
      console.log('\n❌ No Spotify tokens found in localStorage');
      console.log('   The OAuth flow may not have completed successfully');
    }

    console.log('\n⏸️  Browser will stay open for 30 more seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Test complete!');
  }
})();
