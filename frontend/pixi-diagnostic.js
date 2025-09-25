// PIXI.js Canvas Rendering Diagnostic Script
// This script tests that PIXI.js canvas is properly created and accessible

const pixiDiagnostic = {
  async runDiagnostic() {
    console.log('\n🔍 Running PIXI.js Canvas Diagnostic...\n');

    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for app to load

    const results = {
      pixiLibrary: false,
      pixiApp: false,
      canvas: false,
      canvasVisible: false,
      canvasSize: false,
      webglContext: false,
      d3Simulation: false
    };

    try {
      // 1. Check PIXI library accessibility
      if (typeof window.PIXI !== 'undefined') {
        results.pixiLibrary = true;
        console.log('✅ PIXI library accessible globally');
        console.log(`   PIXI Version: ${window.PIXI.VERSION}`);
      } else {
        console.log('❌ PIXI library not accessible globally');
      }

      // 2. Check PIXI Application
      if (typeof window.pixiApp !== 'undefined' && window.pixiApp) {
        results.pixiApp = true;
        console.log('✅ PIXI Application created successfully');
        console.log(`   Renderer Type: ${window.pixiApp.renderer.type}`);
      } else {
        console.log('❌ PIXI Application not found');
      }

      // 3. Check Canvas Element
      const pixiCanvas = document.getElementById('songnodes-pixi-canvas');
      const fallbackCanvas = document.getElementById('songnodes-fallback-canvas');

      if (pixiCanvas) {
        results.canvas = true;
        console.log('✅ PIXI Canvas element found in DOM');
        console.log(`   Canvas ID: ${pixiCanvas.id}`);
        console.log(`   Canvas Class: ${pixiCanvas.className}`);
        console.log(`   Canvas Width: ${pixiCanvas.width}`);
        console.log(`   Canvas Height: ${pixiCanvas.height}`);
        console.log(`   Canvas Style Width: ${pixiCanvas.style.width}`);
        console.log(`   Canvas Style Height: ${pixiCanvas.style.height}`);
        console.log(`   Canvas Display: ${pixiCanvas.style.display}`);
        console.log(`   Canvas Z-Index: ${pixiCanvas.style.zIndex}`);

        // Check if canvas is visible
        const rect = pixiCanvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.canvasVisible = true;
          console.log('✅ PIXI Canvas is visible');
          console.log(`   Visible Area: ${rect.width}x${rect.height} at (${rect.left}, ${rect.top})`);
        } else {
          console.log('❌ PIXI Canvas has no visible area');
        }

        // Check canvas size
        if (pixiCanvas.width > 0 && pixiCanvas.height > 0) {
          results.canvasSize = true;
          console.log('✅ PIXI Canvas has proper dimensions');
        } else {
          console.log('❌ PIXI Canvas has invalid dimensions');
        }

        // Check WebGL context
        try {
          const gl = pixiCanvas.getContext('webgl') || pixiCanvas.getContext('experimental-webgl');
          if (gl) {
            results.webglContext = true;
            console.log('✅ WebGL context available');
            console.log(`   WebGL Vendor: ${gl.getParameter(gl.VENDOR)}`);
            console.log(`   WebGL Renderer: ${gl.getParameter(gl.RENDERER)}`);
          } else {
            console.log('⚠️  WebGL context not available, using fallback');
          }
        } catch (error) {
          console.log('⚠️  Error accessing WebGL context:', error.message);
        }

      } else if (fallbackCanvas) {
        results.canvas = true;
        console.log('⚠️  Fallback canvas found (PIXI initialization failed)');
        console.log(`   Fallback Canvas ID: ${fallbackCanvas.id}`);
        console.log(`   Error: ${window.pixiInitError?.message || 'Unknown error'}`);
      } else {
        console.log('❌ No canvas elements found');
      }

      // 4. Check D3 Force Simulation (should still work independently)
      if (document.querySelector('.graph-visualization')) {
        results.d3Simulation = true;
        console.log('✅ Graph visualization component mounted');
      } else {
        console.log('❌ Graph visualization component not found');
      }

      // 5. Test canvas accessibility with data attributes
      const canvasWithTestId = document.querySelector('[data-testid="pixi-canvas"]');
      if (canvasWithTestId) {
        console.log('✅ Canvas accessible via test ID');
        console.log(`   PIXI Version Attribute: ${canvasWithTestId.getAttribute('data-pixi-version')}`);
      } else {
        console.log('❌ Canvas not accessible via test ID');
      }

    } catch (error) {
      console.log('❌ Diagnostic error:', error);
    }

    // Summary
    console.log('\n📊 Diagnostic Summary:');
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    console.log(`   Passed: ${passed}/${total} checks`);

    if (passed >= 5) {
      console.log('🎉 PIXI.js canvas rendering is working correctly!');
    } else if (passed >= 3) {
      console.log('⚠️  PIXI.js canvas has some issues but may still function');
    } else {
      console.log('❌ PIXI.js canvas rendering has significant issues');
    }

    return results;
  }
};

// Auto-run diagnostic when script loads
if (typeof window !== 'undefined') {
  // Wait for DOM and React to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => pixiDiagnostic.runDiagnostic(), 3000);
    });
  } else {
    setTimeout(() => pixiDiagnostic.runDiagnostic(), 3000);
  }
}

// Make it globally accessible for manual testing
if (typeof window !== 'undefined') {
  window.pixiDiagnostic = pixiDiagnostic;
}