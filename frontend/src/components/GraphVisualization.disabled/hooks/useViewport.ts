/**
 * useViewport Hook
 * Manages pixi-viewport integration for pan/zoom/interactions
 *
 * Features:
 * - Initialize pixi-viewport with wheel zoom, drag pan, pinch zoom
 * - Manage viewport bounds and limits
 * - Expose pan/zoom controls programmatically
 * - Handle fit-to-screen, reset view, zoom to node
 * - Bookmark camera positions
 * - Smooth animated transitions
 *
 * Dependencies:
 * - pixi-viewport for viewport management
 * - PIXI.js v7+ for rendering
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Viewport } from 'pixi-viewport';
import type { Application, Rectangle, IPointData } from 'pixi.js';
import type { EnhancedGraphNode } from '../types';

/* ============================================
   TYPES
   ============================================ */

/**
 * Camera bookmark
 */
export interface CameraBookmark {
  id: string;
  name: string;
  x: number;
  y: number;
  zoom: number;
  timestamp: number;
}

/**
 * Viewport controls API
 */
export interface ViewportControls {
  /** Fit all nodes to screen */
  fitToScreen: () => void;

  /** Reset view to origin (0, 0) at zoom 1 */
  resetView: () => void;

  /** Zoom and pan to a specific node */
  zoomToNode: (nodeId: string, duration?: number) => void;

  /** Pan to world coordinates */
  panTo: (x: number, y: number, duration?: number) => void;

  /** Zoom to specific scale */
  zoomTo: (scale: number, duration?: number) => void;

  /** Get current zoom level */
  getZoom: () => number;

  /** Get visible bounds in world coordinates */
  getBounds: () => Rectangle;

  /** Save current camera position as bookmark */
  saveBookmark: (name: string) => void;

  /** Load a saved bookmark */
  loadBookmark: (name: string) => void;

  /** Get all bookmarks */
  getBookmarks: () => CameraBookmark[];

  /** Delete a bookmark */
  deleteBookmark: (id: string) => void;

  /** Pan by delta (relative movement) */
  panBy: (deltaX: number, deltaY: number, duration?: number) => void;

  /** Zoom in by a factor */
  zoomIn: (factor?: number, duration?: number) => void;

  /** Zoom out by a factor */
  zoomOut: (factor?: number, duration?: number) => void;
}

/**
 * Hook options
 */
export interface UseViewportOptions {
  /** World width in pixels */
  worldWidth?: number;

  /** World height in pixels */
  worldHeight?: number;

  /** Minimum zoom scale */
  minZoom?: number;

  /** Maximum zoom scale */
  maxZoom?: number;

  /** Wheel zoom speed (0-1) */
  wheelZoomSpeed?: number;

  /** Enable drag to pan */
  enableDrag?: boolean;

  /** Enable pinch to zoom */
  enablePinch?: boolean;

  /** Enable wheel to zoom */
  enableWheel?: boolean;

  /** Deceleration friction (0-1) */
  friction?: number;

  /** Clamp to world bounds */
  clampWorld?: boolean;

  /** Array of nodes for zoom-to-node functionality */
  nodes?: EnhancedGraphNode[];
}

/**
 * Hook return value
 */
export interface UseViewportReturn {
  /** The pixi-viewport instance */
  viewport: Viewport | null;

  /** Viewport control API */
  controls: ViewportControls;

  /** Current zoom level */
  currentZoom: number;

  /** Current center position */
  currentCenter: IPointData;

  /** Is viewport ready */
  isReady: boolean;
}

/* ============================================
   CONSTANTS
   ============================================ */

const DEFAULT_OPTIONS: Required<Omit<UseViewportOptions, 'nodes'>> = {
  worldWidth: 4000,
  worldHeight: 4000,
  minZoom: 0.1,
  maxZoom: 5,
  wheelZoomSpeed: 0.1,
  enableDrag: true,
  enablePinch: true,
  enableWheel: true,
  friction: 0.9,
  clampWorld: false,
};

const DEFAULT_ZOOM_FACTOR = 1.5;
const DEFAULT_ANIMATION_DURATION = 500;

/* ============================================
   MAIN HOOK
   ============================================ */

/**
 * Custom hook for managing pixi-viewport
 * @param app - PIXI Application instance
 * @param options - Viewport configuration options
 * @returns Viewport instance, controls, and state
 */
