/**
 * GraphVisualization Utility Functions
 * Helper functions for coordinate transformations, performance monitoring, and more
 */

import type { Point, Rectangle, Bounds, GraphNode } from './types';

/* ============================================
   COORDINATE TRANSFORMATIONS
   ============================================ */

/**
 * Convert world coordinates to screen coordinates
 * @param worldX - X position in world space
 * @param worldY - Y position in world space
 * @param cameraX - Camera X position
 * @param cameraY - Camera Y position
 * @param zoom - Zoom level (scale)
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns Screen coordinates
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number
): Point {
  return {
    x: (worldX - cameraX) * zoom + screenWidth / 2,
    y: (worldY - cameraY) * zoom + screenHeight / 2,
  };
}

/**
 * Convert screen coordinates to world coordinates
 * @param screenX - X position on screen
 * @param screenY - Y position on screen
 * @param cameraX - Camera X position
 * @param cameraY - Camera Y position
 * @param zoom - Zoom level (scale)
 * @param screenWidth - Screen width in pixels
 * @param screenHeight - Screen height in pixels
 * @returns World coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  cameraX: number,
  cameraY: number,
  zoom: number,
  screenWidth: number,
  screenHeight: number
): Point {
  return {
    x: (screenX - screenWidth / 2) / zoom + cameraX,
    y: (screenY - screenHeight / 2) / zoom + cameraY,
  };
}

/**
 * Calculate the screen-space size of a world-space object
 * @param worldSize - Size in world space
 * @param zoom - Zoom level (scale)
 * @returns Size in screen space
 */
export function worldSizeToScreen(worldSize: number, zoom: number): number {
  return worldSize * zoom;
}

/**
 * Calculate the world-space size of a screen-space object
 * @param screenSize - Size in screen space
 * @param zoom - Zoom level (scale)
 * @returns Size in world space
 */
export function screenSizeToWorld(screenSize: number, zoom: number): number {
  return screenSize / zoom;
}

/* ============================================
   CAMERA CALCULATIONS
   ============================================ */

/**
 * Calculate camera position to fit bounds in viewport
 * @param bounds - Bounds to fit
 * @param viewportWidth - Viewport width
 * @param viewportHeight - Viewport height
 * @param padding - Padding as percentage (0-1)
 * @returns Camera position and zoom
 */
export function fitBoundsToViewport(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 0.1
): { x: number; y: number; zoom: number } {
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  // Calculate zoom to fit both dimensions with padding
  const zoomX = (viewportWidth * (1 - padding * 2)) / boundsWidth;
  const zoomY = (viewportHeight * (1 - padding * 2)) / boundsHeight;
  const zoom = Math.min(zoomX, zoomY);

  // Calculate center position
  const x = (bounds.minX + bounds.maxX) / 2;
  const y = (bounds.minY + bounds.maxY) / 2;

  return { x, y, zoom };
}

/**
 * Calculate visible bounds for a camera position
 * @param cameraX - Camera X position
 * @param cameraY - Camera Y position
 * @param zoom - Zoom level
 * @param viewportWidth - Viewport width
 * @param viewportHeight - Viewport height
 * @returns Visible bounds in world space
 */
export function getVisibleBounds(
  cameraX: number,
  cameraY: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number
): Bounds {
  const halfWidth = viewportWidth / (2 * zoom);
  const halfHeight = viewportHeight / (2 * zoom);

  return {
    minX: cameraX - halfWidth,
    maxX: cameraX + halfWidth,
    minY: cameraY - halfHeight,
    maxY: cameraY + halfHeight,
  };
}

/* ============================================
   GEOMETRY UTILITIES
   ============================================ */

/**
 * Check if a point is inside a rectangle
 * @param point - Point to test
 * @param rect - Rectangle to test against
 * @returns True if point is inside rectangle
 */
export function isPointInRect(point: Point, rect: Rectangle): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if two rectangles intersect
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns True if rectangles intersect
 */
