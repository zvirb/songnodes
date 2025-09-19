const puppeteer = require('puppeteer');

async function debugApp() {
  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Listen for console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error' || text.includes('Error') || text.includes('error')) {
        console.log(`❌ Console ${type}:`, text);
      } else if (text.includes('✅') || text.includes('📊') || text.includes('📐')) {
        console.log(`ℹ️ Console ${type}:`, text);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      console.log('❌ Page Error:', error.message);
    });

    console.log('Navigating to application...');
    await page.goto('http://localhost:3009', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Wait a bit for React to load
    await page.waitForTimeout(5000);

    // Check for error elements
    const errorElement = await page.$('h2:contains("Application Error")');
    if (errorElement) {
      console.log('❌ Application Error element found');

      // Get more details about the error
      const errorText = await page.evaluate(() => {
        const errorDiv = document.querySelector('div[class*="error"], .error-container, [id*="error"]');
        return errorDiv ? errorDiv.textContent : 'No error details found';
      });

      console.log('Error details:', errorText);
    } else {
      console.log('✅ No application error element found');
    }

    // Check for React root
    const reactRoot = await page.$('#root');
    if (reactRoot) {
      console.log('✅ React root element found');

      // Get root content
      const rootContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root ? root.innerHTML.length : 0;
      });

      console.log('Root content length:', rootContent);
    } else {
      console.log('❌ React root element not found');
    }

    // Take a screenshot
    await page.screenshot({ path: 'debug-screenshot.png' });
    console.log('📸 Screenshot saved as debug-screenshot.png');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugApp();