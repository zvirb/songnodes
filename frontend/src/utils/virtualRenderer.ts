/**
 * Virtual Rendering System with Level-of-Detail Optimization
 * Optimizes rendering performance for large graphs through viewport culling and LOD
 */

import type { NodeVisual, EdgeVisual } from '../types/graph';
import { globalMemoryManager } from './memoryManagement';

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface LODLevel {
  name: string;
  minScale: number;
  maxScale: number;
  nodeDetail: 'high' | 'medium' | 'low' | 'point';
  edgeDetail: 'full' | 'simplified' | 'hidden';
  maxNodes: number;
  maxEdges: number;
}

export interface RenderableNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  lodLevel: LODLevel;
  screenRadius: number;
  visible: boolean;
  priority: number;
}

export interface RenderableEdge {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: string;
  width: number;
  lodLevel: LODLevel;
  visible: boolean;
  priority: number;
}

export interface VirtualRenderStats {
  totalNodes: number;
  visibleNodes: number;
  renderedNodes: number;
  totalEdges: number;
  visibleEdges: number;
  renderedEdges: number;
  cullTime: number;
  lodTime: number;
  renderTime: number;
  memoryUsage: number;
  fps: number;
}

/**
 * Spatial indexing for viewport culling
 */
export class SpatialIndex {
  private quadTree: Map<string, { node: NodeVisual; bounds: { x: number; y: number; width: number; height: number } }> = new Map();
  private cellSize: number;
  private bounds: ViewportBounds;

  constructor(bounds: ViewportBounds, cellSize: number = 100) {
    this.bounds = bounds;
    this.cellSize = cellSize;
  }

  insert(node: NodeVisual): void {
    const cellX = Math.floor(node.x / this.cellSize);
    const cellY = Math.floor(node.y / this.cellSize);
    const key = `${cellX},${cellY}`;
    
    this.quadTree.set(node.id, {
      node,
      bounds: {
        x: cellX * this.cellSize,
        y: cellY * this.cellSize,
        width: this.cellSize,
        height: this.cellSize
      }
    });
  }

  query(viewport: ViewportBounds): NodeVisual[] {
    const results: NodeVisual[] = [];
    const startCellX = Math.floor(viewport.x / this.cellSize);
    const endCellX = Math.floor((viewport.x + viewport.width) / this.cellSize);
    const startCellY = Math.floor(viewport.y / this.cellSize);
    const endCellY = Math.floor((viewport.y + viewport.height) / this.cellSize);

    for (let cellX = startCellX; cellX <= endCellX; cellX++) {
      for (let cellY = startCellY; cellY <= endCellY; cellY++) {
        const key = `${cellX},${cellY}`;
        const entry = this.quadTree.get(key);
        if (entry && this.intersects(viewport, entry.bounds)) {
          results.push(entry.node);
        }
      }
    }

    return results;
  }

  clear(): void {
    this.quadTree.clear();
  }

  private intersects(viewport: ViewportBounds, bounds: { x: number; y: number; width: number; height: number }): boolean {
    return !(
      viewport.x > bounds.x + bounds.width ||
      viewport.x + viewport.width < bounds.x ||
      viewport.y > bounds.y + bounds.height ||
      viewport.y + viewport.height < bounds.y
    );
  }
}

/**
 * Level-of-Detail manager
 */
export class LODManager {
  private lodLevels: LODLevel[] = [
    {
      name: 'ultra-high',
      minScale: 4.0,
      maxScale: Infinity,
      nodeDetail: 'high',
      edgeDetail: 'full',
      maxNodes: 500,
      maxEdges: 1000
    },
    {
      name: 'high',
      minScale: 2.0,
      maxScale: 4.0,
      nodeDetail: 'high',
      edgeDetail: 'full',
      maxNodes: 1000,
      maxEdges: 2000
    },
    {
      name: 'medium',
      minScale: 1.0,
      maxScale: 2.0,
      nodeDetail: 'medium',
      edgeDetail: 'simplified',
      maxNodes: 2000,
      maxEdges: 3000
    },
    {
      name: 'low',
      minScale: 0.5,
      maxScale: 1.0,
      nodeDetail: 'low',
      edgeDetail: 'simplified',
      maxNodes: 3000,
      maxEdges: 4000
    },
    {
      name: 'ultra-low',
      minScale: 0.0,
      maxScale: 0.5,
      nodeDetail: 'point',
      edgeDetail: 'hidden',
      maxNodes: 5000,
      maxEdges: 0
    }
  ];

