import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for the development server to be ready
    console.log('Waiting for development server...');
    let retries = 30; // 30 seconds timeout
    while (retries > 0) {
      try {
        const response = await page.goto('http://localhost:3006', { 
          waitUntil: 'networkidle',
          timeout: 2000 
        });
        if (response?.ok()) {
          console.log('Development server is ready!');
          break;
        }
      } catch (error) {
        console.log(`Server not ready, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries--;
      }
    }

    if (retries === 0) {
      throw new Error('Development server failed to start within timeout');
    }

    // Pre-load test data if needed
    await setupTestData(page);

    // Setup authentication state if needed
    await setupAuthState(page);

    // Warm up the application
    await warmupApplication(page);

  } finally {
    await browser.close();
  }
}

async function setupTestData(page: any) {
  // Pre-populate test data for consistent e2e tests
  console.log('Setting up test data...');
  
  try {
    // Mock API responses for testing
    await page.route('**/api/v1/**', async (route: any) => {
      const url = route.request().url();
      
      if (url.includes('/nodes')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            nodes: generateTestNodes(100),
            metadata: { total: 100, loaded: 100 }
          })
        });
      } else if (url.includes('/edges')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            edges: generateTestEdges(80),
            metadata: { total: 80, loaded: 80 }
          })
        });
      } else {
        await route.continue();
      }
    });

    console.log('Test data setup complete');
  } catch (error) {
    console.warn('Failed to setup test data:', error);
  }
}

async function setupAuthState(page: any) {
  // Setup authentication if required
  console.log('Setting up authentication state...');
  
  try {
    // For now, just set some basic session data
    await page.evaluate(() => {
      localStorage.setItem('testMode', 'true');
      localStorage.setItem('userId', 'test-user-001');
    });

    console.log('Authentication state setup complete');
  } catch (error) {
    console.warn('Failed to setup auth state:', error);
  }
}

async function warmupApplication(page: any) {
  // Warm up the application to ensure stable performance
  console.log('Warming up application...');
  
  try {
    // Navigate to main routes to warm up code splitting
    const routes = ['/', '/graph'];
    
    for (const route of routes) {
      await page.goto(`http://localhost:3006${route}`, { 
        waitUntil: 'networkidle',
        timeout: 10000 
      });
      await page.waitForTimeout(1000); // Give time for initialization
    }

    console.log('Application warmup complete');
  } catch (error) {
    console.warn('Failed to warm up application:', error);
  }
}

function generateTestNodes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-node-${i + 1}`,
    name: `Test Node ${i + 1}`,
    type: 'track',
    x: Math.random() * 800,
    y: Math.random() * 600,
    metadata: {
      artist: `Artist ${i + 1}`,
      album: `Album ${Math.floor(i / 10) + 1}`,
      genre: ['Electronic', 'Rock', 'Jazz', 'Classical'][i % 4],
      year: 2020 + (i % 4),
    }
  }));
}

function generateTestEdges(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `test-edge-${i + 1}`,
    source: `test-node-${i + 1}`,
    target: `test-node-${(i + 1) % 100 + 1}`,
    weight: Math.random(),
    type: 'similarity',
    metadata: {
      strength: Math.random(),
      reason: ['tempo', 'genre', 'artist', 'key'][i % 4],
    }
  }));
}

export default globalSetup;