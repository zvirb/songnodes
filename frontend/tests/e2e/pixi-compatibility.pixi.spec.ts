import { test, expect } from '@playwright/test';
import { GraphTestUtils } from '../utils/graph-helpers';

/**
 * PIXI.js Compatibility and Feature Tests
 *
 * Tests specific PIXI.js features, compatibility, and integration
 * with the SongNodes graph visualization system.
 */

test.describe('PIXI.js Compatibility', () => {
  let graphUtils: GraphTestUtils;

  test.beforeEach(async ({ page }) => {
    graphUtils = new GraphTestUtils(page);

    await page.goto('/');
    await graphUtils.waitForGraphInitialization();
  });

  test('should initialize PIXI application correctly', async ({ page }) => {
    await test.step('Verify PIXI.js version and setup', async () => {
      const pixiInfo = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI) return null;

        return {
          // @ts-ignore
          version: PIXI.VERSION,
          // @ts-ignore
          utils: typeof PIXI.utils,
          // @ts-ignore
          graphics: typeof PIXI.Graphics,
          // @ts-ignore
          container: typeof PIXI.Container,
          // @ts-ignore
          application: typeof PIXI.Application
        };
      });

      expect(pixiInfo).toBeTruthy();
      expect(pixiInfo.version).toMatch(/^8\.\d+\.\d+/); // Should be PIXI v8
      expect(pixiInfo.graphics).toBe('function');
      expect(pixiInfo.container).toBe('function');
      expect(pixiInfo.application).toBe('function');

      console.log('PIXI.js version:', pixiInfo.version);
    });

    await test.step('Verify PIXI application instance', async () => {
      const appInfo = await page.evaluate(() => {
        // @ts-ignore
        const app = window.pixiApp;
        if (!app) return null;

        return {
          hasStage: !!app.stage,
          hasRenderer: !!app.renderer,
          rendererType: app.renderer?.type,
          stageChildren: app.stage?.children?.length || 0,
          canvasExists: !!app.view,
          rendererWidth: app.renderer?.width,
          rendererHeight: app.renderer?.height
        };
      });

      expect(appInfo).toBeTruthy();
      expect(appInfo.hasStage).toBe(true);
      expect(appInfo.hasRenderer).toBe(true);
      expect(appInfo.rendererType).toBe(1); // WebGL renderer
      expect(appInfo.canvasExists).toBe(true);
      expect(appInfo.rendererWidth).toBeGreaterThan(0);
      expect(appInfo.rendererHeight).toBeGreaterThan(0);

      console.log('PIXI Application Info:', appInfo);
    });
  });

  test('should support WebGL rendering features', async ({ page }) => {
    await test.step('Verify WebGL renderer capabilities', async () => {
      const webglCapabilities = await page.evaluate(() => {
        // @ts-ignore
        const app = window.pixiApp;
        if (!app?.renderer?.gl) return null;

        const gl = app.renderer.gl;
        return {
          version: gl.getParameter(gl.VERSION),
          shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
          vendor: gl.getParameter(gl.VENDOR),
          renderer: gl.getParameter(gl.RENDERER),
          maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          maxVertexAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
          maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
          maxVaryingVectors: gl.getParameter(gl.MAX_VARYING_VECTORS),
          supportedExtensions: gl.getSupportedExtensions()?.length || 0
        };
      });

      expect(webglCapabilities).toBeTruthy();
      expect(webglCapabilities.version).toContain('WebGL');
      expect(webglCapabilities.maxTextureSize).toBeGreaterThanOrEqual(2048);
      expect(webglCapabilities.maxVertexAttributes).toBeGreaterThanOrEqual(8);
      expect(webglCapabilities.supportedExtensions).toBeGreaterThan(0);

      console.log('WebGL Capabilities:', webglCapabilities);
    });

    await test.step('Test WebGL extensions support', async () => {
      const extensionSupport = await page.evaluate(() => {
        // @ts-ignore
        const app = window.pixiApp;
        if (!app?.renderer?.gl) return null;

        const gl = app.renderer.gl;
        const extensions = {
          OES_element_index_uint: !!gl.getExtension('OES_element_index_uint'),
          OES_texture_float: !!gl.getExtension('OES_texture_float'),
          OES_texture_half_float: !!gl.getExtension('OES_texture_half_float'),
          EXT_texture_filter_anisotropic: !!gl.getExtension('EXT_texture_filter_anisotropic'),
          WEBGL_depth_texture: !!gl.getExtension('WEBGL_depth_texture'),
          WEBGL_lose_context: !!gl.getExtension('WEBGL_lose_context')
        };

        return extensions;
      });

      expect(extensionSupport).toBeTruthy();
      expect(extensionSupport.OES_element_index_uint).toBe(true); // Important for large geometries
      expect(extensionSupport.WEBGL_lose_context).toBe(true); // Important for context recovery

      console.log('WebGL Extensions:', extensionSupport);
    });
  });

  test('should handle PIXI graphics objects correctly', async ({ page }) => {
    await test.step('Verify Graphics objects creation and rendering', async () => {
      const graphicsTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;
        // @ts-ignore
        const graphics = new PIXI.Graphics();

        // Draw a test circle
        graphics.circle(50, 50, 25).fill(0xFF0000);

        // Add to stage
        app.stage.addChild(graphics);

        // Render one frame
        app.render();

        const result = {
          graphicsCreated: true,
          hasPosition: graphics.x !== undefined && graphics.y !== undefined,
          hasScale: graphics.scale?.x !== undefined,
          hasRotation: graphics.rotation !== undefined,
          isVisible: graphics.visible,
          inStage: app.stage.children.includes(graphics)
        };

        // Clean up
        app.stage.removeChild(graphics);

        return result;
      });

      expect(graphicsTest).toBeTruthy();
      expect(graphicsTest.graphicsCreated).toBe(true);
      expect(graphicsTest.hasPosition).toBe(true);
      expect(graphicsTest.hasScale).toBe(true);
      expect(graphicsTest.hasRotation).toBe(true);
      expect(graphicsTest.isVisible).toBe(true);
      expect(graphicsTest.inStage).toBe(true);
    });

    await test.step('Test Text objects and font rendering', async () => {
      const textTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;
        // @ts-ignore
        const text = new PIXI.Text({
          text: 'Test Text',
          style: {
            fontSize: 16,
            fill: 0xFFFFFF,
            fontFamily: 'Arial'
          }
        });

        app.stage.addChild(text);
        app.render();

        const result = {
          textCreated: true,
          hasText: text.text === 'Test Text',
          hasStyle: !!text.style,
          hasWidth: text.width > 0,
          hasHeight: text.height > 0
        };

        app.stage.removeChild(text);
        return result;
      });

      expect(textTest).toBeTruthy();
      expect(textTest.textCreated).toBe(true);
      expect(textTest.hasText).toBe(true);
      expect(textTest.hasStyle).toBe(true);
      expect(textTest.hasWidth).toBe(true);
      expect(textTest.hasHeight).toBe(true);
    });
  });

  test('should support PIXI container hierarchy', async ({ page }) => {
    await test.step('Test container nesting and transformations', async () => {
      const containerTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;
        // @ts-ignore
        const parentContainer = new PIXI.Container();
        // @ts-ignore
        const childContainer = new PIXI.Container();

        // Set up hierarchy
        parentContainer.addChild(childContainer);
        app.stage.addChild(parentContainer);

        // Test transformations
        parentContainer.x = 100;
        parentContainer.y = 100;
        parentContainer.scale.set(2, 2);
        parentContainer.rotation = Math.PI / 4;

        childContainer.x = 50;
        childContainer.y = 50;

        const result = {
          hierarchyCreated: true,
          parentInStage: app.stage.children.includes(parentContainer),
          childInParent: parentContainer.children.includes(childContainer),
          parentTransformed: parentContainer.x === 100 && parentContainer.y === 100,
          parentScaled: parentContainer.scale.x === 2,
          parentRotated: Math.abs(parentContainer.rotation - Math.PI / 4) < 0.01,
          childPositioned: childContainer.x === 50 && childContainer.y === 50
        };

        // Clean up
        app.stage.removeChild(parentContainer);

        return result;
      });

      expect(containerTest).toBeTruthy();
      expect(containerTest.hierarchyCreated).toBe(true);
      expect(containerTest.parentInStage).toBe(true);
      expect(containerTest.childInParent).toBe(true);
      expect(containerTest.parentTransformed).toBe(true);
      expect(containerTest.parentScaled).toBe(true);
      expect(containerTest.parentRotated).toBe(true);
      expect(containerTest.childPositioned).toBe(true);
    });
  });

  test('should handle PIXI interaction events', async ({ page }) => {
    await test.step('Test event handling setup', async () => {
      const interactionTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;
        // @ts-ignore
        const graphics = new PIXI.Graphics();

        graphics.circle(50, 50, 25).fill(0x00FF00);
        graphics.eventMode = 'static';
        graphics.cursor = 'pointer';

        let eventFired = false;
        graphics.on('pointerdown', () => {
          eventFired = true;
        });

        app.stage.addChild(graphics);

        const result = {
          interactionSetup: true,
          hasEventMode: graphics.eventMode === 'static',
          hasCursor: graphics.cursor === 'pointer',
          hasEventListener: graphics.listenerCount('pointerdown') > 0
        };

        app.stage.removeChild(graphics);

        return result;
      });

      expect(interactionTest).toBeTruthy();
      expect(interactionTest.interactionSetup).toBe(true);
      expect(interactionTest.hasEventMode).toBe(true);
      expect(interactionTest.hasCursor).toBe(true);
      expect(interactionTest.hasEventListener).toBe(true);
    });
  });

  test('should support PIXI filters and effects', async ({ page }) => {
    await test.step('Test filter application', async () => {
      const filterTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;
        // @ts-ignore
        const graphics = new PIXI.Graphics();

        graphics.circle(50, 50, 25).fill(0x0000FF);

        // Test blur filter if available
        // @ts-ignore
        if (PIXI.BlurFilter) {
          // @ts-ignore
          const blurFilter = new PIXI.BlurFilter(2);
          graphics.filters = [blurFilter];
        }

        app.stage.addChild(graphics);

        const result = {
          filtersSupported: !!graphics.filters,
          // @ts-ignore
          blurFilterAvailable: !!PIXI.BlurFilter,
          graphicsRenderable: graphics.renderable
        };

        app.stage.removeChild(graphics);

        return result;
      });

      expect(filterTest).toBeTruthy();
      expect(filterTest.graphicsRenderable).toBe(true);

      console.log('Filter support:', filterTest);
    });
  });

  test('should handle PIXI texture management', async ({ page }) => {
    await test.step('Test texture creation and management', async () => {
      const textureTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;

        // Create a render texture
        // @ts-ignore
        const renderTexture = PIXI.RenderTexture.create({
          width: 100,
          height: 100
        });

        // @ts-ignore
        const graphics = new PIXI.Graphics();
        graphics.circle(50, 50, 25).fill(0xFFFF00);

        // Render graphics to texture
        app.renderer.render(graphics, { renderTexture });

        const result = {
          renderTextureCreated: !!renderTexture,
          textureWidth: renderTexture.width,
          textureHeight: renderTexture.height,
          hasBaseTexture: !!renderTexture.baseTexture
        };

        // Clean up
        renderTexture.destroy();

        return result;
      });

      expect(textureTest).toBeTruthy();
      expect(textureTest.renderTextureCreated).toBe(true);
      expect(textureTest.textureWidth).toBe(100);
      expect(textureTest.textureHeight).toBe(100);
      expect(textureTest.hasBaseTexture).toBe(true);
    });
  });

  test('should handle PIXI performance optimizations', async ({ page }) => {
    await test.step('Test batching and optimization features', async () => {
      const optimizationTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;
        const renderer = app.renderer;

        // Test batch renderer
        const batchInfo = {
          hasBatch: !!renderer.batch,
          hasGeometry: !!renderer.geometry,
          hasState: !!renderer.state,
          maxTextures: renderer.batch?.maxTextures || 0
        };

        // Test culling
        // @ts-ignore
        const container = new PIXI.Container();
        container.cullable = true;

        const cullTest = {
          cullableSupported: container.cullable === true
        };

        return {
          batch: batchInfo,
          culling: cullTest
        };
      });

      expect(optimizationTest).toBeTruthy();
      expect(optimizationTest.batch.hasBatch).toBe(true);

      console.log('PIXI Optimization Features:', optimizationTest);
    });
  });

  test('should handle PIXI resource cleanup', async ({ page }) => {
    await test.step('Test proper resource disposal', async () => {
      const cleanupTest = await page.evaluate(() => {
        // @ts-ignore
        if (!window.PIXI || !window.pixiApp) return null;

        // @ts-ignore
        const app = window.pixiApp;

        // Create objects to test cleanup
        // @ts-ignore
        const graphics = new PIXI.Graphics();
        graphics.circle(50, 50, 25).fill(0xFF00FF);

        // @ts-ignore
        const container = new PIXI.Container();
        container.addChild(graphics);

        app.stage.addChild(container);

        // Test cleanup
        const beforeCleanup = {
          stageChildren: app.stage.children.length,
          containerChildren: container.children.length
        };

        // Clean up
        container.removeChild(graphics);
        app.stage.removeChild(container);

        graphics.destroy();
        container.destroy();

        const afterCleanup = {
          stageChildren: app.stage.children.length,
          graphicsDestroyed: graphics.destroyed,
          containerDestroyed: container.destroyed
        };

        return {
          before: beforeCleanup,
          after: afterCleanup
        };
      });

      expect(cleanupTest).toBeTruthy();
      expect(cleanupTest.after.stageChildren).toBeLessThan(cleanupTest.before.stageChildren);
      expect(cleanupTest.after.graphicsDestroyed).toBe(true);
      expect(cleanupTest.after.containerDestroyed).toBe(true);

      console.log('Resource cleanup test:', cleanupTest);
    });
  });
});