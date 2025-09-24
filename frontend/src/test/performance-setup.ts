import { beforeEach, afterEach, vi } from 'vitest';

// Performance testing setup
let performanceEntries: PerformanceEntry[] = [];
const performanceMarks: Map<string, number> = new Map();
const performanceMeasures: Map<string, { start: number; duration: number }> = new Map();

beforeEach(() => {
  // Reset performance tracking
  performanceEntries = [];
  performanceMarks.clear();
  performanceMeasures.clear();

  // Enhanced performance API mock
  Object.defineProperty(window, 'performance', {
    writable: true,
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn((name: string) => {
        const timestamp = Date.now();
        performanceMarks.set(name, timestamp);
        const entry = {
          name,
          entryType: 'mark',
          startTime: timestamp,
          duration: 0,
        };
        performanceEntries.push(entry);
        return entry;
      }),
      measure: vi.fn((name: string, startMark?: string, endMark?: string) => {
        const endTime = Date.now();
        const startTime = startMark ? performanceMarks.get(startMark) || endTime : endTime;
        const duration = endTime - startTime;
        
        const measure = { start: startTime, duration };
        performanceMeasures.set(name, measure);
        
        const entry = {
          name,
          entryType: 'measure',
          startTime,
          duration,
        };
        performanceEntries.push(entry);
        return entry;
      }),
      getEntriesByType: vi.fn((type: string) => {
        return performanceEntries.filter(entry => entry.entryType === type);
      }),
      getEntriesByName: vi.fn((name: string) => {
        return performanceEntries.filter(entry => entry.name === name);
      }),
      clearMarks: vi.fn((name?: string) => {
        if (name) {
          performanceMarks.delete(name);
          performanceEntries = performanceEntries.filter(
            entry => !(entry.entryType === 'mark' && entry.name === name)
          );
        } else {
          performanceMarks.clear();
          performanceEntries = performanceEntries.filter(entry => entry.entryType !== 'mark');
        }
      }),
      clearMeasures: vi.fn((name?: string) => {
        if (name) {
          performanceMeasures.delete(name);
          performanceEntries = performanceEntries.filter(
            entry => !(entry.entryType === 'measure' && entry.name === name)
          );
        } else {
          performanceMeasures.clear();
          performanceEntries = performanceEntries.filter(entry => entry.entryType !== 'measure');
        }
      }),
      // Memory API
      memory: {
        usedJSHeapSize: 10000000, // 10MB
        totalJSHeapSize: 20000000, // 20MB
        jsHeapSizeLimit: 100000000, // 100MB
      },
      // Navigation timing
      navigation: {
        type: 0,
        redirectCount: 0,
      },
      // Timing API
      timing: {
        navigationStart: Date.now() - 1000,
        loadEventEnd: Date.now(),
        domContentLoadedEventEnd: Date.now() - 500,
      },
    },
  });

  // Mock PerformanceObserver
  global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn((options) => {
      // Simulate observing performance entries
      setTimeout(() => {
        const entries = performanceEntries.filter(entry => 
          options.entryTypes?.includes(entry.entryType)
        );
        if (entries.length > 0) {
          callback({ getEntries: () => entries });
        }
      }, 0);
    }),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  }));

  // Mock requestIdleCallback
  global.requestIdleCallback = vi.fn((callback, options) => {
    const deadline = {
      timeRemaining: () => Math.max(0, 16.67 - (Date.now() % 16.67)), // ~60fps
      didTimeout: false,
    };
    return setTimeout(() => callback(deadline), 0);
  });

  global.cancelIdleCallback = vi.fn((id) => {
    clearTimeout(id);
  });

  // Enhanced RAF with performance tracking
  let rafId = 0;
  const rafCallbacks: Map<number, { callback: FrameRequestCallback; startTime: number }> = new Map();
  
  global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const id = ++rafId;
    const startTime = performance.now();
    rafCallbacks.set(id, { callback, startTime });
    
    setTimeout(() => {
      const entry = rafCallbacks.get(id);
      if (entry) {
        const frameTime = performance.now() - entry.startTime;
        // Track frame timing
        performance.mark(`frame-${id}-start`);
        entry.callback(performance.now());
        performance.mark(`frame-${id}-end`);
        performance.measure(`frame-${id}`, `frame-${id}-start`, `frame-${id}-end`);
        rafCallbacks.delete(id);
      }
    }, 16); // ~60fps
    
    return id;
  });

  global.cancelAnimationFrame = vi.fn((id: number) => {
    rafCallbacks.delete(id);
  });

  // Mock intersection observer with performance tracking
  global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
    observe: vi.fn((element) => {
      // Simulate intersection after a delay
      setTimeout(() => {
        const entry = {
          target: element,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: element.getBoundingClientRect(),
          intersectionRect: element.getBoundingClientRect(),
          rootBounds: { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth },
          time: performance.now(),
        };
        callback([entry]);
      }, 10);
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock Web Workers with performance tracking
  global.Worker = vi.fn().mockImplementation((scriptURL) => {
    const worker = {
      postMessage: vi.fn((data) => {
        // Simulate worker processing time
        const startTime = performance.now();
        setTimeout(() => {
          const processingTime = performance.now() - startTime;
          worker.onmessage?.({ 
            data: { ...data, processingTime },
            type: 'message',
          } as any);
        }, 5); // Simulate 5ms processing time
      }),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onmessage: null as any,
      onerror: null as any,
    };
    return worker;
  });
});

