import '@testing-library/jest-dom';
import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import 'jest-axe/extend-expect';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock global objects
beforeAll(() => {
  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }));

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock HTMLCanvasElement methods for WebGL/Canvas testing
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType) => {
    if (contextType === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Array(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => ({ data: new Array(4) })),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      };
    }
    
    if (contextType === 'webgl' || contextType === 'webgl2') {
      return {
        clearColor: vi.fn(),
        clear: vi.fn(),
        drawElements: vi.fn(),
        drawArrays: vi.fn(),
        enable: vi.fn(),
        disable: vi.fn(),
        getParameter: vi.fn(),
        createShader: vi.fn(),
        shaderSource: vi.fn(),
        compileShader: vi.fn(),
        createProgram: vi.fn(),
        attachShader: vi.fn(),
        linkProgram: vi.fn(),
        useProgram: vi.fn(),
        getShaderParameter: vi.fn(() => true),
        getProgramParameter: vi.fn(() => true),
        getShaderInfoLog: vi.fn(() => ''),
        getProgramInfoLog: vi.fn(() => ''),
        createBuffer: vi.fn(),
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        getAttribLocation: vi.fn(() => 0),
        getUniformLocation: vi.fn(() => 0),
        enableVertexAttribArray: vi.fn(),
        vertexAttribPointer: vi.fn(),
        uniform1f: vi.fn(),
        uniform2f: vi.fn(),
        uniform3f: vi.fn(),
        uniform4f: vi.fn(),
        uniformMatrix4fv: vi.fn(),
        viewport: vi.fn(),
        deleteBuffer: vi.fn(),
        deleteProgram: vi.fn(),
        deleteShader: vi.fn(),
      };
    }
    
    return null;
  });

  // Mock WebGL context
  window.WebGLRenderingContext = vi.fn().mockImplementation(() => ({}));
  window.WebGL2RenderingContext = vi.fn().mockImplementation(() => ({}));

  // Mock performance API
  Object.defineProperty(window, 'performance', {
    writable: true,
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      observer: vi.fn(),
    },
  });

  // Mock requestAnimationFrame
  global.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(callback, 16); // ~60fps
  });

  global.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
  });

  // Mock Worker
  global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  // Mock WebSocket
  global.WebSocket = vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
  }));

  // Mock navigator.hardwareConcurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    writable: true,
    value: 4,
  });

  // Mock clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    writable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  });

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: localStorageMock,
  });

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    writable: true,
    value: localStorageMock,
  });
});

afterAll(() => {
  // Cleanup any global mocks if needed
});

// Global test utilities
export const createMockNode = (overrides = {}) => ({
  id: 'test-node-1',
  x: 100,
  y: 100,
  name: 'Test Node',
  type: 'track',
  ...overrides,
});

export const createMockEdge = (overrides = {}) => ({
  source: 'test-node-1',
  target: 'test-node-2',
  weight: 1.0,
  type: 'similarity',
  ...overrides,
});

export const createMockGraphData = (nodeCount = 5, edgeCount = 4) => {
  const nodes = Array.from({ length: nodeCount }, (_, i) => createMockNode({
    id: `test-node-${i + 1}`,
    name: `Test Node ${i + 1}`,
    x: Math.random() * 1000,
    y: Math.random() * 1000,
  }));

  const edges = Array.from({ length: edgeCount }, (_, i) => createMockEdge({
    source: `test-node-${i + 1}`,
    target: `test-node-${(i + 1) % nodeCount + 1}`,
  }));

  return { nodes, edges };
};

// Performance test utilities
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Accessibility test utilities
export const waitForAccessibilityTree = () => {
  return new Promise(resolve => setTimeout(resolve, 100));
};