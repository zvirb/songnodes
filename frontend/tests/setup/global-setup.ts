import { FullConfig, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { CHROMIUM_GL_ARGS } from './webgl';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting SongNodes WebGL E2E Test Setup...');

  // Ensure test directories exist

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
  const browser = await chromium.launch({ args: CHROMIUM_GL_ARGS });

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
      throw new Error(
        'WebGL is unavailable in Chromium with ' + CHROMIUM_GL_ARGS.join(' ') +
        '. The graph cannot render, so the suite would fail for the wrong reason. ' +
        'Check that the Playwright Chromium build includes SwiftShader.'
      );
    }
  } finally {
    await browser.close();
  }

  console.log('🎵 SongNodes WebGL E2E Test Setup Complete');
}

export default globalSetup;