import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { NodeVisual, EdgeVisual, LayoutOptions } from '@types/graph';
import { useOptimizedForceLayout } from '@hooks/useOptimizedForceLayout';
import { globalPerformanceMonitor, recordFramePerformance } from '@utils/performanceMonitor';
import { globalMemoryManager } from '@utils/memoryManagement';
import { VirtualRenderer, ViewportBounds } from '@utils/virtualRenderer';

interface D3ForceSimulationProps {
  nodes: NodeVisual[];
  edges: EdgeVisual[];
  width: number;
  height: number;
  layoutOptions: LayoutOptions;
  onTick: (nodes: NodeVisual[]) => void;
  onEnd?: () => void;
  performanceMode?: 'high' | 'balanced' | 'battery';
  enableVirtualRendering?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export class D3ForceSimulation {
  private simulation: d3.Simulation<NodeVisual, EdgeVisual> | null = null;
  private quadtree: d3.Quadtree<NodeVisual> | null = null;
  private mutableNodes: NodeVisual[] = [];
  private mutableEdges: EdgeVisual[] = [];
  private width: number;
  private height: number;
  private layoutOptions: LayoutOptions;
  
  constructor(
    width: number,
    height: number,
    layoutOptions: LayoutOptions
  ) {
    this.width = width;
    this.height = height;
    this.layoutOptions = layoutOptions;
  }
  
  initialize(
    nodes: NodeVisual[],
    edges: EdgeVisual[],
    onTick: (nodes: NodeVisual[]) => void,
    onEnd?: () => void
  ): void {
    const options = this.layoutOptions.forceDirected;
    if (!options) return;
    
    // Create mutable copies of nodes for D3.js simulation
    // D3.js needs to be able to add vx, vy properties to node objects
    this.mutableNodes = nodes.map(node => ({
      ...node,
      // Ensure D3.js required properties are initialized
      vx: 0,
      vy: 0,
      fx: node.fx || undefined,
      fy: node.fy || undefined,
    }));
    
    // Create mutable copies of edges
    this.mutableEdges = edges.map(edge => ({ ...edge }));
    
    // Create simulation with mutable nodes
    this.simulation = d3.forceSimulation(this.mutableNodes)
      .alphaDecay(options.alphaDecay)
      .velocityDecay(options.velocityDecay);
    
    // Add forces
    this.addForces(this.mutableNodes, this.mutableEdges);
    
    // Set up event handlers with throttling
    let lastTickTime = 0;
    const TICK_THROTTLE = 16; // ~60fps limit
    
    this.simulation.on('tick', () => {
      const now = performance.now();
      
      // Throttle tick processing to prevent performance violations
      if (now - lastTickTime < TICK_THROTTLE) {
        return;
      }
      
      lastTickTime = now;
      
      // Update original nodes with positions from mutable copies
      const updatedNodes = nodes.map(originalNode => {
        const mutableNode = this.mutableNodes.find(mn => mn.id === originalNode.id);
        if (mutableNode) {
          return {
            ...originalNode,
            x: mutableNode.x,
            y: mutableNode.y,
          };
        }
        return originalNode;
      });
      
      // Defer expensive operations using requestIdleCallback
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          this.updateQuadtree(this.mutableNodes);
          onTick(updatedNodes);
        }, { timeout: 8 });
      } else {
        // Fallback: use setTimeout to yield control
        setTimeout(() => {
          this.updateQuadtree(this.mutableNodes);
          onTick(updatedNodes);
        }, 0);
      }
    });
    
    if (onEnd) {
      this.simulation.on('end', onEnd);
    }
    
    // Initialize quadtree for collision detection
    this.updateQuadtree(this.mutableNodes);
  }
  
  private addForces(nodes: NodeVisual[], edges: EdgeVisual[]): void {
    const options = this.layoutOptions.forceDirected;
    if (!this.simulation || !options) return;
    
    // Link force
    const linkForce = d3.forceLink<NodeVisual, EdgeVisual>(edges)
      .id(d => d.id)
      .distance(d => {
        // Dynamic link distance based on edge weight and node importance
        const baseDistance = options.linkDistance;
        const weightFactor = Math.max(0.5, d.weight);
        const importanceFactor = (
          (d.sourceNode.metrics?.centrality ?? 0.1) + 
          (d.targetNode.metrics?.centrality ?? 0.1)
        ) / 2;
        
        return baseDistance * (1 / weightFactor) * (1 + importanceFactor);
      })
      .strength(d => {
        // Stronger links for higher weights
        return options.linkStrength * Math.sqrt(d.weight);
      });
    
    this.simulation.force('link', linkForce);
    
    // Charge force with Barnes-Hut optimization
    const chargeForce = d3.forceManyBody()
      .strength(d => {
        // Stronger repulsion for more important nodes
        const baseStrength = options.chargeStrength;
        const importance = d.metrics?.centrality ?? 0.1;
        return baseStrength * (1 + importance * 2);
      })
      .theta(options.chargeTheta) // Barnes-Hut approximation parameter
      .distanceMin(1)
      .distanceMax(Math.max(this.width, this.height) / 2);
    
    this.simulation.force('charge', chargeForce);
    
    // Center force
    if (options.centering) {
      this.simulation.force('center', d3.forceCenter(this.width / 2, this.height / 2));
    }
    
    // Collision force
    if (options.collisionRadius > 0) {
      const collisionForce = d3.forceCollide<NodeVisual>()
        .radius(d => d.radius + options.collisionRadius)
        .strength(0.7)
        .iterations(3);
      
      this.simulation.force('collision', collisionForce);
    }
    
    // Additional forces for better layout
    
    // X and Y positioning forces for stability
    this.simulation.force('x', d3.forceX<NodeVisual>(this.width / 2).strength(0.1));
    this.simulation.force('y', d3.forceY<NodeVisual>(this.height / 2).strength(0.1));
    
    // Genre clustering force
    const genreForce = this.createGenreClusteringForce(this.mutableNodes);
    this.simulation.force('genre', genreForce);
    
    // Temporal arrangement force
    const temporalForce = this.createTemporalArrangementForce(this.mutableNodes);
    this.simulation.force('temporal', temporalForce);
  }
  
  private createGenreClusteringForce(nodes: NodeVisual[]): d3.Force<NodeVisual, undefined> {
    // Group nodes by primary genre
    const genreGroups = new Map<string, NodeVisual[]>();
    nodes.forEach(node => {
      const primaryGenre = (node.genres && node.genres[0]) || 'unknown';
      if (!genreGroups.has(primaryGenre)) {
        genreGroups.set(primaryGenre, []);
      }
      genreGroups.get(primaryGenre)!.push(node);
    });
    
    // Calculate genre cluster centers
    const genrecenters = new Map<string, { x: number; y: number }>();
    const genres = Array.from(genreGroups.keys());
    const angleStep = (2 * Math.PI) / genres.length;
    const clusterRadius = Math.min(this.width, this.height) * 0.3;
    
    genres.forEach((genre, i) => {
      const angle = i * angleStep;
      genrecenters.set(genre, {
        x: this.width / 2 + clusterRadius * Math.cos(angle),
        y: this.height / 2 + clusterRadius * Math.sin(angle),
      });
    });
    
    return (alpha: number) => {
      const strength = alpha * 0.1; // Gentle clustering force
      
      nodes.forEach(node => {
        const primaryGenre = (node.genres && node.genres[0]) || 'unknown';
        const center = genrecenters.get(primaryGenre);
        if (center) {
          const dx = center.x - node.x;
          const dy = center.y - node.y;
          node.vx = (node.vx || 0) + dx * strength;
          node.vy = (node.vy || 0) + dy * strength;
        }
      });
    };
  }
  
  private createTemporalArrangementForce(nodes: NodeVisual[]): d3.Force<NodeVisual, undefined> {
    // Extract years and create temporal scale
    const years = nodes
      .map(n => n.releaseDate ? new Date(n.releaseDate).getFullYear() : null)
      .filter(y => y !== null) as number[];
    
    if (years.length === 0) return () => {}; // No temporal data
    
    const yearScale = d3.scaleLinear()
      .domain(d3.extent(years) as [number, number])
      .range([0, this.width]);
    
    return (alpha: number) => {
      const strength = alpha * 0.05; // Very gentle temporal arrangement
      
      nodes.forEach(node => {
        if (node.releaseDate) {
          const year = new Date(node.releaseDate).getFullYear();
          const targetX = yearScale(year);
          const dx = targetX - node.x;
          node.vx = (node.vx || 0) + dx * strength;
        }
      });
    };
  }
  
  private updateQuadtree(nodes: NodeVisual[]): void {
    this.quadtree = d3.quadtree<NodeVisual>()
      .x(d => d.x)
      .y(d => d.y)
      .addAll(nodes);
  }
  
  start(): void {
    if (this.simulation) {
      this.simulation.alpha(this.layoutOptions.forceDirected?.alpha || 1).restart();
    }
  }
  
  stop(): void {
    if (this.simulation) {
      this.simulation.stop();
    }
  }
  
  tick(): void {
    if (this.simulation) {
      this.simulation.tick();
    }
  }
  
  reheat(): void {
    if (this.simulation) {
      this.simulation.alpha(0.3).restart();
    }
  }
  
  updateNodes(nodes: NodeVisual[]): void {
    if (this.simulation) {
      // Update mutable copies
      this.mutableNodes = nodes.map(node => ({
        ...node,
        vx: 0,
        vy: 0,
        fx: node.fx || undefined,
        fy: node.fy || undefined,
      }));
      
      this.simulation.nodes(this.mutableNodes);
      this.updateQuadtree(this.mutableNodes);
    }
  }
  
  updateEdges(edges: EdgeVisual[]): void {
    if (this.simulation) {
      // Update mutable copies
      this.mutableEdges = edges.map(edge => ({ ...edge }));
      
      const linkForce = this.simulation.force('link') as d3.ForceLink<NodeVisual, EdgeVisual>;
      if (linkForce) {
        linkForce.links(this.mutableEdges);
      }
    }
  }
  
  updateLayoutOptions(options: LayoutOptions): void {
    this.layoutOptions = options;
    // Reapply forces with new options
    // This would require re-initializing forces
  }
  
  // Spatial queries using quadtree
  findNodesInRadius(x: number, y: number, radius: number): NodeVisual[] {
    if (!this.quadtree) return [];
    
    const found: NodeVisual[] = [];
    this.quadtree.visit((node, x0, y0, x1, y1) => {
      if (node.length) {
        // Internal node
        return x > x1 + radius || x < x0 - radius || y > y1 + radius || y < y0 - radius;
      } else {
        // Leaf node
        const data = node.data!;
        const dx = data.x - x;
        const dy = data.y - y;
        if (dx * dx + dy * dy <= radius * radius) {
          found.push(data);
        }
      }
      return false;
    });
    
    return found;
  }
  
  findClosestNode(x: number, y: number): NodeVisual | null {
    if (!this.quadtree) return null;
    
    return this.quadtree.find(x, y) || null;
  }
  
  destroy(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    this.quadtree = null;
    this.mutableNodes = [];
    this.mutableEdges = [];
  }
}