import { Page, Locator, expect } from '@playwright/test';

/**
 * Graph Visualization Test Helpers
 *
 * Specialized utilities for testing WebGL/PIXI.js graph visualization components
 * in the SongNodes DJ application.
 */

export interface GraphMetrics {
  nodeCount: number;
  edgeCount: number;
  visibleNodes: number;
  visibleEdges: number;
  frameRate: number;
  renderTime: number;
  webglContext: boolean;
  pixiVersion: string;
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  visible: boolean;
  selected: boolean;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  visible: boolean;
}

export class GraphVisualizationHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for the graph visualization to initialize
   */
  async waitForGraphInitialization(timeout: number = 30000): Promise<void> {
    // Wait for PIXI application to be ready
    await this.page.waitForFunction(
      () => {
        return window.pixiApp && window.pixiApp.stage;
      },
      { timeout }
    );

    // Wait for D3 simulation to be initialized
    await this.page.waitForFunction(
      () => {
        return window.d3Simulation !== undefined;
      },
      { timeout }
    );

    // Wait for initial render to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if WebGL is supported and enabled
   */
  async checkWebGLSupport(): Promise<boolean> {
    return await this.page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return gl !== null;
    });
  }

  /**
   * Get PIXI.js application info
   */
  async getPixiInfo(): Promise<{ version: string; renderer: string; webgl: boolean }> {
    return await this.page.evaluate(() => {
      // @ts-ignore - PIXI is available globally
      if (!window.PIXI) return { version: 'unknown', renderer: 'unknown', webgl: false };

      // @ts-ignore
      const app = window.pixiApp;
      return {
        // @ts-ignore
        version: PIXI.VERSION || 'unknown',
        renderer: app ? app.renderer.constructor.name : 'unknown',
        webgl: app ? app.renderer.type === 1 : false // WebGL renderer type
      };
    });
  }

  /**
   * Get current graph metrics
   */
  async getGraphMetrics(): Promise<GraphMetrics> {
    return await this.page.evaluate(() => {
      // @ts-ignore - These are exposed for testing
      const app = window.pixiApp;
      const performance = window.graphPerformance || {};

      return {
        nodeCount: performance.nodeCount || 0,
        edgeCount: performance.edgeCount || 0,
        visibleNodes: performance.visibleNodes || 0,
        visibleEdges: performance.visibleEdges || 0,
        frameRate: performance.frameRate || 0,
        renderTime: performance.renderTime || 0,
        webglContext: !!app?.renderer?.gl,
        pixiVersion: window.PIXI?.VERSION || 'unknown'
      };
    });
  }

  /**
   * Get all visible nodes in the graph
   */
  async getVisibleNodes(): Promise<GraphNode[]> {
    return await this.page.evaluate(() => {
      // @ts-ignore
      const app = window.pixiApp;
      if (!app) return [];

      const nodes: GraphNode[] = [];
      const nodesContainer = app.stage.getChildByName('nodes');

      if (nodesContainer) {
        nodesContainer.children.forEach((child: any, index: number) => {
          if (child.visible) {
            nodes.push({
              id: child.nodeId || `node-${index}`,
              x: child.x,
              y: child.y,
              radius: child.width / 2,
              color: child.tint || 0xffffff,
              visible: child.visible,
              selected: child.selected || false
            });
          }
        });
      }

      return nodes;
    });
  }

  /**
   * Get all visible edges in the graph
   */
  async getVisibleEdges(): Promise<GraphEdge[]> {
    return await this.page.evaluate(() => {
      // @ts-ignore
      const app = window.pixiApp;
      if (!app) return [];

      const edges: GraphEdge[] = [];
      const edgesContainer = app.stage.getChildByName('edges');

      if (edgesContainer) {
        edgesContainer.children.forEach((child: any, index: number) => {
          if (child.visible) {
            edges.push({
              id: child.edgeId || `edge-${index}`,
              sourceId: child.sourceId || '',
              targetId: child.targetId || '',
              weight: child.weight || 0,
              visible: child.visible
            });
          }
        });
      }

      return edges;
    });
  }

  /**
   * Click on a node at specific coordinates
   */
  async clickNodeAtPosition(x: number, y: number): Promise<void> {
    await this.page.mouse.click(x, y);
    await this.page.waitForTimeout(100); // Brief pause for interaction to register
  }

  /**
   * Click on a node by ID
   */
  async clickNodeById(nodeId: string): Promise<void> {
    const nodes = await this.getVisibleNodes();
    const targetNode = nodes.find(node => node.id === nodeId);

    if (!targetNode) {
      throw new Error(`Node with ID ${nodeId} not found or not visible`);
    }

    await this.clickNodeAtPosition(targetNode.x, targetNode.y);
  }

  /**
   * Test zoom functionality
   */
  async testZoom(scale: number): Promise<void> {
    const canvasLocator = this.page.locator('canvas').first();
    const box = await canvasLocator.boundingBox();

    if (!box) throw new Error('Canvas not found');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Zoom using wheel events
    if (scale > 1) {
      // Zoom in
      await this.page.mouse.wheel(0, -100);
    } else {
      // Zoom out
      await this.page.mouse.wheel(0, 100);
    }

    await this.page.waitForTimeout(500); // Wait for zoom animation
  }

  /**
   * Test pan functionality
   */
  async testPan(deltaX: number, deltaY: number): Promise<void> {
    const canvasLocator = this.page.locator('canvas').first();
    const box = await canvasLocator.boundingBox();

    if (!box) throw new Error('Canvas not found');

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX + deltaX;
    const endY = startY + deltaY;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY, { steps: 10 });
    await this.page.mouse.up();

    await this.page.waitForTimeout(300); // Wait for pan animation
  }

  /**
   * Wait for simulation to stabilize
   */
  async waitForSimulationStable(timeout: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isStable = await this.page.evaluate(() => {
        // @ts-ignore
        const simulation = window.d3Simulation;
        return simulation ? simulation.alpha() < 0.1 : true;
      });

      if (isStable) return;

      await this.page.waitForTimeout(100);
    }

    throw new Error('Simulation did not stabilize within timeout');
  }

  /**
   * Test graph performance under load
   */
  async measurePerformance(duration: number = 5000): Promise<{
    averageFrameRate: number;
    minFrameRate: number;
    maxFrameRate: number;
    averageRenderTime: number;
    droppedFrames: number;
  }> {
    await this.page.evaluate((duration) => {
      // @ts-ignore - Setup performance monitoring
      window.performanceMetrics = {
        frameRates: [],
        renderTimes: [],
        startTime: performance.now(),
        duration
      };
    }, duration);

    // Start performance monitoring
    await this.page.evaluate(() => {
      const metrics = window.performanceMetrics;
      let lastTime = performance.now();
      let frameCount = 0;

      const measureFrame = () => {
        const now = performance.now();
        const deltaTime = now - lastTime;
        const frameRate = 1000 / deltaTime;

        metrics.frameRates.push(frameRate);
        metrics.renderTimes.push(deltaTime);

        lastTime = now;
        frameCount++;

        if (now - metrics.startTime < metrics.duration) {
          requestAnimationFrame(measureFrame);
        }
      };

      requestAnimationFrame(measureFrame);
    });

    // Wait for measurement to complete
    await this.page.waitForTimeout(duration + 1000);

    return await this.page.evaluate(() => {
      const metrics = window.performanceMetrics;
      const frameRates = metrics.frameRates;
      const renderTimes = metrics.renderTimes;

      const averageFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
      const minFrameRate = Math.min(...frameRates);
      const maxFrameRate = Math.max(...frameRates);
      const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const droppedFrames = frameRates.filter(rate => rate < 30).length;

      return {
        averageFrameRate: Math.round(averageFrameRate * 100) / 100,
        minFrameRate: Math.round(minFrameRate * 100) / 100,
        maxFrameRate: Math.round(maxFrameRate * 100) / 100,
        averageRenderTime: Math.round(averageRenderTime * 100) / 100,
        droppedFrames
      };
    });
  }

  /**
   * Take a screenshot of the graph canvas only
   */
  async screenshotCanvas(path?: string): Promise<Buffer> {
    const canvas = this.page.locator('canvas').first();
    return await canvas.screenshot({ path, type: 'png' });
  }

  /**
   * Verify graph elements are rendered correctly
   */
  async verifyGraphRendering(): Promise<void> {
    const metrics = await this.getGraphMetrics();
    const pixiInfo = await this.getPixiInfo();

    // Verify WebGL is working
    expect(pixiInfo.webgl).toBe(true);

    // Verify PIXI application is initialized
    expect(pixiInfo.version).not.toBe('unknown');

    // Verify nodes are rendered
    expect(metrics.visibleNodes).toBeGreaterThan(0);

    // Verify reasonable frame rate
    expect(metrics.frameRate).toBeGreaterThan(20);
  }

  /**
   * Wait for graph data to load
   */
  async waitForGraphData(minNodes: number = 1, timeout: number = 15000): Promise<void> {
    await this.page.waitForFunction(
      (minNodes) => {
        const metrics = window.graphPerformance || {};
        return metrics.nodeCount >= minNodes;
      },
      minNodes,
      { timeout }
    );
  }

  /**
   * Simulate high-stress interaction
   */
  async stressTestInteraction(iterations: number = 50): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      // Random zoom
      const zoomDirection = Math.random() > 0.5 ? -100 : 100;
      await this.page.mouse.wheel(0, zoomDirection);

      // Random pan
      const deltaX = (Math.random() - 0.5) * 200;
      const deltaY = (Math.random() - 0.5) * 200;
      await this.testPan(deltaX, deltaY);

      // Brief pause between interactions
      await this.page.waitForTimeout(50);
    }
  }
}

/**
 * Custom expect matchers for graph testing
 */
export const graphExpect = {
  async toHaveMinimumFrameRate(page: Page, minFrameRate: number) {
    const helpers = new GraphVisualizationHelpers(page);
    const performance = await helpers.measurePerformance(2000);
    expect(performance.averageFrameRate).toBeGreaterThanOrEqual(minFrameRate);
  },

  async toRenderWithoutDroppedFrames(page: Page, maxDroppedFrames: number = 5) {
    const helpers = new GraphVisualizationHelpers(page);
    const performance = await helpers.measurePerformance(3000);
    expect(performance.droppedFrames).toBeLessThanOrEqual(maxDroppedFrames);
  },

  async toHaveWebGLEnabled(page: Page) {
    const helpers = new GraphVisualizationHelpers(page);
    const webglSupport = await helpers.checkWebGLSupport();
    expect(webglSupport).toBe(true);
  }
};