  getLODLevel(scale: number): LODLevel {
    return this.lodLevels.find(level => 
      scale >= level.minScale && scale < level.maxScale
    ) || this.lodLevels[this.lodLevels.length - 1];
  }

  shouldRenderNode(node: NodeVisual, lodLevel: LODLevel, screenRadius: number): boolean {
    // Minimum screen size threshold
    const minScreenRadius = this.getMinScreenRadius(lodLevel);
    if (screenRadius < minScreenRadius) return false;

    // Priority-based culling for node limits
    return true; // Will be handled by priority system
  }

  shouldRenderEdge(edge: EdgeVisual, lodLevel: LODLevel, screenDistance: number): boolean {
    if (lodLevel.edgeDetail === 'hidden') return false;
    
    // Minimum screen distance threshold
    const minScreenDistance = lodLevel.edgeDetail === 'full' ? 2 : 5;
    return screenDistance >= minScreenDistance;
  }

  private getMinScreenRadius(lodLevel: LODLevel): number {
    switch (lodLevel.nodeDetail) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      case 'point': return 0.5;
      default: return 1;
    }
  }

  getNodeRenderStyle(lodLevel: LODLevel): {
    useTextures: boolean;
    useShaders: boolean;
    useAntialiasing: boolean;
    simplifyGeometry: boolean;
  } {
    switch (lodLevel.nodeDetail) {
      case 'high':
        return {
          useTextures: true,
          useShaders: true,
          useAntialiasing: true,
          simplifyGeometry: false
        };
      case 'medium':
        return {
          useTextures: true,
          useShaders: true,
          useAntialiasing: false,
          simplifyGeometry: false
        };
      case 'low':
        return {
          useTextures: false,
          useShaders: false,
          useAntialiasing: false,
          simplifyGeometry: true
        };
      case 'point':
        return {
          useTextures: false,
          useShaders: false,
          useAntialiasing: false,
          simplifyGeometry: true
        };
      default:
        return {
          useTextures: false,
          useShaders: false,
          useAntialiasing: false,
          simplifyGeometry: true
        };
    }
  }
}

/**
 * Virtual renderer with viewport culling and LOD optimization
 */
export class VirtualRenderer {
  private spatialIndex: SpatialIndex;
  private lodManager: LODManager;
  private stats: VirtualRenderStats;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: ViewportBounds;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;

  constructor(canvas: HTMLCanvasElement, initialViewport: ViewportBounds) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.viewport = initialViewport;
    
    this.spatialIndex = new SpatialIndex(initialViewport);
    this.lodManager = new LODManager();
    
