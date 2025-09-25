import { FullConfig, chromium } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting SongNodes WebGL E2E Test Setup...');

  // Ensure test directories exist
  const fs = require('fs');
  const path = require('path');

  const testDirs = [
    'tests/reports',
    'tests/reports/html',
    'tests/screenshots',
    'tests/screenshots/graph',
    'tests/screenshots/interactions',
    'tests/screenshots/performance',
    'tests/screenshots/visual-regression',
    'test-results',
    'test-results/screenshots',
    'test-results/screenshots/graph',
  ];

  testDirs.forEach(dir => {
    const fullPath = path.resolve(dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });

  console.log('✅ Test directories created');

  // Verify WebGL support in test environment
  console.log('🔍 Verifying WebGL support for graph visualization...');
  const browser = await chromium.launch({
    args: [
      '--enable-webgl',
      '--enable-webgl2-compute-context',
      '--enable-accelerated-2d-canvas',
      '--enable-gpu-rasterization',
      '--force-color-profile=srgb',
      '--disable-software-rasterizer',
    ],
  });

  const page = await browser.newPage();

  try {
    const webglInfo = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!gl) return { supported: false };

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

      return {
        supported: true,
        version: gl.getParameter(gl.VERSION),
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown',
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        extensions: gl.getSupportedExtensions()?.length || 0
      };
    });

    if (webglInfo.supported) {
      console.log('✅ WebGL Support Verified:');
      console.log(`   Version: ${webglInfo.version}`);
      console.log(`   Renderer: ${webglInfo.renderer}`);
      console.log(`   Max Texture Size: ${webglInfo.maxTextureSize}`);
      console.log(`   Extensions: ${webglInfo.extensions}`);

      // Store WebGL info for tests
      fs.writeFileSync(
        path.resolve('test-results', 'webgl-info.json'),
        JSON.stringify(webglInfo, null, 2)
      );
    } else {
      console.warn('⚠️ WebGL not supported - some tests may fail');
    }

  } catch (error) {
    console.warn('⚠️ WebGL verification failed:', error.message);
  } finally {
    await browser.close();
  }

  console.log('🎵 SongNodes WebGL E2E Test Setup Complete');
}

export default globalSetup;