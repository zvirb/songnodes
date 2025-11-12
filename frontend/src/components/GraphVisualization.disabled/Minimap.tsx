/**
 * Minimap Component
 * Provides overview navigation of the entire graph
 *
 * Features:
 * - 2D canvas rendering for performance
 * - Shows all nodes as colored dots
 * - Shows current viewport as draggable rectangle
 * - Click to pan to location
 * - Drag viewport indicator to navigate
 * - Auto-hide when viewport covers entire graph
 * - Responsive to graph changes
 *
 * Performance:
 * - Renders 10,000+ nodes efficiently
 * - Minimal re-renders with memoization
 * - Low memory footprint
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { GraphNode, Viewport } from './types';
import styles from './Minimap.module.css';

/* ============================================
   TYPES
   ============================================ */

interface MinimapProps {
  /** Graph nodes to display */
  nodes: GraphNode[];

  /** Current viewport from pixi-viewport */
  viewport: Viewport | null;

  /** Current zoom level */
  currentZoom: number;

  /** Viewport change handler */
  onViewportChange: (x: number, y: number) => void;

  /** Minimap width in pixels */
  width?: number;

  /** Minimap height in pixels */
  height?: number;

  /** Custom CSS class */
  className?: string;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/* ============================================
   CONSTANTS
   ============================================ */

const NODE_DOT_RADIUS = 1.5;
const NODE_DOT_COLOR = '#4A5568';
const SELECTED_NODE_COLOR = '#3B82F6';
const VIEWPORT_RECT_COLOR = '#3B82F6';
const VIEWPORT_RECT_WIDTH = 2;
const BACKGROUND_COLOR = '#1A1A1A';
const PADDING = 0.05; // 5% padding

/* ============================================
   COMPONENT
   ============================================ */

/**
 * Minimap Component
 * Shows overview of entire graph with viewport indicator
 */
export function Minimap({
  nodes,
  viewport,
  currentZoom,
  onViewportChange,
  width = 200,
  height = 150,
  className,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const boundsRef = useRef<Bounds | null>(null);

  /* ============================================
     BOUNDS CALCULATION
     ============================================ */

  const calculateBounds = useCallback((): Bounds | null => {
    if (nodes.length === 0) return null;

    const positions = nodes.filter((n) => n.x !== undefined && n.y !== undefined);
    if (positions.length === 0) return null;

    const minX = Math.min(...positions.map((n) => n.x!));
    const maxX = Math.max(...positions.map((n) => n.x!));
    const minY = Math.min(...positions.map((n) => n.y!));
    const maxY = Math.max(...positions.map((n) => n.y!));

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [nodes]);

  /* ============================================
     RENDERING
     ============================================ */

  useEffect(() => {
    if (!canvasRef.current || !viewport || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const bounds = calculateBounds();
    if (!bounds) return;

    boundsRef.current = bounds;

    // Calculate scale to fit graph in minimap with padding
    const scaleX = (width * (1 - PADDING * 2)) / bounds.width;
    const scaleY = (height * (1 - PADDING * 2)) / bounds.height;
    const scale = Math.min(scaleX, scaleY);

    // Calculate offset to center the graph
    const offsetX = (width - bounds.width * scale) / 2;
    const offsetY = (height - bounds.height * scale) / 2;

    // Helper function to convert world coords to minimap coords
    const worldToMinimap = (x: number, y: number): [number, number] => {
      return [
        (x - bounds.minX) * scale + offsetX,
        (y - bounds.minY) * scale + offsetY,
      ];
    };

    // Clear canvas
    ctx.fillStyle = BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Draw all nodes as dots
    ctx.fillStyle = NODE_DOT_COLOR;
    ctx.beginPath();
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue;

      const [mx, my] = worldToMinimap(node.x, node.y);
      ctx.moveTo(mx + NODE_DOT_RADIUS, my);
      ctx.arc(mx, my, NODE_DOT_RADIUS, 0, Math.PI * 2);
    }
    ctx.fill();

    // Draw viewport rectangle
    if (viewport) {
      const viewBounds = viewport.bounds;
      const [vpX1, vpY1] = worldToMinimap(viewBounds.minX, viewBounds.minY);
      const [vpX2, vpY2] = worldToMinimap(viewBounds.maxX, viewBounds.maxY);

      const vpWidth = vpX2 - vpX1;
      const vpHeight = vpY2 - vpY1;

      // Fill with semi-transparent color
      ctx.fillStyle = VIEWPORT_RECT_COLOR + '20'; // 20 = 12.5% opacity
      ctx.fillRect(vpX1, vpY1, vpWidth, vpHeight);

      // Stroke with solid color
      ctx.strokeStyle = VIEWPORT_RECT_COLOR;
      ctx.lineWidth = VIEWPORT_RECT_WIDTH;
      ctx.strokeRect(vpX1, vpY1, vpWidth, vpHeight);
    }
  }, [nodes, viewport, width, height, calculateBounds]);

  /* ============================================
     INTERACTION HANDLERS
     ============================================ */

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!boundsRef.current || isDragging) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convert minimap coords to world coords
      const bounds = boundsRef.current;
      const scaleX = (width * (1 - PADDING * 2)) / bounds.width;
      const scaleY = (height * (1 - PADDING * 2)) / bounds.height;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (width - bounds.width * scale) / 2;
      const offsetY = (height - bounds.height * scale) / 2;

      const worldX = (mouseX - offsetX) / scale + bounds.minX;
      const worldY = (mouseY - offsetY) / scale + bounds.minY;

      onViewportChange(worldX, worldY);
    },
    [width, height, isDragging, onViewportChange]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!boundsRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      setIsDragging(true);
      dragStartRef.current = { x: mouseX, y: mouseY };
    },
    []
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !dragStartRef.current || !boundsRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Convert minimap coords to world coords
      const bounds = boundsRef.current;
      const scaleX = (width * (1 - PADDING * 2)) / bounds.width;
      const scaleY = (height * (1 - PADDING * 2)) / bounds.height;
      const scale = Math.min(scaleX, scaleY);
      const offsetX = (width - bounds.width * scale) / 2;
      const offsetY = (height - bounds.height * scale) / 2;

      const worldX = (mouseX - offsetX) / scale + bounds.minX;
      const worldY = (mouseY - offsetY) / scale + bounds.minY;

      onViewportChange(worldX, worldY);
      dragStartRef.current = { x: mouseX, y: mouseY };
    },
    [isDragging, width, height, onViewportChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
    }
  }, [isDragging]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  /* ============================================
     RENDER
     ============================================ */

  // Auto-hide if viewport covers entire graph (zoom out fully)
  const shouldHide = currentZoom < 0.2;

  if (shouldHide || nodes.length === 0) {
    return null;
  }

  return (
    <div
      className={`${styles.minimap} ${className || ''} ${isHovering ? styles.hovering : ''}`}
      role="navigation"
      aria-label="Graph overview minimap"
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        style={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
        aria-label={`Minimap showing ${nodes.length} nodes`}
      />
      <div className={styles.label}>Minimap</div>
    </div>
  );
}
