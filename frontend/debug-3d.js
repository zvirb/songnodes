// Debug script to check 3D mode issues
// Run this in browser console when visiting http://localhost:3007?mode=3d

function debug3DMode() {
  console.log('🔍 Debugging 3D Mode Issues...');

  // Check URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  console.log('1. URL Mode Parameter:', mode);

  // Check React component state
  const app = document.querySelector('#root');
  console.log('2. React App Element:', !!app);

  // Check for canvas elements
  const canvases = document.querySelectorAll('canvas');
  console.log('3. Canvas Elements Found:', canvases.length);
  canvases.forEach((canvas, i) => {
    console.log(`   Canvas ${i}:`, {
      width: canvas.width,
      height: canvas.height,
      style: canvas.style.cssText,
      parent: canvas.parentElement?.className
    });
  });

  // Check for waiting message
  const waitingMsg = document.querySelector('div:contains("Waiting for graph data")');
  console.log('4. Waiting Message Present:', !!waitingMsg);

  // Check debug overlay
  const debugOverlay = document.querySelector('.absolute.top-2.right-2');
  console.log('5. Debug Overlay:', debugOverlay?.textContent);

  // Check for Redux store (if available)
  const store = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || window.store;
  if (store) {
    const state = typeof store === 'function' ? store() : store.getState?.();
    if (state) {
      const graphState = state.graph || {};
      console.log('6. Redux Graph State:', {
        nodes: graphState.nodes?.length || 0,
        edges: graphState.edges?.length || 0,
        loading: graphState.loading,
        sampleNodes: graphState.nodes?.slice(0, 3).map(n => ({ id: n.id, type: n.type })) || []
      });
    }
  } else {
    console.log('6. Redux Store: Not found');
  }

  // Check for Three.js errors
  const threeErrors = [];
  const originalError = console.error;
  console.error = function(...args) {
    if (args.some(arg => String(arg).toLowerCase().includes('three'))) {
      threeErrors.push(args.join(' '));
    }
    return originalError.apply(console, args);
  };

  console.log('7. Three.js Errors:', threeErrors);

  // Check WebGL availability
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  console.log('8. WebGL Available:', !!gl);
  if (gl) {
    console.log('   WebGL Vendor:', gl.getParameter(gl.VENDOR));
    console.log('   WebGL Renderer:', gl.getParameter(gl.RENDERER));
  }

  console.log('✅ Debug complete - check results above');
}

// Auto-run if in browser
if (typeof window !== 'undefined') {
  debug3DMode();
}