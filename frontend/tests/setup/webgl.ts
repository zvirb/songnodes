/**
 * Chromium flags for WebGL on machines without a usable GPU (CI runners, the
 * Playwright Docker image). SwiftShader gives the same software renderer
 * everywhere, so graph rendering and screenshots do not depend on the host GPU.
 */
export const CHROMIUM_GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--force-color-profile=srgb',
];
