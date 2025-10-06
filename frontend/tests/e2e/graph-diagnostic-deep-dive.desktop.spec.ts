import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deep diagnostic test to understand exactly what's happening with graph rendering
 */
test.describe('Graph Rendering Deep Diagnostic', () => {
  test('capture complete rendering state', async ({ page }) => {
    // Enable comprehensive console logging
    const consoleLogs: any[] = [];
    const errors: any[] = [];

    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };
      consoleLogs.push(logEntry);

      if (msg.type() === 'error') {
        errors.push(logEntry);
      }
    });

    page.on('pageerror', error => {
      errors.push({
        type: 'pageerror',
        message: error.message,
        stack: error.stack
      });
    });

    console.log('🚀 Navigating to http://localhost:3006...');
    await page.goto('http://localhost:3006');

    console.log('⏳ Waiting for app header...');
    await expect(page.locator('h1')).toContainText('SongNodes DJ', { timeout: 10000 });

    console.log('⏳ Waiting for graph initialization (5s)...');
    await page.waitForTimeout(5000);

    console.log('🔍 Extracting diagnostic data...');
    const diagnostics = await page.evaluate(() => {
      const results: any = {
        timestamp: new Date().toISOString(),
        environment: {},
        pixi: {},
        data: {},
        rendering: {},
        lod: {},
        dom: {}
      };

      // Environment
      results.environment = {
        userAgent: navigator.userAgent,
        windowSize: { width: window.innerWidth, height: window.innerHeight },
        devicePixelRatio: window.devicePixelRatio
      };

      // PIXI state
      const pixiApp = (window as any).pixiApp || (window as any).__PIXI_APP__;
      results.pixi.initialized = !!pixiApp;

      if (pixiApp) {
        results.pixi.version = (window as any).PIXI?.VERSION;
        results.pixi.renderer = {
          type: pixiApp.renderer?.type,
          width: pixiApp.renderer?.width,
          height: pixiApp.renderer?.height,
          resolution: pixiApp.renderer?.resolution
        };
        results.pixi.stage = {
          exists: !!pixiApp.stage,
          children: pixiApp.stage?.children?.length || 0,
          position: {
            x: pixiApp.stage?.position?.x,
            y: pixiApp.stage?.position?.y
          },
          scale: {
            x: pixiApp.stage?.scale?.x,
            y: pixiApp.stage?.scale?.y
          }
        };

        // Check containers
        const containers = pixiApp.stage?.children || [];
        results.pixi.containers = containers.map((c: any) => ({
          label: c.label,
          children: c.children?.length || 0,
          visible: c.visible,
          position: { x: c.position?.x, y: c.position?.y }
        }));
      }

      // Data state
      const enhancedNodes = (window as any).enhancedNodesRef?.current;
      const enhancedEdges = (window as any).enhancedEdgesRef?.current;

      results.data.nodesLoaded = enhancedNodes?.size || 0;
      results.data.edgesLoaded = enhancedEdges?.size || 0;

      if (enhancedNodes && enhancedNodes.size > 0) {
        const sampleNodes: any[] = [];
        let count = 0;
        enhancedNodes.forEach((node: any) => {
          if (count < 5) {
            sampleNodes.push({
              id: node.id?.substring(0, 20),
              x: node.x,
              y: node.y,
              hasPixiNode: !!node.pixiNode,
              pixiNodeVisible: node.pixiNode?.visible,
              pixiNodePosition: node.pixiNode ? {
                x: node.pixiNode.position?.x,
                y: node.pixiNode.position?.y
              } : null,
              pixiNodeParent: node.pixiNode?.parent?.label,
              isVisible: node.isVisible
            });
            count++;
          }
        });
        results.data.sampleNodes = sampleNodes;
      }

      // Viewport state
      const viewport = (window as any).viewportRef?.current;
      if (viewport) {
        results.rendering.viewport = {
          width: viewport.width,
          height: viewport.height,
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.zoom
        };
      }

      // LOD system state
      const lodSystem = (window as any).lodSystemRef?.current;
      if (lodSystem && enhancedNodes) {
        const lodDistribution = { lod0: 0, lod1: 0, lod2: 0, lod3: 0 };
        const lodSamples: any[] = [];
        let count = 0;

        enhancedNodes.forEach((node: any) => {
          const lod = lodSystem.getNodeLOD(node);
          lodDistribution[`lod${lod}` as keyof typeof lodDistribution]++;

          if (count < 10) {
            // Calculate screen position manually
            const screenX = (node.x * viewport.zoom) + (viewport.width / 2) + viewport.x;
            const screenY = (node.y * viewport.zoom) + (viewport.height / 2) + viewport.y;

            lodSamples.push({
              id: node.id?.substring(0, 20),
              worldPos: { x: Math.round(node.x), y: Math.round(node.y) },
              screenPos: { x: Math.round(screenX), y: Math.round(screenY) },
              lod,
              shouldRender: lod < 3,
              pixiVisible: node.pixiNode?.visible
            });
            count++;
          }
        });

        results.lod = {
          distribution: lodDistribution,
          samples: lodSamples,
          visibleCount: lodDistribution.lod0 + lodDistribution.lod1 + lodDistribution.lod2,
          culledCount: lodDistribution.lod3
        };
      }

      // DOM state
      const canvas = document.querySelector('canvas');
      if (canvas) {
        results.dom.canvas = {
          exists: true,
          width: canvas.width,
          height: canvas.height,
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          style: {
            display: canvas.style.display,
            visibility: canvas.style.visibility,
            position: canvas.style.position
          },
          computedStyle: {
            display: window.getComputedStyle(canvas).display,
            visibility: window.getComputedStyle(canvas).visibility
          },
          boundingRect: canvas.getBoundingClientRect()
        };

        // Check if canvas has actual content
        const ctx = (canvas as HTMLCanvasElement).getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, 100, 100);
          const hasContent = Array.from(imageData.data).some(v => v !== 0);
          results.dom.canvas.has2DContent = hasContent;
        }
      } else {
        results.dom.canvas = { exists: false };
      }

      return results;
    });

    console.log('\n========================================');
    console.log('COMPLETE GRAPH RENDERING DIAGNOSTICS');
    console.log('========================================\n');
    console.log(JSON.stringify(diagnostics, null, 2));

    console.log('\n========================================');
    console.log('ERRORS DETECTED');
    console.log('========================================\n');
    console.log(JSON.stringify(errors, null, 2));

    console.log('\n========================================');
    console.log('CONSOLE LOGS (last 50)');
    console.log('========================================\n');
    consoleLogs.slice(-50).forEach(log => {
      console.log(`[${log.type}] ${log.text}`);
    });
    console.log('\n========================================\n');

    // Ensure screenshots directory exists
    const screenshotsDir = path.join(process.cwd(), 'tests', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    console.log('📸 Taking screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'diagnostic-full-page.png'),
      fullPage: true
    });

    console.log('💾 Saving diagnostics to file...');
    const diagnosticsPath = path.join(screenshotsDir, 'diagnostics.json');
    fs.writeFileSync(
      diagnosticsPath,
      JSON.stringify({
        diagnostics,
        consoleLogs: consoleLogs.slice(-100),
        errors,
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    console.log(`✅ Diagnostics saved to: ${diagnosticsPath}`);

    // Print key findings
    console.log('\n========================================');
    console.log('🔍 KEY FINDINGS');
    console.log('========================================');
    console.log(`PIXI Status:`);
    console.log(`  - Version: ${diagnostics.pixi.version || 'N/A'}`);
    console.log(`  - Initialized: ${diagnostics.pixi.initialized ? '✅' : '❌'}`);
    console.log(`  - Renderer type: ${diagnostics.pixi.renderer?.type || 'N/A'}`);
    console.log(`  - Renderer size: ${diagnostics.pixi.renderer?.width}x${diagnostics.pixi.renderer?.height}`);
    console.log(`  - Stage children: ${diagnostics.pixi.stage?.children || 0}`);
    console.log(`\nData Status:`);
    console.log(`  - Nodes loaded: ${diagnostics.data.nodesLoaded}`);
    console.log(`  - Edges loaded: ${diagnostics.data.edgesLoaded}`);
    console.log(`\nLOD Status:`);
    console.log(`  - LOD0 (high detail): ${diagnostics.lod?.distribution?.lod0 || 0}`);
    console.log(`  - LOD1 (medium detail): ${diagnostics.lod?.distribution?.lod1 || 0}`);
    console.log(`  - LOD2 (low detail): ${diagnostics.lod?.distribution?.lod2 || 0}`);
    console.log(`  - LOD3 (culled): ${diagnostics.lod?.distribution?.lod3 || 0}`);
    console.log(`  - Total visible: ${diagnostics.lod?.visibleCount || 0}`);
    console.log(`\nCanvas Status:`);
    console.log(`  - Exists: ${diagnostics.dom.canvas?.exists ? '✅' : '❌'}`);
    console.log(`  - Size: ${diagnostics.dom.canvas?.width}x${diagnostics.dom.canvas?.height}`);
    console.log(`  - Visible: ${diagnostics.dom.canvas?.computedStyle?.visibility || 'N/A'}`);
    console.log(`\nErrors:`);
    console.log(`  - Total errors: ${errors.length}`);

    if (diagnostics.pixi.containers && diagnostics.pixi.containers.length > 0) {
      console.log(`\nPIXI Containers:`);
      diagnostics.pixi.containers.forEach((container: any, idx: number) => {
        console.log(`  ${idx + 1}. ${container.label || 'unnamed'}: ${container.children} children, visible=${container.visible}`);
      });
    }

    if (diagnostics.data.sampleNodes && diagnostics.data.sampleNodes.length > 0) {
      console.log(`\nSample Nodes (first 5):`);
      diagnostics.data.sampleNodes.forEach((node: any, idx: number) => {
        console.log(`  ${idx + 1}. ID: ${node.id}`);
        console.log(`     World pos: (${node.x}, ${node.y})`);
        console.log(`     Has PIXI node: ${node.hasPixiNode ? '✅' : '❌'}`);
        console.log(`     PIXI visible: ${node.pixiNodeVisible ? '✅' : '❌'}`);
        console.log(`     Parent: ${node.pixiNodeParent || 'none'}`);
      });
    }

    console.log('\n========================================\n');

    // Analysis and root cause identification
    console.log('========================================');
    console.log('🔬 ROOT CAUSE ANALYSIS');
    console.log('========================================\n');

    const problems: string[] = [];
    const workingParts: string[] = [];

    if (!diagnostics.pixi.initialized) {
      problems.push('❌ CRITICAL: PIXI not initialized');
    } else {
      workingParts.push('✅ PIXI is initialized');
    }

    if (diagnostics.data.nodesLoaded === 0) {
      problems.push('❌ CRITICAL: No nodes loaded from API');
    } else {
      workingParts.push(`✅ ${diagnostics.data.nodesLoaded} nodes loaded`);
    }

    if (diagnostics.data.nodesLoaded > 0) {
      const sampleNode = diagnostics.data.sampleNodes?.[0];
      if (sampleNode) {
        if (!sampleNode.hasPixiNode) {
          problems.push('❌ CRITICAL: Nodes loaded but PIXI sprites not created');
        } else {
          workingParts.push('✅ PIXI sprites created for nodes');
        }

        if (sampleNode.hasPixiNode && !sampleNode.pixiNodeVisible) {
          problems.push('⚠️  WARNING: PIXI sprites exist but marked invisible');
        }

        if (sampleNode.hasPixiNode && !sampleNode.pixiNodeParent) {
          problems.push('❌ CRITICAL: PIXI sprites not attached to scene graph');
        }
      }
    }

    if (!diagnostics.lod || diagnostics.lod.visibleCount === 0) {
      problems.push('❌ CRITICAL: LOD system shows 0 visible nodes (all culled)');
    } else if (diagnostics.lod.visibleCount > 0) {
      workingParts.push(`✅ LOD system shows ${diagnostics.lod.visibleCount} visible nodes`);
    }

    if (!diagnostics.dom.canvas?.exists) {
      problems.push('❌ CRITICAL: Canvas element not found in DOM');
    } else {
      workingParts.push('✅ Canvas element exists');
    }

    if (errors.length > 0) {
      problems.push(`⚠️  WARNING: ${errors.length} errors detected in console`);
    }

    console.log('WHAT IS WORKING:');
    workingParts.forEach(msg => console.log(`  ${msg}`));

    console.log('\nWHAT IS BROKEN:');
    if (problems.length === 0) {
      console.log('  ✅ No critical issues detected!');
    } else {
      problems.forEach(msg => console.log(`  ${msg}`));
    }

    console.log('\n========================================\n');

    // Non-blocking assertions - we want to see all diagnostics even if something fails
    console.log('Running assertions...');
    if (!diagnostics.pixi.initialized) {
      console.log('⚠️  PIXI not initialized - check console for errors');
    }
    if (diagnostics.data.nodesLoaded === 0) {
      console.log('⚠️  No nodes loaded - API may not be responding');
    }
  });
});
