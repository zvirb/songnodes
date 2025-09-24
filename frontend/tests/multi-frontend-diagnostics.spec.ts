import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FRONTENDS = [
  { name: 'docker-frontend', port: 3006, description: 'Docker Container Frontend' },
  { name: 'local-vite', port: 3007, description: 'Local Vite Dev Server' }
];

test.describe('Multi-Frontend Diagnostics', () => {
  for (const frontend of FRONTENDS) {
    test(`${frontend.description} (port ${frontend.port})`, async ({ page }) => {
      const screenshotDir = path.join(__dirname, 'screenshots', frontend.name);
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
      }

      let stepCount = 1;
      const takeScreenshot = async (name: string) => {
        const filename = `${stepCount.toString().padStart(2, '0')}-${name}.png`;
        await page.screenshot({
          path: path.join(screenshotDir, filename),
          fullPage: true
        });
        console.log(`📸 Screenshot saved: ${frontend.name}/${filename}`);
        stepCount++;
      };

      // Capture console logs
      const consoleLogs: string[] = [];
      page.on('console', msg => {
        const text = `[${msg.type()}] ${msg.text()}`;
        consoleLogs.push(text);
        if (msg.type() === 'error') {
          console.log(`❌ Console error: ${text}`);
        }
      });

      // Monitor API calls
      const apiCalls: any[] = [];
      page.on('response', async response => {
        if (response.url().includes('/api/')) {
          const call = {
            url: response.url(),
            status: response.status(),
            ok: response.ok(),
            headers: response.headers()
          };

          // Try to get response body
          try {
            if (response.ok()) {
              const contentType = response.headers()['content-type'] || '';
              if (contentType.includes('application/json')) {
                call.body = await response.json();
                if (call.body.nodes) {
                  console.log(`✅ API returned ${call.body.nodes.length} nodes`);
                }
                if (call.body.edges) {
                  console.log(`✅ API returned ${call.body.edges.length} edges`);
                }
              }
            } else {
              call.error = await response.text();
              console.log(`❌ API error ${response.status()}: ${call.error}`);
            }
          } catch (e) {
            // Ignore body parsing errors
          }

          apiCalls.push(call);
        }
      });

      console.log(`\n🚀 Testing ${frontend.description} on port ${frontend.port}`);
      console.log('═'.repeat(60));

      try {
        // Navigate to the frontend
        console.log('📍 Step 1: Navigating to application...');
        await page.goto(`http://localhost:${frontend.port}`, {
          waitUntil: 'networkidle',
          timeout: 30000
        });
        await takeScreenshot('initial-load');

        // Wait for potential lazy loading
        await page.waitForTimeout(3000);
        await takeScreenshot('after-3s-wait');

        // Check page title
        const title = await page.title();
        console.log(`📄 Page title: ${title}`);

        // Check for canvas/svg elements
        console.log('🎨 Step 2: Checking visualization elements...');
        const canvasCount = await page.locator('canvas').count();
        const svgCount = await page.locator('svg').count();
        console.log(`  Canvas elements: ${canvasCount}`);
        console.log(`  SVG elements: ${svgCount}`);

        // Check for data displays
        const nodeDisplay = await page.locator('text=/Nodes:/i').first().textContent().catch(() => 'Not found');
        const edgeDisplay = await page.locator('text=/Edges:/i').first().textContent().catch(() => 'Not found');
        console.log(`  Node counter: ${nodeDisplay}`);
        console.log(`  Edge counter: ${edgeDisplay}`);

        // Check for loading indicators
        const loadingIndicators = await page.locator('text=/loading|waiting/i').count();
        console.log(`  Loading indicators: ${loadingIndicators}`);

        await takeScreenshot('ui-elements-check');

        // Check Redux state if available
        console.log('📊 Step 3: Checking application state...');
        const appState = await page.evaluate(() => {
          // Try multiple methods to get state

          // Method 1: Direct Redux store
          if ((window as any).__REDUX_STORE__) {
            return {
              source: 'redux-direct',
              state: (window as any).__REDUX_STORE__.getState()
            };
          }

          // Method 2: React Fiber
          const root = document.getElementById('root');
          if (root && (root as any)._reactRootContainer) {
            try {
              const fiber = (root as any)._reactRootContainer._internalRoot?.current;
              let node = fiber;
              while (node) {
                if (node.memoizedProps?.store) {
                  return {
                    source: 'react-fiber',
                    state: node.memoizedProps.store.getState()
                  };
                }
                node = node.child || node.sibling || node.return;
              }
            } catch (e) {
              // Continue to next method
            }
          }

          // Method 3: Check window for any state
          if ((window as any).appState) {
            return {
              source: 'window-appState',
              state: (window as any).appState
            };
          }

          return { source: 'not-found', state: null };
        });

        if (appState.state) {
          console.log(`  State found via: ${appState.source}`);
          if (appState.state.graph) {
            console.log(`  Graph nodes: ${appState.state.graph?.nodes?.length || 0}`);
            console.log(`  Graph edges: ${appState.state.graph?.edges?.length || 0}`);
          }
        } else {
          console.log('  ⚠️ No application state found');
        }

        // Try manual API call
        console.log('🔌 Step 4: Testing API connectivity...');
        const apiTest = await page.evaluate(async () => {
          const tests = [];

          // Test 1: Relative URL
          try {
            const res1 = await fetch('/api/graph/nodes?limit=5');
            tests.push({
              url: '/api/graph/nodes?limit=5',
              status: res1.status,
              ok: res1.ok,
              data: res1.ok ? await res1.json() : null
            });
          } catch (e: any) {
            tests.push({
              url: '/api/graph/nodes?limit=5',
              error: e.message
            });
          }

          // Test 2: Direct to API gateway
          try {
            const res2 = await fetch('http://localhost:8080/api/graph/nodes?limit=5');
            tests.push({
              url: 'http://localhost:8080/api/graph/nodes?limit=5',
              status: res2.status,
              ok: res2.ok,
              data: res2.ok ? await res2.json() : null
            });
          } catch (e: any) {
            tests.push({
              url: 'http://localhost:8080/api/graph/nodes?limit=5',
              error: e.message
            });
          }

          return tests;
        });

        apiTest.forEach(test => {
          if (test.error) {
            console.log(`  ❌ ${test.url}: ${test.error}`);
          } else {
            console.log(`  ${test.ok ? '✅' : '❌'} ${test.url}: Status ${test.status}`);
            if (test.data?.nodes) {
              console.log(`     Returned ${test.data.nodes.length} nodes`);
            }
          }
        });

        await takeScreenshot('after-api-test');

        // Check network tab for failed requests
        console.log('🌐 Step 5: Analyzing network activity...');
        console.log(`  Total API calls made: ${apiCalls.length}`);
        const successfulCalls = apiCalls.filter(c => c.ok);
        const failedCalls = apiCalls.filter(c => !c.ok);
        console.log(`  Successful: ${successfulCalls.length}`);
        console.log(`  Failed: ${failedCalls.length}`);

        if (failedCalls.length > 0) {
          console.log('  Failed API calls:');
          failedCalls.forEach(call => {
            console.log(`    - ${call.status} ${call.url}`);
          });
        }

        // Try to trigger a refresh
        console.log('🔄 Step 6: Attempting data refresh...');
        await page.evaluate(() => {
          // Try to find and click refresh button
          const refreshBtn = document.querySelector('button[title*="refresh" i]');
          if (refreshBtn) {
            (refreshBtn as HTMLElement).click();
            return 'Refresh button clicked';
          }

          // Try to call load function directly
          if ((window as any).loadGraphData) {
            (window as any).loadGraphData();
            return 'loadGraphData called';
          }

          // Try to dispatch Redux action
          if ((window as any).__REDUX_STORE__) {
            (window as any).__REDUX_STORE__.dispatch({ type: 'FETCH_GRAPH_DATA' });
            return 'Redux action dispatched';
          }

          return 'No refresh method found';
        }).then(result => console.log(`  Refresh attempt: ${result}`));

        await page.waitForTimeout(2000);
        await takeScreenshot('after-refresh-attempt');

        // Final state check
        console.log('📋 Step 7: Final state assessment...');
        const finalState = {
          frontend: frontend.name,
          port: frontend.port,
          title,
          canvasCount,
          svgCount,
          nodeDisplay,
          edgeDisplay,
          loadingIndicators,
          hasState: !!appState.state,
          apiCallsTotal: apiCalls.length,
          apiCallsSuccess: successfulCalls.length,
          apiCallsFailed: failedCalls.length,
          consoleErrors: consoleLogs.filter(l => l.includes('[error]')).length
        };

        // Save diagnostic report
        const reportPath = path.join(screenshotDir, 'diagnostic-report.json');
        fs.writeFileSync(reportPath, JSON.stringify({
          ...finalState,
          apiCalls: apiCalls.slice(0, 10), // First 10 API calls
          consoleLogs: consoleLogs.slice(-20), // Last 20 console logs
          timestamp: new Date().toISOString()
        }, null, 2));

        console.log('\n📊 Summary:');
        console.log(JSON.stringify(finalState, null, 2));

        // Final screenshot
        await takeScreenshot('final-state');

      } catch (error: any) {
        console.error(`❌ Test failed for ${frontend.name}: ${error.message}`);
        await takeScreenshot('error-state').catch(() => {});
      }

      console.log('═'.repeat(60));
    });
  }
});