afterEach(() => {
  // Clean up performance tracking
  performance.clearMarks();
  performance.clearMeasures();
  performanceEntries = [];
  performanceMarks.clear();
  performanceMeasures.clear();
});

// Performance testing utilities
export interface PerformanceThresholds {
  renderTime?: number;
  interactionTime?: number;
  memoryUsage?: number;
  fps?: number;
}

export const measureRenderTime = async (renderFn: () => Promise<void> | void): Promise<number> => {
  const startTime = performance.now();
  await renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};

export const measureMemoryUsage = (): { before: number; after: number; delta: number } => {
  const before = (performance as any).memory?.usedJSHeapSize || 0;
  
  // Force garbage collection if available (in test environment)
  if (global.gc) {
    global.gc();
  }
  
  const after = (performance as any).memory?.usedJSHeapSize || 0;
  
  return {
    before,
    after,
    delta: after - before,
  };
};

export const simulateSlowDevice = () => {
  // Simulate slower device by reducing RAF frequency
  const originalRAF = global.requestAnimationFrame;
  global.requestAnimationFrame = vi.fn((callback) => {
    return originalRAF(() => {
      // Add delay to simulate slower rendering
      setTimeout(() => callback(performance.now()), 8); // ~30fps instead of 60fps
    });
  });
  
  // Simulate limited hardware concurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    writable: true,
    value: 2,
  });
  
  // Simulate slower performance.now()
  const originalNow = performance.now;
  const slowdownFactor = 1.5;
  performance.now = vi.fn(() => originalNow() * slowdownFactor);
};

export const restoreNormalDevice = () => {
  // Restore normal RAF timing
  global.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(() => callback(performance.now()), 16); // 60fps
  });
  
  // Restore normal hardware concurrency
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    writable: true,
    value: 4,
  });
  
  // Restore normal performance timing
  performance.now = vi.fn(() => Date.now());
};

export const checkPerformanceThresholds = (
  metrics: Record<string, number>,
  thresholds: PerformanceThresholds
): { passed: boolean; failures: string[] } => {
  const failures: string[] = [];
  
  if (thresholds.renderTime && metrics.renderTime > thresholds.renderTime) {
    failures.push(`Render time ${metrics.renderTime}ms exceeds threshold ${thresholds.renderTime}ms`);
  }
  
  if (thresholds.interactionTime && metrics.interactionTime > thresholds.interactionTime) {
    failures.push(`Interaction time ${metrics.interactionTime}ms exceeds threshold ${thresholds.interactionTime}ms`);
  }
  
  if (thresholds.memoryUsage && metrics.memoryUsage > thresholds.memoryUsage) {
    failures.push(`Memory usage ${metrics.memoryUsage} bytes exceeds threshold ${thresholds.memoryUsage} bytes`);
  }
  
  if (thresholds.fps && metrics.fps < thresholds.fps) {
    failures.push(`FPS ${metrics.fps} is below threshold ${thresholds.fps}`);
  }
  
  return {
    passed: failures.length === 0,
    failures,
  };
};

export const simulateLargeDataset = (nodeCount: number) => {
  return {
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `perf-node-${i}`,
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      name: `Performance Test Node ${i}`,
      type: 'track',
    })),
    edges: Array.from({ length: Math.floor(nodeCount * 0.8) }, (_, i) => ({
      source: `perf-node-${i}`,
      target: `perf-node-${(i + 1) % nodeCount}`,
      weight: Math.random(),
      type: 'similarity',
    })),
  };
};

export const measureFrameRate = (duration: number = 1000): Promise<number> => {
  return new Promise((resolve) => {
    let frameCount = 0;
    const startTime = performance.now();
    
    const countFrames = () => {
      frameCount++;
      const elapsed = performance.now() - startTime;
      
      if (elapsed < duration) {
        requestAnimationFrame(countFrames);
      } else {
        const fps = (frameCount / elapsed) * 1000;
        resolve(fps);
      }
    };
    
    requestAnimationFrame(countFrames);
  });
};