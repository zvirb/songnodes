/**
 * WebGL Detection and Compatibility Utilities
 * Provides comprehensive WebGL support detection for 3D visualization
 */

export interface WebGLInfo {
  isWebGLAvailable: boolean;
  isWebGL2Available: boolean;
  renderer: string | null;
  vendor: string | null;
  version: string | null;
  maxTextureSize: number | null;
  maxVertexTextures: number | null;
  error: string | null;
}

/**
 * Detect WebGL availability and capabilities
 */
export function detectWebGL(): WebGLInfo {
  const result: WebGLInfo = {
    isWebGLAvailable: false,
    isWebGL2Available: false,
    renderer: null,
    vendor: null,
    version: null,
    maxTextureSize: null,
    maxVertexTextures: null,
    error: null
  };

  try {
    // Create canvas for testing
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    // Test WebGL 1.0
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (gl) {
      result.isWebGLAvailable = true;

      // Get WebGL info
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        result.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        result.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      } else {
        result.renderer = gl.getParameter(gl.RENDERER);
        result.vendor = gl.getParameter(gl.VENDOR);
      }

      result.version = gl.getParameter(gl.VERSION);
      result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      result.maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);

      // Test WebGL 2.0
      const gl2 = canvas.getContext('webgl2');
      if (gl2) {
        result.isWebGL2Available = true;
      }
    } else {
      result.error = 'WebGL context could not be created';
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown WebGL detection error';
  }

  return result;
}

/**
 * Check if the current environment supports Three.js requirements
 */
export function isThreeJSCompatible(): boolean {
  const webglInfo = detectWebGL();

  if (!webglInfo.isWebGLAvailable) {
    return false;
  }

  // Check minimum requirements for Three.js
  if (webglInfo.maxTextureSize && webglInfo.maxTextureSize < 1024) {
    return false;
  }

  // Check for software rendering (usually indicates poor performance)
  if (webglInfo.renderer && webglInfo.renderer.toLowerCase().includes('software')) {
    console.warn('🌐 WebGL is using software rendering - 3D performance may be poor');
  }

  return true;
}

/**
 * Get a human-readable WebGL status message
 */
export function getWebGLStatusMessage(): string {
  const webglInfo = detectWebGL();

  if (!webglInfo.isWebGLAvailable) {
    return `❌ WebGL not available: ${webglInfo.error || 'Unknown reason'}`;
  }

  const messages = [
    `✅ WebGL ${webglInfo.isWebGL2Available ? '2.0' : '1.0'} available`,
    `Renderer: ${webglInfo.renderer || 'Unknown'}`,
    `Max texture size: ${webglInfo.maxTextureSize || 'Unknown'}`
  ];

  return messages.join(' | ');
}

/**
 * Log comprehensive WebGL diagnostic information
 */
export function logWebGLDiagnostics(): void {
  const webglInfo = detectWebGL();

  console.group('🌐 WebGL Diagnostics');
  console.log('WebGL Available:', webglInfo.isWebGLAvailable);
  console.log('WebGL 2.0 Available:', webglInfo.isWebGL2Available);
  console.log('Vendor:', webglInfo.vendor);
  console.log('Renderer:', webglInfo.renderer);
  console.log('Version:', webglInfo.version);
  console.log('Max Texture Size:', webglInfo.maxTextureSize);
  console.log('Max Vertex Textures:', webglInfo.maxVertexTextures);
  console.log('Three.js Compatible:', isThreeJSCompatible());

  if (webglInfo.error) {
    console.error('Error:', webglInfo.error);
  }

  console.groupEnd();
}