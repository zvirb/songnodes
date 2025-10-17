import React, { useRef, useEffect, useCallback } from 'react';
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

export const GraphMiniMap: React.FC<GraphMiniMapProps> = ({ mainGraphWidth, mainGraphHeight }) => {
  const {
    graphData,
    viewState,
    view,
  } = useStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const nodesContainerRef = useRef<PIXI.Container | null>(null);
  const edgesContainerRef = useRef<PIXI.Container | null>(null);
  const viewportRectRef = useRef<PIXI.Graphics | null>(null);

  // Mini-map is now view-only (no interaction)

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

    // NOTE: We do NOT attach any PIXI event listeners here
    // All interaction will be handled via DOM events to prevent blocking
  }, []);

  // Render function (called by ticker)
  const renderMiniMap = useCallback(() => {
    if (!pixiAppRef.current || !nodesContainerRef.current || !edgesContainerRef.current || !viewportRectRef.current) return;

    const nodesContainer = nodesContainerRef.current;
    const edgesContainer = edgesContainerRef.current;
    const viewportRect = viewportRectRef.current;

    // Destroy old graphics to prevent memory leak
    nodesContainer.children.forEach(child => child.destroy({ children: true }));
    nodesContainer.removeChildren();

    edgesContainer.children.forEach(child => child.destroy({ children: true }));
    edgesContainer.removeChildren();

    viewportRect.clear();

    const { scale, offsetX, offsetY } = calculateBoundsAndScale();

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

    // Draw viewport rectangle
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
  }, [graphData, viewState, mainGraphWidth, mainGraphHeight, calculateBoundsAndScale]);

  // No event handlers - mini-map is view-only

  // Effect 1: Initialize PIXI
  useEffect(() => {
    initializeMiniMap();
    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true, { children: true, texture: true });
        pixiAppRef.current = null;
      }
    };
  }, [initializeMiniMap]);

  // Effect 2: Manage ticker
  useEffect(() => {
    const app = pixiAppRef.current;
    if (!app || !app.ticker) return;

    app.ticker.add(renderMiniMap);

    return () => {
      if (app && app.ticker) {
        app.ticker.remove(renderMiniMap);
      }
    };
  }, [renderMiniMap]);

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
        pointerEvents: 'auto' // Ensure this container receives events
      }}
    >
      <h4 style={{
        color: '#FFFFFF',
        fontSize: '12px',
        marginBottom: '8px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>Mini-map</h4>
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
      }}>Overview</p>
    </div>
  );
};

export default GraphMiniMap;
