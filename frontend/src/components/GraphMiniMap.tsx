import React, { useRef, useEffect, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import useStore from '../store/useStore';
import { GraphNode, GraphEdge, DEFAULT_CONFIG } from '../types';

interface GraphMiniMapProps {
  mainGraphWidth: number;
  mainGraphHeight: number;
}

const MINI_MAP_SIZE = 200; // Fixed size for the mini-map canvas
const NODE_MIN_RADIUS = 1; // Minimum radius for nodes in mini-map
const NODE_MAX_RADIUS = 3; // Maximum radius for nodes in mini-map
const EDGE_WIDTH = 0.5;    // Fixed width for edges in mini-map

export const GraphMiniMap: React.FC<GraphMiniMapProps> = ({ mainGraphWidth, mainGraphHeight }) => {
  const {
    graphData,
    viewState,
    view,
  } = useStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const nodesContainerRef = useRef<PIXI.Container | null>(null);
  const edgesContainerRef = useRef<PIXI.Container | null>(null);
  const viewportRectRef = useRef<PIXI.Graphics | null>(null);

  const initializeMiniMap = useCallback(async () => {
    if (!canvasRef.current || pixiAppRef.current) return;

    const app = new PIXI.Application();
    await app.init({
      canvas: canvasRef.current,
      width: MINI_MAP_SIZE,
      height: MINI_MAP_SIZE,
      backgroundColor: 0x2a2a2a, // Darker background for contrast
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      eventMode: 'static',
      eventFeatures: {
        move: true,
        globalMove: false,
        click: true,
        wheel: false,
      },
    });

    pixiAppRef.current = app;

    const nodesContainer = new PIXI.Container();
    const edgesContainer = new PIXI.Container();
    const viewportRect = new PIXI.Graphics();

    app.stage.addChild(edgesContainer);
    app.stage.addChild(nodesContainer);
    app.stage.addChild(viewportRect);

    nodesContainerRef.current = nodesContainer;
    edgesContainerRef.current = edgesContainer;
    viewportRectRef.current = viewportRect;

    app.ticker.add(renderMiniMap);
  }, []);

  const renderMiniMap = useCallback(() => {
    if (!pixiAppRef.current || !nodesContainerRef.current || !edgesContainerRef.current || !viewportRectRef.current) return;

    const app = pixiAppRef.current;
    const nodesContainer = nodesContainerRef.current;
    const edgesContainer = edgesContainerRef.current;
    const viewportRect = viewportRectRef.current;

    // Clear existing graphics
    nodesContainer.removeChildren();
    edgesContainer.removeChildren();
    viewportRect.clear();

    // Calculate overall graph bounds for scaling
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    if (graphData.nodes.length > 0) {
      graphData.nodes.forEach(node => {
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        }
      });
    } else {
      // If no nodes, default to a small area around origin
      minX = -100; maxX = 100;
      minY = -100; maxY = 100;
    }

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    // Determine scaling factor for mini-map
    const scaleX = MINI_MAP_SIZE / (graphWidth + 200); // Add padding
    const scaleY = MINI_MAP_SIZE / (graphHeight + 200); // Add padding
    const miniMapScale = Math.min(scaleX, scaleY);

    // Offset to center the graph in the mini-map
    const offsetX = MINI_MAP_SIZE / 2 - (minX + graphWidth / 2) * miniMapScale;
    const offsetY = MINI_MAP_SIZE / 2 - (minY + graphHeight / 2) * miniMapScale;

    // Render nodes
    graphData.nodes.forEach(node => {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        const circle = new PIXI.Graphics();
        const radius = Math.max(NODE_MIN_RADIUS, Math.min(NODE_MAX_RADIUS, (node.degree || 1) * 0.2));
        circle.circle(0, 0, radius);
        circle.fill(0x8e8e93); // Default node color
        circle.position.set(node.x * miniMapScale + offsetX, node.y * miniMapScale + offsetY);
        nodesContainer.addChild(circle);
      }
    });

    // Render edges
    graphData.edges.forEach(edge => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);

      if (sourceNode && targetNode && typeof sourceNode.x === 'number' && typeof sourceNode.y === 'number' &&
          typeof targetNode.x === 'number' && typeof targetNode.y === 'number') {
        const line = new PIXI.Graphics();
        line.setStrokeStyle({ width: EDGE_WIDTH, color: 0x5a5a5a, alpha: 0.5 });
        line.moveTo(sourceNode.x * miniMapScale + offsetX, sourceNode.y * miniMapScale + offsetY);
        line.lineTo(targetNode.x * miniMapScale + offsetX, targetNode.y * miniMapScale + offsetY);
        line.stroke();
        edgesContainer.addChild(line);
      }
    });

    // Draw viewport rectangle
    const currentZoom = viewState.zoom;
    const currentPanX = viewState.pan.x;
    const currentPanY = viewState.pan.y;

    // Calculate viewport corners in world coordinates
    // World = (Screen - Pan - Center) / Zoom
    const worldViewWidth = mainGraphWidth / currentZoom;
    const worldViewHeight = mainGraphHeight / currentZoom;

    const worldViewX = (-currentPanX - mainGraphWidth / 2) / currentZoom;
    const worldViewY = (-currentPanY - mainGraphHeight / 2) / currentZoom;

    // Convert world viewport to mini-map coordinates
    const miniMapViewportX = worldViewX * miniMapScale + offsetX;
    const miniMapViewportY = worldViewY * miniMapScale + offsetY;
    const miniMapViewportWidth = worldViewWidth * miniMapScale;
    const miniMapViewportHeight = worldViewHeight * miniMapScale;

    viewportRect.setStrokeStyle({ width: 1, color: 0x00ff00, alpha: 0.8 });
    viewportRect.rect(miniMapViewportX, miniMapViewportY, miniMapViewportWidth, miniMapViewportHeight);
    viewportRect.stroke();

    // Make viewport draggable
    viewportRect.eventMode = 'static';
    viewportRect.cursor = 'grab';

    let isDragging = false;
    let lastPosition = { x: 0, y: 0 };

    viewportRect.on('pointerdown', (event) => {
      isDragging = true;
      lastPosition = { x: event.globalX, y: event.globalY };
      viewportRect.cursor = 'grabbing';
      event.stopPropagation();
    });

    app.stage.on('pointermove', (event) => {
      if (isDragging) {
        const dx = event.globalX - lastPosition.x;
        const dy = event.globalY - lastPosition.y;

        // Calculate new world pan based on mini-map drag
        const newWorldPanX = currentPanX - (dx / miniMapScale) * currentZoom;
        const newWorldPanY = currentPanY - (dy / miniMapScale) * currentZoom;

        view.updateViewport(currentZoom, { x: newWorldPanX, y: newWorldPanY });

        lastPosition = { x: event.globalX, y: event.globalY };
        event.stopPropagation();
      }
    });

    app.stage.on('pointerup', () => {
      isDragging = false;
      viewportRect.cursor = 'grab';
    });

  }, [graphData, viewState.zoom, viewState.pan, mainGraphWidth, mainGraphHeight, view]);

  useEffect(() => {
    initializeMiniMap();

    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.ticker.remove(renderMiniMap);
        pixiAppRef.current.destroy(true, { children: true, texture: true });
        pixiAppRef.current = null;
      }
    };
  }, [initializeMiniMap, renderMiniMap]);

  return (
    <div className="absolute bottom-4 right-4 bg-gray-800 p-2 rounded-lg shadow-lg z-20">
      <h4 className="text-white text-sm mb-1">Mini-map</h4>
      <canvas ref={canvasRef} className="border border-gray-600"></canvas>
    </div>
  );
};

export default GraphMiniMap;