    this.stats = {
      totalNodes: 0,
      visibleNodes: 0,
      renderedNodes: 0,
      totalEdges: 0,
      visibleEdges: 0,
      renderedEdges: 0,
      cullTime: 0,
      lodTime: 0,
      renderTime: 0,
      memoryUsage: 0,
      fps: 0
    };
  }

  /**
   * Main render function with full optimization pipeline
   */
  render(nodes: NodeVisual[], edges: EdgeVisual[], viewport: ViewportBounds): VirtualRenderStats {
    const frameStart = performance.now();
    this.viewport = viewport;
    
    // Reset stats
    this.resetStats(nodes.length, edges.length);
    
    // Step 1: Viewport culling
    const cullStart = performance.now();
    const visibleNodes = this.cullNodes(nodes);
    const visibleEdges = this.cullEdges(edges, visibleNodes);
    this.stats.cullTime = performance.now() - cullStart;
    
    // Step 2: Level-of-Detail processing
    const lodStart = performance.now();
    const renderableNodes = this.processNodeLOD(visibleNodes);
    const renderableEdges = this.processEdgeLOD(visibleEdges);
    this.stats.lodTime = performance.now() - lodStart;
    
    // Step 3: Priority-based selection
    const finalNodes = this.selectNodesByPriority(renderableNodes);
    const finalEdges = this.selectEdgesByPriority(renderableEdges);
    
    // Step 4: Rendering
    const renderStart = performance.now();
    this.renderNodes(finalNodes);
    this.renderEdges(finalEdges);
    this.stats.renderTime = performance.now() - renderStart;
    
    // Update final stats
    this.stats.renderedNodes = finalNodes.length;
    this.stats.renderedEdges = finalEdges.length;
    this.updateFPS();
    this.updateMemoryUsage();
    
    return { ...this.stats };
  }

  /**
   * Update viewport bounds
   */
  updateViewport(viewport: ViewportBounds): void {
    this.viewport = viewport;
    this.spatialIndex = new SpatialIndex(viewport);
  }

  /**
   * Viewport culling for nodes
   */
  private cullNodes(nodes: NodeVisual[]): NodeVisual[] {
    // Rebuild spatial index
    this.spatialIndex.clear();
    nodes.forEach(node => this.spatialIndex.insert(node));
    
    // Expand viewport for buffer zone
    const bufferZone = 100;
    const expandedViewport: ViewportBounds = {
      x: this.viewport.x - bufferZone,
      y: this.viewport.y - bufferZone,
      width: this.viewport.width + bufferZone * 2,
      height: this.viewport.height + bufferZone * 2,
      scale: this.viewport.scale
    };
    
    const visibleNodes = this.spatialIndex.query(expandedViewport);
    this.stats.visibleNodes = visibleNodes.length;
    
    return visibleNodes;
  }

  /**
   * Viewport culling for edges
   */
  private cullEdges(edges: EdgeVisual[], visibleNodes: NodeVisual[]): EdgeVisual[] {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    
    const visibleEdges = edges.filter(edge => {
      const sourceVisible = visibleNodeIds.has(edge.sourceNode.id);
      const targetVisible = visibleNodeIds.has(edge.targetNode.id);
      
      // Include edge if at least one endpoint is visible
      return sourceVisible || targetVisible;
    });
    
    this.stats.visibleEdges = visibleEdges.length;
    return visibleEdges;
  }

  /**
   * Level-of-Detail processing for nodes
   */
  private processNodeLOD(nodes: NodeVisual[]): RenderableNode[] {
    const lodLevel = this.lodManager.getLODLevel(this.viewport.scale);
    const renderableNodes: RenderableNode[] = [];
    
    for (const node of nodes) {
      const screenX = (node.x - this.viewport.x) * this.viewport.scale;
      const screenY = (node.y - this.viewport.y) * this.viewport.scale;
      const screenRadius = node.radius * this.viewport.scale;
      
      // Check if node should be rendered at this LOD level
      if (this.lodManager.shouldRenderNode(node, lodLevel, screenRadius)) {
        const priority = this.calculateNodePriority(node, screenRadius);
        
        renderableNodes.push({
          id: node.id,
          x: screenX,
          y: screenY,
          radius: screenRadius,
          color: node.color,
          lodLevel,
          screenRadius,
          visible: true,
          priority
        });
      }
    }
    
    return renderableNodes;
  }

  /**
   * Level-of-Detail processing for edges
   */
  private processEdgeLOD(edges: EdgeVisual[]): RenderableEdge[] {
    const lodLevel = this.lodManager.getLODLevel(this.viewport.scale);
    const renderableEdges: RenderableEdge[] = [];
    
    for (const edge of edges) {
      const sourceX = (edge.sourceNode.x - this.viewport.x) * this.viewport.scale;
      const sourceY = (edge.sourceNode.y - this.viewport.y) * this.viewport.scale;
      const targetX = (edge.targetNode.x - this.viewport.x) * this.viewport.scale;
      const targetY = (edge.targetNode.y - this.viewport.y) * this.viewport.scale;
      
      const screenDistance = Math.sqrt(
        Math.pow(targetX - sourceX, 2) + Math.pow(targetY - sourceY, 2)
      );
      
      if (this.lodManager.shouldRenderEdge(edge, lodLevel, screenDistance)) {
        const priority = this.calculateEdgePriority(edge, screenDistance);
        
        renderableEdges.push({
          id: edge.id,
          sourceX,
          sourceY,
          targetX,
          targetY,
          color: edge.color,
          width: edge.width * this.viewport.scale,
          lodLevel,
          visible: true,
          priority
        });
      }
    }
    
    return renderableEdges;
  }

  /**
   * Priority-based node selection
   */
  private selectNodesByPriority(nodes: RenderableNode[]): RenderableNode[] {
    const lodLevel = this.lodManager.getLODLevel(this.viewport.scale);
    
    if (nodes.length <= lodLevel.maxNodes) {
      return nodes;
    }
    
    // Sort by priority and take top N
    return nodes
      .sort((a, b) => b.priority - a.priority)
      .slice(0, lodLevel.maxNodes);
  }

  /**
   * Priority-based edge selection
   */
  private selectEdgesByPriority(edges: RenderableEdge[]): RenderableEdge[] {
    const lodLevel = this.lodManager.getLODLevel(this.viewport.scale);
    
    if (edges.length <= lodLevel.maxEdges) {
      return edges;
    }
    
    // Sort by priority and take top N
    return edges
      .sort((a, b) => b.priority - a.priority)
      .slice(0, lodLevel.maxEdges);
  }

  /**
   * Calculate rendering priority for nodes
   */
  private calculateNodePriority(node: NodeVisual, screenRadius: number): number {
    let priority = 0;
    
    // Size priority (larger nodes get higher priority)
    priority += screenRadius * 10;
    
    // Centrality priority (important nodes get higher priority)
    if (node.metrics?.centrality) {
      priority += node.metrics.centrality * 100;
    }
    
    // Distance from center priority (closer to center gets higher priority)
    const centerX = this.viewport.x + this.viewport.width / 2;
    const centerY = this.viewport.y + this.viewport.height / 2;
    const distanceFromCenter = Math.sqrt(
      Math.pow(node.x - centerX, 2) + Math.pow(node.y - centerY, 2)
    );
    priority += Math.max(0, 1000 - distanceFromCenter);
    
    return priority;
  }

  /**
   * Calculate rendering priority for edges
   */
  private calculateEdgePriority(edge: EdgeVisual, screenDistance: number): number {
    let priority = 0;
    
    // Weight priority (stronger connections get higher priority)
    priority += edge.weight * 50;
    
    // Distance priority (longer edges get lower priority)
    priority += Math.max(0, 200 - screenDistance);
    
    // Node importance priority
    const sourceImportance = edge.sourceNode.metrics?.centrality || 0;
    const targetImportance = edge.targetNode.metrics?.centrality || 0;
    priority += (sourceImportance + targetImportance) * 25;
    
    return priority;
  }

  /**
   * Render nodes with LOD-appropriate styling
   */
  private renderNodes(nodes: RenderableNode[]): void {
    for (const node of nodes) {
      const style = this.lodManager.getNodeRenderStyle(node.lodLevel);
      
      this.ctx.save();
      this.ctx.fillStyle = node.color;
      
      if (style.useAntialiasing) {
        this.ctx.imageSmoothingEnabled = true;
      } else {
        this.ctx.imageSmoothingEnabled = false;
      }
      
      if (node.lodLevel.nodeDetail === 'point') {
        // Render as simple point
        this.ctx.fillRect(node.x - 1, node.y - 1, 2, 2);
      } else if (style.simplifyGeometry) {
        // Render as simple circle
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, Math.max(1, node.radius), 0, 2 * Math.PI);
        this.ctx.fill();
      } else {
        // Render with full detail
        this.renderHighDetailNode(node);
      }
      
      this.ctx.restore();
    }
  }

  /**
   * Render edges with LOD-appropriate styling
   */
  private renderEdges(edges: RenderableEdge[]): void {
    for (const edge of edges) {
      this.ctx.save();
      this.ctx.strokeStyle = edge.color;
      this.ctx.lineWidth = Math.max(0.5, edge.width);
      this.ctx.lineCap = 'round';
      
      if (edge.lodLevel.edgeDetail === 'simplified') {
        // Simple straight line
        this.ctx.beginPath();
        this.ctx.moveTo(edge.sourceX, edge.sourceY);
        this.ctx.lineTo(edge.targetX, edge.targetY);
        this.ctx.stroke();
      } else {
        // Full detail with curves or arrows
        this.renderHighDetailEdge(edge);
      }
      
      this.ctx.restore();
    }
  }

  /**
   * High-detail node rendering
   */
  private renderHighDetailNode(node: RenderableNode): void {
    // Gradient fill
    const gradient = this.ctx.createRadialGradient(
      node.x, node.y, 0,
      node.x, node.y, node.radius
    );
    gradient.addColorStop(0, node.color);
    gradient.addColorStop(1, this.darkenColor(node.color, 0.3));
    
    this.ctx.fillStyle = gradient;
    
    // Main circle
    this.ctx.beginPath();
    this.ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Border
    this.ctx.strokeStyle = this.darkenColor(node.color, 0.5);
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  /**
   * High-detail edge rendering
   */
  private renderHighDetailEdge(edge: RenderableEdge): void {
    // Add slight curve for better visual appeal
    const midX = (edge.sourceX + edge.targetX) / 2;
    const midY = (edge.sourceY + edge.targetY) / 2;
    const angle = Math.atan2(edge.targetY - edge.sourceY, edge.targetX - edge.sourceX);
    const perpAngle = angle + Math.PI / 2;
    const curveAmount = 10;
    
    const controlX = midX + Math.cos(perpAngle) * curveAmount;
    const controlY = midY + Math.sin(perpAngle) * curveAmount;
    
    this.ctx.beginPath();
    this.ctx.moveTo(edge.sourceX, edge.sourceY);
    this.ctx.quadraticCurveTo(controlX, controlY, edge.targetX, edge.targetY);
    this.ctx.stroke();
  }

  /**
   * Utility methods
   */
  private darkenColor(color: string, amount: number): string {
    // Simple color darkening
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const newR = Math.floor(r * (1 - amount));
    const newG = Math.floor(g * (1 - amount));
    const newB = Math.floor(b * (1 - amount));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }

  private resetStats(nodeCount: number, edgeCount: number): void {
    this.stats.totalNodes = nodeCount;
    this.stats.totalEdges = edgeCount;
    this.stats.visibleNodes = 0;
    this.stats.visibleEdges = 0;
    this.stats.renderedNodes = 0;
    this.stats.renderedEdges = 0;
    this.stats.cullTime = 0;
    this.stats.lodTime = 0;
    this.stats.renderTime = 0;
  }

  private updateFPS(): void {
    const now = performance.now();
    this.frameCount++;
    
    if (now - this.lastFpsUpdate > 1000) {
      this.stats.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  private updateMemoryUsage(): void {
    const metrics = globalMemoryManager.getMetrics();
    this.stats.memoryUsage = metrics.overall.memoryUsage;
  }

  /**
   * Get current statistics
   */
  getStats(): VirtualRenderStats {
    return { ...this.stats };
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

/**
 * Factory function for creating virtual renderer
 */
export function createVirtualRenderer(canvas: HTMLCanvasElement, viewport: ViewportBounds): VirtualRenderer {
  return new VirtualRenderer(canvas, viewport);
}

/**
 * Utility function for calculating optimal LOD settings
 */
export function calculateOptimalLOD(nodeCount: number, targetFPS: number = 60): LODLevel {
  // Heuristic for determining optimal LOD based on node count and target FPS
  if (nodeCount < 500) {
    return {
      name: 'high',
      minScale: 1.0,
      maxScale: Infinity,
      nodeDetail: 'high',
      edgeDetail: 'full',
      maxNodes: nodeCount,
      maxEdges: nodeCount * 2
    };
  } else if (nodeCount < 2000) {
    return {
      name: 'medium',
      minScale: 0.5,
      maxScale: Infinity,
      nodeDetail: 'medium',
      edgeDetail: 'simplified',
      maxNodes: Math.min(1000, nodeCount),
      maxEdges: Math.min(2000, nodeCount * 1.5)
    };
  } else {
    return {
      name: 'low',
      minScale: 0.0,
      maxScale: Infinity,
      nodeDetail: 'low',
      edgeDetail: 'simplified',
      maxNodes: Math.min(3000, nodeCount * 0.6),
      maxEdges: Math.min(4000, nodeCount * 0.8)
    };
  }
}