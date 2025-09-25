#!/usr/bin/env node

/**
 * Test Setup Verification Script
 *
 * Verifies that the Playwright testing environment is properly configured
 * for WebGL/PIXI.js graph visualization testing.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function verifyTestSetup() {
  console.log('🔍 Verifying SongNodes Playwright Test Setup...\n');

  let allGood = true;
  const issues = [];

  // Check if Playwright is installed
  console.log('📦 Checking Playwright installation...');
  try {
    await import('@playwright/test');
    console.log('✅ Playwright test framework installed');
  } catch (error) {
    console.log('❌ Playwright test framework not found');
    issues.push('Run: npm install @playwright/test');
    allGood = false;
  }

  // Check test configuration
  console.log('\n⚙️ Checking test configuration...');
  const configPath = path.join(__dirname, 'playwright.config.ts');
  if (fs.existsSync(configPath)) {
    console.log('✅ Playwright configuration found');

    const config = fs.readFileSync(configPath, 'utf8');
    if (config.includes('webgl')) {
      console.log('✅ WebGL configuration present');
    } else {
      console.log('⚠️ WebGL configuration may be missing');
      issues.push('Verify WebGL browser flags in playwright.config.ts');
    }
  } else {
    console.log('❌ Playwright configuration not found');
    issues.push('Create playwright.config.ts');
    allGood = false;
  }

  // Check test directories
  console.log('\n📁 Checking test directory structure...');
  const requiredDirs = [
    'tests',
    'tests/e2e',
    'tests/utils',
    'tests/setup'
  ];

  requiredDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      console.log(`✅ ${dir}/ directory exists`);
    } else {
      console.log(`❌ ${dir}/ directory missing`);
      issues.push(`Create directory: ${dir}`);
      allGood = false;
    }
  });

  // Check test utilities
  console.log('\n🛠️ Checking test utilities...');
  const utilFiles = [
    'tests/utils/graph-test-helpers.ts',
    'tests/utils/performance-test-helpers.ts',
    'tests/utils/graph-helpers.ts'
  ];

  utilFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${path.basename(file)} exists`);
    } else {
      console.log(`❌ ${path.basename(file)} missing`);
      issues.push(`Create test utility: ${file}`);
      allGood = false;
    }
  });

  // Test WebGL support
  console.log('\n🎮 Testing WebGL support...');
  try {
    const browser = await chromium.launch({
      args: [
        '--enable-webgl',
        '--enable-webgl2-compute-context',
        '--enable-accelerated-2d-canvas',
        '--disable-web-security'
      ]
    });

    const page = await browser.newPage();

    const webglTest = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

      if (!gl) return { supported: false };

      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

      return {
        supported: true,
        version: gl.getParameter(gl.VERSION),
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown',
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        extensionCount: gl.getSupportedExtensions()?.length || 0
      };
    });

    await browser.close();

    if (webglTest.supported) {
      console.log('✅ WebGL support verified');
      console.log(`   Version: ${webglTest.version}`);
      console.log(`   Renderer: ${webglTest.renderer}`);
      console.log(`   Max Texture Size: ${webglTest.maxTextureSize}`);
      console.log(`   Extensions: ${webglTest.extensionCount}`);
    } else {
      console.log('❌ WebGL not supported');
      issues.push('WebGL support is required for graph visualization tests');
      allGood = false;
    }

  } catch (error) {
    console.log('❌ WebGL test failed:', error.message);
    issues.push('Browser launch failed - check Playwright installation');
    allGood = false;
  }

  // Test PIXI.js loading capability
  console.log('\n🎯 Testing PIXI.js compatibility...');
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Test if we can load PIXI.js from CDN
    const pixiTest = await page.evaluate(() => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pixi.js@8.4.0/dist/pixi.min.js';

        const timeout = setTimeout(() => {
          reject(new Error('Timeout loading PIXI.js'));
        }, 10000);

        script.onload = () => {
          clearTimeout(timeout);
          // @ts-ignore
          if (window.PIXI) {
            resolve({
              loaded: true,
              // @ts-ignore
              version: window.PIXI.VERSION || 'unknown',
              // @ts-ignore
              hasApplication: typeof window.PIXI.Application === 'function'
            });
          } else {
            resolve({ loaded: false });
          }
        };

        script.onerror = () => {
          clearTimeout(timeout);
          resolve({ loaded: false, error: 'Load error' });
        };

        document.head.appendChild(script);
      });
    });

    await browser.close();

    if (pixiTest.loaded) {
      console.log('✅ PIXI.js loading verified');
      console.log(`   Version: ${pixiTest.version}`);
      console.log(`   Application class: ${pixiTest.hasApplication}`);
    } else {
      console.log('⚠️ PIXI.js loading test failed');
      console.log('   This may affect PIXI.js compatibility tests');
    }

  } catch (error) {
    console.log('⚠️ PIXI.js test failed:', error.message);
  }

  // Check package.json scripts
  console.log('\n📜 Checking test scripts...');
  const packagePath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const scripts = packageJson.scripts || {};

    const expectedScripts = [
      'test',
      'test:graph',
      'test:webgl-stress',
      'test:pixi',
      'test:performance'
    ];

    let scriptsOk = true;
    expectedScripts.forEach(script => {
      if (scripts[script]) {
        console.log(`✅ ${script} script defined`);
      } else {
        console.log(`❌ ${script} script missing`);
        scriptsOk = false;
      }
    });

    if (scriptsOk) {
      console.log('✅ All test scripts configured');
    } else {
      issues.push('Add missing test scripts to package.json');
      allGood = false;
    }
  }

  // Final report
  console.log('\n' + '='.repeat(50));
  if (allGood) {
    console.log('🎉 Test setup verification PASSED!');
    console.log('\n✅ Your Playwright testing environment is ready for WebGL graph visualization testing');
    console.log('\nNext steps:');
    console.log('  1. Start your development server: npm run dev');
    console.log('  2. Run the test suite: npm test');
    console.log('  3. Try specific test categories:');
    console.log('     - npm run test:graph (core functionality)');
    console.log('     - npm run test:performance (benchmarks)');
    console.log('     - npm run test:webgl-stress (stress tests)');
  } else {
    console.log('❌ Test setup verification FAILED');
    console.log('\n🔧 Issues to fix:');
    issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
    console.log('\n📖 See PLAYWRIGHT_TESTING_GUIDE.md for detailed setup instructions');
  }

  console.log('='.repeat(50));
  return allGood;
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyTestSetup().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

export { verifyTestSetup };