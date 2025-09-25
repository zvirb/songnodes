import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import * as PIXI from 'pixi.js';
import { useDrag, usePinch } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';

interface Node {
  id: string;
  x: number;
  y: number;
  label?: string;
  title?: string;
  artist?: string;
  size?: number;
  isCluster?: boolean;
  color?: number;
}

interface Edge {
  id?: string;
  source: string;
  target: string;
  weight?: number;
}

interface OptimizedPixiCanvasProps {
  width: number;
  height: number;
  nodes: Node[];
  edges: Edge[];
  onNodeRightClick?: (node: Node, event: React.MouseEvent) => void;
  enableClustering?: boolean;
  lodThresholds?: {
    high: number;
    medium: number;
    low: number;
  };
}

class SpatialIndex {
  private grid: Map<string, Node[]>;
  private cellSize: number;

  constructor(cellSize: number = 100) {
    this.grid = new Map();
    this.cellSize = cellSize;
  }

  clear() {
    this.grid.clear();
  }

  addNode(node: Node) {
    const key = this.getKey(node.x, node.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key)!.push(node);
  }

  private getKey(x: number, y: number): string {
    const gridX = Math.floor(x / this.cellSize);
    const gridY = Math.floor(y / this.cellSize);
    return `${gridX},${gridY}`;
  }

  getNodesInRegion(x: number, y: number, width: number, height: number): Node[] {
    const nodes: Node[] = [];
    const startX = Math.floor(x / this.cellSize);
    const startY = Math.floor(y / this.cellSize);
    const endX = Math.floor((x + width) / this.cellSize);
    const endY = Math.floor((y + height) / this.cellSize);

    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const key = `${gx},${gy}`;
        const cellNodes = this.grid.get(key);
        if (cellNodes) {
          nodes.push(...cellNodes);
        }
      }
    }
    return nodes;
  }
}

class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;

  constructor(createFn: () => T, resetFn: (item: T) => void, initialSize: number = 100) {
    this.createFn = createFn;
    this.resetFn = resetFn;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn());
    }
  }

  acquire(): T {
    return this.pool.pop() || this.createFn();
  }

  release(item: T) {
    if (item) {
      this.resetFn(item);
      this.pool.push(item);
    }
  }

  releaseAll(items: T[]) {
    items.forEach(item => {
      if (item) this.release(item);
    });
  }
}

