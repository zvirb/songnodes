import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as PIXI from 'pixi.js';
import useStore from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';

interface GraphMiniMapProps {
  mainGraphWidth: number;
  mainGraphHeight: number;
}

const MINI_MAP_SIZE = 200;
const NODE_MIN_RADIUS = 1;
const NODE_MAX_RADIUS = 3;
const EDGE_WIDTH = 0.5;
const VIEWPORT_UPDATE_DEBOUNCE_MS = 100; // Debounce viewport updates

export const GraphMiniMap: React.FC<GraphMiniMapProps> = ({ mainGraphWidth, mainGraphHeight }) => {
  const {
    graphData,
    viewState,
    simulationState,
  } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const nodesContainerRef = useRef<PIXI.Container | null>(null);
  const edgesContainerRef = useRef<PIXI.Container | null>(null);
  const viewportRectRef = useRef<PIXI.Graphics | null>(null);

  // Static snapshot for performance optimization
  const snapshotTextureRef = useRef<PIXI.RenderTexture | null>(null);
  const snapshotSpriteRef = useRef<PIXI.Sprite | null>(null);
  const isUsingSnapshotRef = useRef<boolean>(false);

  // Viewport tracking for debounced updates
  const lastViewportRef = useRef({ zoom: viewState.zoom, pan: { ...viewState.pan } });
  const viewportUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataHashRef = useRef<string>('');

  // Track if we're rendering to avoid re-entry
  const isRenderingRef = useRef<boolean>(false);

  // Calculate a simple hash of graph data
  const calculateDataHash = useCallback(() => {
    return `${graphData.nodes.length}-${graphData.edges.length}`;
  }, [graphData.nodes.length, graphData.edges.length]);

  // Calculate bounds and scaling
  const calculateBoundsAndScale = useCallback(() => {
    if (graphData.nodes.length === 0) {
      return { minX: -100, maxX: 100, minY: -100, maxY: 100, scale: 1, offsetX: MINI_MAP_SIZE / 2, offsetY: MINI_MAP_SIZE / 2 };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    graphData.nodes.forEach(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const scaleX = MINI_MAP_SIZE / (graphWidth + 200);
    const scaleY = MINI_MAP_SIZE / (graphHeight + 200);
    const scale = Math.min(scaleX, scaleY);
    const offsetX = MINI_MAP_SIZE / 2 - (minX + graphWidth / 2) * scale;
    const offsetY = MINI_MAP_SIZE / 2 - (minY + graphHeight / 2) * scale;

    return { minX, maxX, minY, maxY, scale, offsetX, offsetY };
  }, [graphData.nodes]);

  // Render nodes and edges to containers
  const renderGraphGeometry = useCallback(() => {
    if (!nodesContainerRef.current || !edgesContainerRef.current) return;

    const nodesContainer = nodesContainerRef.current;
    const edgesContainer = edgesContainerRef.current;

    // Clear old graphics
    nodesContainer.children.forEach(child => child.destroy({ children: true }));
    nodesContainer.removeChildren();
    edgesContainer.children.forEach(child => child.destroy({ children: true }));
    edgesContainer.removeChildren();

    const { scale, offsetX, offsetY } = calculateBoundsAndScale();

    // Render edges
    graphData.edges.forEach(edge => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode &&
          typeof sourceNode.x === 'number' && typeof sourceNode.y === 'number' &&
          typeof targetNode.x === 'number' && typeof targetNode.y === 'number') {
        const line = new PIXI.Graphics();
        line.setStrokeStyle({ width: EDGE_WIDTH, color: 0x5a5a5a, alpha: 0.5 });
        line.moveTo(sourceNode.x * scale + offsetX, sourceNode.y * scale + offsetY);
        line.lineTo(targetNode.x * scale + offsetX, targetNode.y * scale + offsetY);
        line.stroke();
        edgesContainer.addChild(line);
      }
    });

    // Render nodes
    graphData.nodes.forEach(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        const circle = new PIXI.Graphics();
        const radius = Math.max(NODE_MIN_RADIUS, Math.min(NODE_MAX_RADIUS, (node.degree || 1) * 0.2));
        circle.circle(0, 0, radius);
        circle.fill(0x8e8e93);
        circle.position.set(node.x * scale + offsetX, node.y * scale + offsetY);
        nodesContainer.addChild(circle);
      }
    });
  }, [graphData, calculateBoundsAndScale]);

  // Render viewport rectangle
  const renderViewportRect = useCallback(() => {
    if (!viewportRectRef.current) return;

    const viewportRect = viewportRectRef.current;
    viewportRect.clear();

    const { scale, offsetX, offsetY } = calculateBoundsAndScale();

    const worldViewWidth = mainGraphWidth / viewState.zoom;
    const worldViewHeight = mainGraphHeight / viewState.zoom;
    const worldViewX = (-viewState.pan.x - mainGraphWidth / 2) / viewState.zoom;
    const worldViewY = (-viewState.pan.y - mainGraphHeight / 2) / viewState.zoom;

    const miniMapViewportX = worldViewX * scale + offsetX;
    const miniMapViewportY = worldViewY * scale + offsetY;
    const miniMapViewportWidth = worldViewWidth * scale;
    const miniMapViewportHeight = worldViewHeight * scale;

    viewportRect.setStrokeStyle({ width: 2, color: 0x00ff41, alpha: 0.9 });
    viewportRect.rect(miniMapViewportX, miniMapViewportY, miniMapViewportWidth, miniMapViewportHeight);
    viewportRect.stroke();
  }, [viewState, mainGraphWidth, mainGraphHeight, calculateBoundsAndScale]);

  // Capture static snapshot of the graph (nodes + edges only, NOT viewport rect)
  const captureSnapshot = useCallback(() => {
    if (!pixiAppRef.current || !nodesContainerRef.current || !edgesContainerRef.current) return;

    console.log('📸 Minimap: Capturing static snapshot (simulation settled)');

    // Render the current graph geometry
    renderGraphGeometry();

    // Create a temporary container with only nodes and edges
    const tempContainer = new PIXI.Container();
    tempContainer.addChild(edgesContainerRef.current);
    tempContainer.addChild(nodesContainerRef.current);

    // Create or reuse render texture
    if (!snapshotTextureRef.current) {
      snapshotTextureRef.current = PIXI.RenderTexture.create({
        width: MINI_MAP_SIZE,
        height: MINI_MAP_SIZE,
      });
    }

    // Render to texture
    pixiAppRef.current.renderer.render({
      container: tempContainer,
      target: snapshotTextureRef.current,
    });

    // Create or update sprite
    if (!snapshotSpriteRef.current) {
      snapshotSpriteRef.current = new PIXI.Sprite(snapshotTextureRef.current);
      snapshotSpriteRef.current.eventMode = 'none';
      pixiAppRef.current.stage.addChildAt(snapshotSpriteRef.current, 0); // Add at bottom
    } else {
      snapshotSpriteRef.current.texture = snapshotTextureRef.current;
    }

    // Hide the dynamic containers, show the snapshot
    nodesContainerRef.current.visible = false;
    edgesContainerRef.current.visible = false;
    snapshotSpriteRef.current.visible = true;
    isUsingSnapshotRef.current = true;

    console.log('✅ Minimap: Static snapshot active - continuous rendering stopped');
  }, [renderGraphGeometry]);

  // Switch back to dynamic rendering
  const useDynamicRendering = useCallback(() => {
    if (!nodesContainerRef.current || !edgesContainerRef.current) return;

    console.log('🔄 Minimap: Switching to dynamic rendering (simulation active)');

    // Hide snapshot, show dynamic containers
    if (snapshotSpriteRef.current) {
      snapshotSpriteRef.current.visible = false;
    }
    nodesContainerRef.current.visible = true;
    edgesContainerRef.current.visible = true;
    isUsingSnapshotRef.current = false;
  }, []);

  // Full render function (for dynamic mode)
  const renderMiniMap = useCallback(() => {
    if (isRenderingRef.current) return; // Prevent re-entry
    isRenderingRef.current = true;

    try {
      if (!pixiAppRef.current || !nodesContainerRef.current || !edgesContainerRef.current || !viewportRectRef.current) {
        return;
      }

      // If using snapshot, only update viewport rectangle
      if (isUsingSnapshotRef.current) {
        renderViewportRect();
      } else {
        // Full dynamic render
        renderGraphGeometry();
        renderViewportRect();
      }
    } finally {
      isRenderingRef.current = false;
    }
  }, [renderGraphGeometry, renderViewportRect]);

  // Initialize PIXI app ONCE
  const initializeMiniMap = useCallback(async () => {
    if (!canvasRef.current || pixiAppRef.current) return;

    const app = new PIXI.Application();
    await app.init({
      canvas: canvasRef.current,
      width: MINI_MAP_SIZE,
      height: MINI_MAP_SIZE,
      backgroundColor: 0x2a2a2a,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      eventMode: 'passive', // Disable PIXI event system completely
    });

    pixiAppRef.current = app;

    const nodesContainer = new PIXI.Container();
    const edgesContainer = new PIXI.Container();
    const viewportRect = new PIXI.Graphics();

    app.stage.addChild(edgesContainer);
    app.stage.addChild(nodesContainer);
    app.stage.addChild(viewportRect);

    // Explicitly disable event system on all PIXI objects
    app.stage.eventMode = 'none';
    nodesContainer.eventMode = 'none';
    edgesContainer.eventMode = 'none';
    viewportRect.eventMode = 'none';

    nodesContainerRef.current = nodesContainer;
    edgesContainerRef.current = edgesContainer;
    viewportRectRef.current = viewportRect;

    console.log('✅ Minimap: Initialized with snapshot optimization');
  }, []);

  // Effect 1: Initialize PIXI
  useEffect(() => {
    initializeMiniMap();
    return () => {
      // Cleanup
      if (snapshotTextureRef.current) {
        snapshotTextureRef.current.destroy(true);
        snapshotTextureRef.current = null;
      }
      if (snapshotSpriteRef.current) {
        snapshotSpriteRef.current.destroy({ children: true, texture: false });
        snapshotSpriteRef.current = null;
      }
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true, texture: true });
        pixiAppRef.current = null;
      }
    };
  }, [initializeMiniMap]);

  // Effect 2: Handle simulation state changes with safety timeout
  useEffect(() => {
    if (!pixiAppRef.current) return;

    // SAFETY: Force snapshot after 10 seconds regardless of simulation state
    const forceSnapshotTimer = setTimeout(() => {
      if (!isUsingSnapshotRef.current && simulationState.alpha < 0.1) {
        console.log('⚠️ Minimap: Forcing snapshot after 10s timeout');
        captureSnapshot();
      }
    }, 10000);

    // OPTIMIZATION: Capture snapshot early when alpha is low (don't wait for full settlement)
    if (simulationState.isSettled || simulationState.alpha < 0.05) {
      // Simulation has mostly settled - capture snapshot and stop continuous rendering
      captureSnapshot();
    } else {
      // Simulation is active - use dynamic rendering
      useDynamicRendering();
    }

    return () => {
      clearTimeout(forceSnapshotTimer);
    };
  }, [simulationState.isSettled, simulationState.alpha, captureSnapshot, useDynamicRendering]);

  // Effect 3: Handle data changes
  useEffect(() => {
    const currentHash = calculateDataHash();

    if (currentHash !== lastDataHashRef.current) {
      console.log('🔄 Minimap: Data changed, invalidating snapshot');
      lastDataHashRef.current = currentHash;

      // Data changed - switch to dynamic rendering
      useDynamicRendering();

      // If not using snapshot, render immediately
      if (!isUsingSnapshotRef.current) {
        renderMiniMap();
      }
    }
  }, [calculateDataHash, useDynamicRendering, renderMiniMap]);

  // Effect 4: Handle viewport changes with debouncing
  useEffect(() => {
    const hasViewportChanged =
      lastViewportRef.current.zoom !== viewState.zoom ||
      lastViewportRef.current.pan.x !== viewState.pan.x ||
      lastViewportRef.current.pan.y !== viewState.pan.y;

    if (!hasViewportChanged) return;

    // Clear existing timer
    if (viewportUpdateTimerRef.current) {
      clearTimeout(viewportUpdateTimerRef.current);
    }

    // Debounce viewport updates
    viewportUpdateTimerRef.current = setTimeout(() => {
      lastViewportRef.current = { zoom: viewState.zoom, pan: { ...viewState.pan } };

      // Only update viewport rectangle (don't re-render entire graph)
      renderViewportRect();
    }, VIEWPORT_UPDATE_DEBOUNCE_MS);

    return () => {
      if (viewportUpdateTimerRef.current) {
        clearTimeout(viewportUpdateTimerRef.current);
      }
    };
  }, [viewState.zoom, viewState.pan, renderViewportRect]);

  // Effect 5: Ticker for dynamic rendering (only when not using snapshot)
  useEffect(() => {
    const app = pixiAppRef.current;
    if (!app || !app.ticker) return;

    // SAFETY: Skip minimap rendering entirely for huge graphs (performance protection)
    const totalElements = graphData.nodes.length + graphData.edges.length;
    if (totalElements > 5000) {
      console.warn('⚠️ Minimap: Disabled for large graph (' + totalElements + ' elements) - would impact performance');
      return;
    }

    // Only attach ticker if we're in dynamic mode
    if (!simulationState.isSettled) {
      app.ticker.add(renderMiniMap);

      return () => {
        if (app && app.ticker) {
          app.ticker.remove(renderMiniMap);
        }
      };
    }
  }, [renderMiniMap, simulationState.isSettled, graphData.nodes.length, graphData.edges.length]);

  // SAFETY: Hide minimap completely for huge graphs
  const totalElements = graphData.nodes.length + graphData.edges.length;
  if (totalElements > 5000) {
    return null; // Don't render minimap at all for large graphs
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(42, 42, 42, 0.95)',
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
        zIndex: 1000,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        pointerEvents: 'auto'
      }}
    >
      <h4 style={{
        color: '#FFFFFF',
        fontSize: '12px',
        marginBottom: '8px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Mini-map
        {simulationState.isSettled && (
          <span style={{
            marginLeft: '6px',
            fontSize: '10px',
            color: '#00ff41',
            opacity: 0.7
          }}>
            [Cached]
          </span>
        )}
      </h4>
      <canvas
        ref={canvasRef}
        width={MINI_MAP_SIZE}
        height={MINI_MAP_SIZE}
        style={{
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '4px',
          display: 'block',
          cursor: 'default'
        }}
      />
      <p style={{
        fontSize: '10px',
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: '6px',
        textAlign: 'center'
      }}>
        {simulationState.isSettled ? 'Static View' : `Dynamic (α: ${simulationState.alpha.toFixed(3)})`}
      </p>
    </div>
  );
};

export default GraphMiniMap;