export function rectsIntersect(rect1: Rectangle, rect2: Rectangle): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/**
 * Calculate distance between two points
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Euclidean distance
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance between two points (faster, no sqrt)
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Squared Euclidean distance
 */
export function distanceSquared(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return dx * dx + dy * dy;
}

/* ============================================
   PERFORMANCE MONITORING
   ============================================ */

/**
 * Simple FPS counter
 */
export class FPSCounter {
  private frames: number[] = [];
  private lastTime: number = performance.now();

  /**
   * Update FPS counter
   * @returns Current FPS
   */
  update(): number {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;

    this.frames.push(delta);

    // Keep only last 60 frames
    if (this.frames.length > 60) {
      this.frames.shift();
    }

    // Calculate average FPS
    const avgDelta = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    return Math.round(1000 / avgDelta);
  }

  /**
   * Reset FPS counter
   */
  reset(): void {
    this.frames = [];
    this.lastTime = performance.now();
  }
}

/**
 * Performance timer for measuring execution time
 */
export class PerformanceTimer {
  private startTime: number = 0;
  private measurements: Map<string, number[]> = new Map();

  /**
   * Start timing
   */
  start(): void {
    this.startTime = performance.now();
  }

  /**
   * Stop timing and record measurement
   * @param label - Label for this measurement
   * @returns Elapsed time in milliseconds
   */
  end(label: string): number {
    const elapsed = performance.now() - this.startTime;

    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }

    const times = this.measurements.get(label)!;
    times.push(elapsed);

    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }

    return elapsed;
  }

  /**
   * Get average time for a label
   * @param label - Label to get average for
   * @returns Average time in milliseconds
   */
  getAverage(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * Get all measurements
   * @returns Map of label to average time
   */
  getAll(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [label, times] of this.measurements.entries()) {
      result.set(label, times.reduce((a, b) => a + b, 0) / times.length);
    }
    return result;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }
}

/* ============================================
   KEYBOARD SHORTCUTS
   ============================================ */

/**
 * Keyboard shortcut handler configuration
 */
export interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

/**
 * Keyboard shortcut manager
 */
export class KeyboardShortcutManager {
  private shortcuts: Map<string, ShortcutConfig> = new Map();
  private handleKeyDown: (event: KeyboardEvent) => void;

  constructor() {
    this.handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      const alt = event.altKey;

      // Find matching shortcut
      for (const config of this.shortcuts.values()) {
        if (
          config.key === key &&
          (config.ctrl === undefined || config.ctrl === ctrl) &&
          (config.shift === undefined || config.shift === shift) &&
          (config.alt === undefined || config.alt === alt)
        ) {
          event.preventDefault();
          config.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Register a keyboard shortcut
   * @param id - Unique ID for this shortcut
   * @param config - Shortcut configuration
   */
  register(id: string, config: ShortcutConfig): void {
    this.shortcuts.set(id, config);
  }

  /**
   * Unregister a keyboard shortcut
   * @param id - Shortcut ID to remove
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  /**
   * Get all registered shortcuts
   * @returns Array of shortcut configurations
   */
  getAll(): ShortcutConfig[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Cleanup and remove event listeners
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.shortcuts.clear();
  }
}

/* ============================================
   MISCELLANEOUS UTILITIES
   ============================================ */

/**
 * Clamp a value between min and max
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation
 * @param a - Start value
 * @param b - End value
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated value
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Calculate bounds for a set of nodes
 * @param nodes - Nodes to calculate bounds for
 * @returns Bounding box
 */
export function calculateNodeBounds(nodes: GraphNode[]): Bounds | null {
  if (nodes.length === 0) return null;

  const positions = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
  if (positions.length === 0) return null;

  return {
    minX: Math.min(...positions.map((n) => n.x!)),
    maxX: Math.max(...positions.map((n) => n.x!)),
    minY: Math.min(...positions.map((n) => n.y!)),
    maxY: Math.max(...positions.map((n) => n.y!)),
  };
}

/**
 * Debounce a function call
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Throttle a function call
 * @param fn - Function to throttle
 * @param delay - Delay in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}