export const OptimizedPixiCanvas: React.FC<OptimizedPixiCanvasProps> = ({
  width,
  height,
  nodes,
  edges,
  onNodeRightClick,
  enableClustering = true,
  lodThresholds = { high: 2, medium: 1, low: 0.5 }
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const containerRef = useRef<PIXI.Container | null>(null);
  const nodeContainerRef = useRef<PIXI.Container | null>(null);
  const edgeGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const nodePoolRef = useRef<ObjectPool<PIXI.Graphics> | null>(null);
  const activeNodesRef = useRef<PIXI.Graphics[]>([]);
  const spatialIndexRef = useRef<SpatialIndex>(new SpatialIndex());
  const lastRenderTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTextRef = useRef<PIXI.Text | null>(null);

  const [{ x, y, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    config: { mass: 1, tension: 500, friction: 50 },
  }));

  useDrag(
    ({ offset: [dx, dy] }) => {
      api.start({ x: dx, y: dy });
    },
    {
      target: canvasRef,
      eventOptions: { passive: false },
    }
  );

  usePinch(
    ({ offset: [s] }) => {
      api.start({ scale: Math.max(0.1, Math.min(10, s)) });
    },
    {
      target: canvasRef,
      eventOptions: { passive: false },
    }
  );

  const getLodLevel = useCallback((zoom: number) => {
    if (zoom >= lodThresholds.high) return 3;
    if (zoom >= lodThresholds.medium) return 2;
    if (zoom >= lodThresholds.low) return 1;
    return 0;
  }, [lodThresholds]);

  const clusterNodes = useCallback((nodes: Node[], zoom: number): Node[] => {
    if (!enableClustering || zoom > 0.7) return nodes;

    const clusterRadius = 50 / zoom;
    const clusters: Map<string, Node[]> = new Map();
    const visited = new Set<string>();

    nodes.forEach(node => {
      if (visited.has(node.id)) return;

      const cluster: Node[] = [node];
      visited.add(node.id);

      nodes.forEach(other => {
        if (!visited.has(other.id)) {
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < clusterRadius) {
            cluster.push(other);
            visited.add(other.id);
          }
        }
      });

      if (cluster.length > 1) {
        const avgX = cluster.reduce((sum, n) => sum + n.x, 0) / cluster.length;
        const avgY = cluster.reduce((sum, n) => sum + n.y, 0) / cluster.length;
        clusters.set(`cluster-${node.id}`, cluster);
      }
    });

    const result: Node[] = [];
    clusters.forEach((cluster, id) => {
      if (cluster.length > 1) {
        const avgX = cluster.reduce((sum, n) => sum + n.x, 0) / cluster.length;
        const avgY = cluster.reduce((sum, n) => sum + n.y, 0) / cluster.length;
        result.push({
          id,
          x: avgX,
          y: avgY,
          isCluster: true,
          size: cluster.length,
          label: `${cluster.length} tracks`,
        });
      } else {
        result.push(...cluster);
      }
    });

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        result.push(node);
      }
    });

    return result;
  }, [enableClustering]);

  const updateFPS = useCallback(() => {
    if (!fpsTextRef.current) return;

    const now = performance.now();
    frameCountRef.current++;

    if (now - lastRenderTimeRef.current >= 1000) {
      const fps = Math.round(frameCountRef.current * 1000 / (now - lastRenderTimeRef.current));
      fpsTextRef.current.text = `FPS: ${fps}`;
      frameCountRef.current = 0;
      lastRenderTimeRef.current = now;
    }
  }, []);

  const render = useCallback(() => {
    if (!containerRef.current || !nodeContainerRef.current || !edgeGraphicsRef.current || !nodePoolRef.current) return;

    const zoom = scale.get();
    const lodLevel = getLodLevel(zoom);
    const container = containerRef.current;
    const nodeContainer = nodeContainerRef.current;
    const edgeGraphics = edgeGraphicsRef.current;
    const nodePool = nodePoolRef.current;
    const spatialIndex = spatialIndexRef.current;

    nodePool.releaseAll(activeNodesRef.current);
    activeNodesRef.current = [];
    nodeContainer.removeChildren();

    spatialIndex.clear();
    const processedNodes = enableClustering ? clusterNodes(nodes, zoom) : nodes;
    processedNodes.forEach(node => spatialIndex.addNode(node));

    const screenWidth = width / zoom;
    const screenHeight = height / zoom;
    const screenX = -container.x / zoom;
    const screenY = -container.y / zoom;
    const padding = 100;

    const visibleNodes = spatialIndex.getNodesInRegion(
      screenX - padding,
      screenY - padding,
      screenWidth + padding * 2,
      screenHeight + padding * 2
    );

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    edgeGraphics.clear();
    if (lodLevel > 0) {
      const edgesToRender = edges.filter(edge =>
        visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      );

      const edgeAlpha = lodLevel === 1 ? 0.3 : lodLevel === 2 ? 0.5 : 0.7;
      const lineWidth = lodLevel === 1 ? 0.5 : 1;

      edgeGraphics.lineStyle(lineWidth, 0x4A5568, edgeAlpha);

      const nodeMap = new Map(visibleNodes.map(n => [n.id, n]));

      edgesToRender.forEach(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (source && target) {
          edgeGraphics.moveTo(source.x, source.y);
          edgeGraphics.lineTo(target.x, target.y);
        }
      });
    }

    visibleNodes.forEach(node => {
      const nodeGraphic = nodePool.acquire();
      nodeGraphic.clear();

      if (node.isCluster) {
        const clusterRadius = 8 + Math.min(20, Math.sqrt(node.size || 1) * 3);
        const color = 0x10B981;

        if (lodLevel > 1) {
          nodeGraphic.lineStyle(2, color, 0.8);
          nodeGraphic.beginFill(color, 0.3);
        } else {
          nodeGraphic.beginFill(color, 0.4);
        }
        nodeGraphic.drawCircle(0, 0, clusterRadius);
        nodeGraphic.endFill();

        if (lodLevel > 2 && node.size) {
          const text = new PIXI.Text(node.size.toString(), {
            fontSize: 10,
            fill: 0xFFFFFF,
          });
          text.anchor.set(0.5);
          nodeGraphic.addChild(text);
        }
      } else {
        const nodeRadius = lodLevel === 0 ? 3 : lodLevel === 1 ? 4 : lodLevel === 2 ? 5 : 6;
        const color = node.color || 0x60A5FA;
        const alpha = lodLevel === 0 ? 0.6 : lodLevel === 1 ? 0.7 : lodLevel === 2 ? 0.85 : 1;

        nodeGraphic.beginFill(color, alpha);
        if (lodLevel > 2) {
          nodeGraphic.lineStyle(1, 0xFFFFFF, 0.3);
        }
        nodeGraphic.drawCircle(0, 0, nodeRadius);
        nodeGraphic.endFill();
      }

      nodeGraphic.position.set(node.x, node.y);
      nodeGraphic.interactive = lodLevel > 0;
      nodeGraphic.buttonMode = lodLevel > 0;

      if (lodLevel > 0 && onNodeRightClick) {
        nodeGraphic.on('rightclick', (event: PIXI.InteractionEvent) => {
          onNodeRightClick(node, event.data.originalEvent as React.MouseEvent);
        });
      }

      nodeContainer.addChild(nodeGraphic);
      activeNodesRef.current.push(nodeGraphic);
    });

    updateFPS();
  }, [nodes, edges, width, height, scale, getLodLevel, clusterNodes, enableClustering, onNodeRightClick, updateFPS]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new PIXI.Application({
      width,
      height,
      backgroundColor: 0x0F172A,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      powerPreference: 'high-performance',
    });

    appRef.current = app;
    canvasRef.current.appendChild(app.view as unknown as Node);

    const container = new PIXI.Container();
    app.stage.addChild(container);
    containerRef.current = container;

    const edgeGraphics = new PIXI.Graphics();
    container.addChild(edgeGraphics);
    edgeGraphicsRef.current = edgeGraphics;

    const nodeContainer = new PIXI.Container();
    container.addChild(nodeContainer);
    nodeContainerRef.current = nodeContainer;

    const fpsText = new PIXI.Text('FPS: 0', {
      fontSize: 14,
      fill: 0xFFFFFF,
    });
    fpsText.position.set(10, 10);
    app.stage.addChild(fpsText);
    fpsTextRef.current = fpsText;

    nodePoolRef.current = new ObjectPool<PIXI.Graphics>(
      () => new PIXI.Graphics(),
      (g) => {
        if (g && !g.destroyed) {
          g.clear();
          g.removeAllListeners();
          if (g.children && g.children.length > 0) {
            g.removeChildren();
          }
        }
      },
      500
    );

    let animationFrame: number;
    const animate = () => {
      container.x = x.get();
      container.y = y.get();
      container.scale.set(scale.get());

      render();

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
    };
  }, [width, height, x, y, scale, render]);

  return (
    <div
      ref={canvasRef}
      style={{ width, height, touchAction: 'none' }}
      onWheel={(e) => {
        e.preventDefault();
        e.stopPropagation();

        // Zoom settings
        const zoomSensitivity = 0.002; // Adjust for smoother zooming
        const minZoom = 0.1;
        const maxZoom = 5;

        // Calculate zoom based on wheel delta
        const delta = e.deltaY * -zoomSensitivity;
        const zoomFactor = Math.exp(delta); // Exponential zoom for smoother feel

        // Get current scale and calculate new scale
        const currentScale = scale.get();
        const newScale = Math.max(minZoom, Math.min(maxZoom, currentScale * zoomFactor));

        // Get mouse position relative to canvas
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          // Calculate zoom towards mouse position
          const currentX = x.get();
          const currentY = y.get();

          // Adjust pan to zoom towards mouse cursor
          const scaleRatio = newScale / currentScale;
          const newX = mouseX - (mouseX - currentX) * scaleRatio;
          const newY = mouseY - (mouseY - currentY) * scaleRatio;

          // Animate zoom and pan smoothly
          api.start({
            scale: newScale,
            x: newX,
            y: newY,
            config: { mass: 1, tension: 300, friction: 30 }
          });
        } else {
          // Fallback to center zoom if rect not available
          api.start({
            scale: newScale,
            config: { mass: 1, tension: 300, friction: 30 }
          });
        }
      }}
    />
  );
};