export function useViewport(
  app: Application | null,
  options: UseViewportOptions = {}
): UseViewportReturn {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);

  // State
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [currentCenter, setCurrentCenter] = useState<IPointData>({ x: 0, y: 0 });
  const [isReady, setIsReady] = useState(false);

  // Refs
  const bookmarksRef = useRef<Map<string, CameraBookmark>>(new Map());
  const nodesRef = useRef<EnhancedGraphNode[]>([]);

  // Update nodes ref when nodes prop changes
  useEffect(() => {
    if (options.nodes) {
      nodesRef.current = options.nodes;
    }
  }, [options.nodes]);

  /**
   * Initialize viewport
   */
  useEffect(() => {
    if (!app) return;

    console.log('[useViewport] Initializing viewport...');

    // Create viewport
    const vp = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: opts.worldWidth,
      worldHeight: opts.worldHeight,
      events: app.renderer.events,
    });

    // Add interaction plugins
    if (opts.enableDrag) {
      vp.drag({
        mouseButtons: 'left',
      });
    }

    if (opts.enablePinch) {
      vp.pinch();
    }

    if (opts.enableWheel) {
      vp.wheel({
        smooth: 3,
        percent: opts.wheelZoomSpeed,
      });
    }

    // Add deceleration
    vp.decelerate({
      friction: opts.friction,
    });

    // Clamp zoom
    vp.clampZoom({
      minScale: opts.minZoom,
      maxScale: opts.maxZoom,
    });

    // Optionally clamp to world bounds
    if (opts.clampWorld) {
      vp.clamp({
        direction: 'all',
      });
    }

    // Listen to viewport events
    vp.on('moved', handleViewportMoved);
    vp.on('zoomed', handleViewportZoomed);

    // Add viewport to stage
    app.stage.addChild(vp);

    setViewport(vp);
    setIsReady(true);

    console.log('[useViewport] Viewport initialized');

    // Cleanup
    return () => {
      console.log('[useViewport] Cleaning up viewport...');
      vp.off('moved', handleViewportMoved);
      vp.off('zoomed', handleViewportZoomed);
      vp.destroy({ children: true });
      setIsReady(false);
    };
  }, [app, opts]);

  /**
   * Handle viewport moved event
   */
  const handleViewportMoved = useCallback(() => {
    if (viewport) {
      setCurrentCenter({ x: viewport.center.x, y: viewport.center.y });
    }
  }, [viewport]);

  /**
   * Handle viewport zoomed event
   */
  const handleViewportZoomed = useCallback(() => {
    if (viewport) {
      setCurrentZoom(viewport.scale.x);
    }
  }, [viewport]);

  /**
   * Handle window resize
   */
  useEffect(() => {
    if (!viewport) return;

    const handleResize = () => {
      viewport.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [viewport]);

  /* ============================================
     CONTROL FUNCTIONS
     ============================================ */

  /**
   * Fit all nodes to screen
   */
  const fitToScreen = useCallback(() => {
    if (!viewport) return;

    const nodes = nodesRef.current;

    if (nodes.length === 0) {
      // No nodes, just fit world
      viewport.fitWorld(true);
      return;
    }

    // Calculate bounding box of all nodes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    }

    // Add padding (10%)
    const width = maxX - minX;
    const height = maxY - minY;
    const padding = 0.1;

    minX -= width * padding;
    maxX += width * padding;
    minY -= height * padding;
    maxY += height * padding;

    // Fit to bounding box
    viewport.fit(true, minX, minY, maxX - minX, maxY - minY);
  }, [viewport]);

  /**
   * Reset view to origin
   */
  const resetView = useCallback(() => {
    if (!viewport) return;

    viewport.animate({
      position: { x: 0, y: 0 },
      scale: 1,
      time: DEFAULT_ANIMATION_DURATION,
    });
  }, [viewport]);

  /**
   * Zoom to a specific node
   */
  const zoomToNode = useCallback(
    (nodeId: string, duration: number = DEFAULT_ANIMATION_DURATION) => {
      if (!viewport) return;

      const nodes = nodesRef.current;
      const node = nodes.find((n) => n.id === nodeId);

      if (!node || node.x === undefined || node.y === undefined) {
        console.warn(`[useViewport] Node ${nodeId} not found or missing position`);
        return;
      }

      viewport.animate({
        position: { x: node.x, y: node.y },
        scale: 2, // Zoom in to 2x
        time: duration,
      });
    },
    [viewport]
  );

  /**
   * Pan to world coordinates
   */
  const panTo = useCallback(
    (x: number, y: number, duration: number = DEFAULT_ANIMATION_DURATION) => {
      if (!viewport) return;

      viewport.animate({
        position: { x, y },
        time: duration,
      });
    },
    [viewport]
  );

  /**
   * Zoom to specific scale
   */
  const zoomTo = useCallback(
    (scale: number, duration: number = DEFAULT_ANIMATION_DURATION) => {
      if (!viewport) return;

      viewport.animate({
        scale,
        time: duration,
      });
    },
    [viewport]
  );

  /**
   * Get current zoom level
   */
  const getZoom = useCallback((): number => {
    return viewport?.scale.x || 1;
  }, [viewport]);

  /**
   * Get visible bounds
   */
  const getBounds = useCallback((): Rectangle => {
    if (!viewport) {
      return { x: 0, y: 0, width: 0, height: 0 } as Rectangle;
    }

    return viewport.getVisibleBounds();
  }, [viewport]);

  /**
   * Save camera bookmark
   */
  const saveBookmark = useCallback(
    (name: string) => {
      if (!viewport) return;

      const bookmark: CameraBookmark = {
        id: `bookmark_${Date.now()}`,
        name,
        x: viewport.center.x,
        y: viewport.center.y,
        zoom: viewport.scale.x,
        timestamp: Date.now(),
      };

      bookmarksRef.current.set(bookmark.id, bookmark);

      console.log(`[useViewport] Saved bookmark: ${name}`);
    },
    [viewport]
  );

  /**
   * Load camera bookmark
   */
  const loadBookmark = useCallback(
    (name: string) => {
      if (!viewport) return;

      // Find bookmark by name
      const bookmark = Array.from(bookmarksRef.current.values()).find(
        (b) => b.name === name
      );

      if (!bookmark) {
        console.warn(`[useViewport] Bookmark not found: ${name}`);
        return;
      }

      viewport.animate({
        position: { x: bookmark.x, y: bookmark.y },
        scale: bookmark.zoom,
        time: DEFAULT_ANIMATION_DURATION,
      });

      console.log(`[useViewport] Loaded bookmark: ${name}`);
    },
    [viewport]
  );

  /**
   * Get all bookmarks
   */
  const getBookmarks = useCallback((): CameraBookmark[] => {
    return Array.from(bookmarksRef.current.values());
  }, []);

  /**
   * Delete a bookmark
   */
  const deleteBookmark = useCallback((id: string) => {
    bookmarksRef.current.delete(id);
  }, []);

  /**
   * Pan by delta
   */
  const panBy = useCallback(
    (deltaX: number, deltaY: number, duration: number = DEFAULT_ANIMATION_DURATION) => {
      if (!viewport) return;

      const currentX = viewport.center.x;
      const currentY = viewport.center.y;

      viewport.animate({
        position: { x: currentX + deltaX, y: currentY + deltaY },
        time: duration,
      });
    },
    [viewport]
  );

  /**
   * Zoom in by a factor
   */
  const zoomIn = useCallback(
    (factor: number = DEFAULT_ZOOM_FACTOR, duration: number = DEFAULT_ANIMATION_DURATION) => {
      if (!viewport) return;

      const currentScale = viewport.scale.x;
      const newScale = Math.min(currentScale * factor, opts.maxZoom);

      viewport.animate({
        scale: newScale,
        time: duration,
      });
    },
    [viewport, opts.maxZoom]
  );

  /**
   * Zoom out by a factor
   */
  const zoomOut = useCallback(
    (factor: number = DEFAULT_ZOOM_FACTOR, duration: number = DEFAULT_ANIMATION_DURATION) => {
      if (!viewport) return;

      const currentScale = viewport.scale.x;
      const newScale = Math.max(currentScale / factor, opts.minZoom);

      viewport.animate({
        scale: newScale,
        time: duration,
      });
    },
    [viewport, opts.minZoom]
  );

  /**
   * Viewport controls API
   */
  const controls: ViewportControls = useMemo(
    () => ({
      fitToScreen,
      resetView,
      zoomToNode,
      panTo,
      zoomTo,
      getZoom,
      getBounds,
      saveBookmark,
      loadBookmark,
      getBookmarks,
      deleteBookmark,
      panBy,
      zoomIn,
      zoomOut,
    }),
    [
      fitToScreen,
      resetView,
      zoomToNode,
      panTo,
      zoomTo,
      getZoom,
      getBounds,
      saveBookmark,
      loadBookmark,
      getBookmarks,
      deleteBookmark,
      panBy,
      zoomIn,
      zoomOut,
    ]
  );

  return {
    viewport,
    controls,
    currentZoom,
    currentCenter,
    isReady,
  };
}
