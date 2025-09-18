/**
 * Enhanced GPU-Optimized Graph Visualization Canvas
 * Combines D3.js force simulation with PIXI.js WebGL rendering
 * Integrated with Redux store for state management and real-time updates
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Sprite, Graphics, Container } from 'pixi.js';
import * as PIXI from 'pixi.js';
import * as d3 from 'd3';
import { useAppSelector, useAppDispatch } from '../../store';
import { GPUOptimizer } from '../../utils/gpuOptimizer';
import {
  NodeVisual,
  EdgeVisual,
  LayoutAlgorithm,
  GraphBounds,
  PerformanceMetrics
} from '../../types/graph';
import {
  updateNodePositions,
  updateNodeVisuals,
  setSelectedNodes,
  addToSelection,
  setHoveredNode,
  updateBounds,
  fetchGraph
} from '../../store/graphSlice';
import { getWebSocketService } from '../../services/websocketService';

interface GraphCanvasProps {
  width: number;
  height: number;
  enableInteraction?: boolean;
  enableRealTimeUpdates?: boolean;
  performanceMode?: 'quality' | 'performance' | 'balanced';
  onNodeClick?: (node: NodeVisual) => void;
  onEdgeClick?: (edge: EdgeVisual) => void;
  onNodeHover?: (node: NodeVisual | null) => void;
}

interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

interface GraphVisualizationMetrics {
  fps: number;
  nodeCount: number;
  edgeCount: number;
  visibleNodes: number;
  visibleEdges: number;
  drawCalls: number;
  memoryUsage: number;
  simulationAlpha: number;
  contextType: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  width = 800,
  height = 600,
  enableInteraction = true,
  enableRealTimeUpdates = true,
  performanceMode = 'balanced',
  onNodeClick,
  onEdgeClick,
  onNodeHover,
}) => {
  const dispatch = useAppDispatch();
  const {
    nodes,
    edges,
    selectedNodes,
    hoveredNode,
    layoutAlgorithm,
    layoutOptions,
    loading,
    bounds
  } = useAppSelector(state => state.graph);

  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gpuOptimizerRef = useRef<GPUOptimizer | null>(null);
  const simulationRef = useRef<d3.Simulation<NodeVisual, EdgeVisual> | null>(null);
  const nodeContainerRef = useRef<PIXI.ParticleContainer | null>(null);
  const edgeContainerRef = useRef<PIXI.Container | null>(null);
  const nodeSpritesRef = useRef<Map<string, PIXI.Sprite>>(new Map());
  const edgeGraphicsRef = useRef<Map<string, PIXI.Graphics>>(new Map());
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const wsServiceRef = useRef(getWebSocketService());

  const [viewport, setViewport] = useState<ViewportTransform>({
    x: 0,
    y: 0,
    scale: 1
  });

  const [metrics, setMetrics] = useState<GraphVisualizationMetrics>({
    fps: 0,
    nodeCount: 0,
    edgeCount: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    drawCalls: 0,
    memoryUsage: 0,
    simulationAlpha: 0,
    contextType: 'unknown'
  });

  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<NodeVisual | null>(null);
  const [lastPointerPosition, setLastPointerPosition] = useState({ x: 0, y: 0 });

  // Initialize PIXI application and D3 simulation
  useEffect(() => {
    if (!containerRef.current) return;

    const initializeGraphVisualization = async () => {
      try {
        console.log('🚀 Initializing enhanced graph visualization...');

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.cursor = 'grab';

        // Initialize GPU optimizer
        gpuOptimizerRef.current = GPUOptimizer.getInstance();
        const optimizedApp = await gpuOptimizerRef.current.initializeOptimization(canvas, {
          enableComputeShaders: true,
          preferWebGL2: true,
          powerPreference: performanceMode === 'performance' ? 'high-performance' : 'default',
          antialias: performanceMode === 'quality',
          maxTextureSize: 4096,
        });

        // Set background color (PIXI v7+ uses background property)
        if ('backgroundColor' in optimizedApp.renderer) {
          (optimizedApp.renderer as any).backgroundColor = 0x0a0a0a;
        } else {
          (optimizedApp.renderer as any).background = { color: 0x0a0a0a };
        }
        appRef.current = optimizedApp;
        containerRef.current.appendChild(canvas);

        // Create containers for edges and nodes
        const edgeContainer = new PIXI.Container();
        const nodeContainer = gpuOptimizerRef.current.createOptimizedParticleContainer(
          5000, // Support up to 5000 nodes
          {
            scale: true,
            position: true,
            rotation: false,
            uvs: false,
            alpha: true,
          }
        );

        // Add containers to stage (edges first so they appear behind nodes)
        optimizedApp.stage.addChild(edgeContainer);
        optimizedApp.stage.addChild(nodeContainer);

        edgeContainerRef.current = edgeContainer;
        nodeContainerRef.current = nodeContainer;

        // Initialize D3 force simulation
        initializeD3Simulation();

        // Set up interaction handlers
        if (enableInteraction) {
          setupInteractionHandlers(canvas);
        }

        // Create tooltip element
        createTooltip();

        // Start performance monitoring
        startPerformanceMonitoring();

        // Set up WebSocket connection for real-time updates
        if (enableRealTimeUpdates) {
          setupWebSocketConnection();
        }

        // Load initial graph data if not already loaded
        if (nodes.length === 0 && !loading) {
          dispatch(fetchGraph({ limit: 1000, depth: 3 }));
        }

        console.log('✅ Graph visualization initialized successfully');

      } catch (error) {
        console.error('Failed to initialize graph visualization:', error);
      }
    };

    // Initialize D3 force simulation
    const initializeD3Simulation = () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }

      const simulation = d3.forceSimulation<NodeVisual>()
        .force('link', d3.forceLink<NodeVisual, EdgeVisual>()
          .id(d => d.id)
          .distance(layoutOptions.forceDirected?.linkDistance || 100)
          .strength(layoutOptions.forceDirected?.linkStrength || 0.1)
        )
        .force('charge', d3.forceManyBody()
          .strength(layoutOptions.forceDirected?.chargeStrength || -300)
          .theta(layoutOptions.forceDirected?.chargeTheta || 0.8)
        )
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide()
          .radius(d => ((d as any).radius || 8) + (layoutOptions.forceDirected?.collisionRadius || 5))
        )
        .alpha(layoutOptions.forceDirected?.alpha || 1)
        .alphaDecay(layoutOptions.forceDirected?.alphaDecay || 0.0228)
        .velocityDecay(layoutOptions.forceDirected?.velocityDecay || 0.4);

      simulation.on('tick', () => {
        updateVisualization();
      });

      simulation.on('end', () => {
        console.log('🎯 D3 simulation completed');
        updateGraphBounds();
      });

      simulationRef.current = simulation;
    };

    // Create tooltip element
    const createTooltip = () => {
      const tooltip = document.createElement('div');
      tooltip.className = 'graph-tooltip';
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        pointer-events: none;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.2s;
        max-width: 200px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;

      document.body.appendChild(tooltip);
      tooltipRef.current = tooltip;
    };

    const startPerformanceMonitoring = () => {
      let frameCount = 0;
      let lastTime = performance.now();

      const updateMetrics = () => {
        frameCount++;

        if (frameCount % 60 === 0) {
          const currentTime = performance.now();
          const fps = 60 / ((currentTime - lastTime) / 1000);
          lastTime = currentTime;

          const gpuMetrics = gpuOptimizerRef.current?.getPerformanceMetrics();
          const visibleNodes = nodes.filter(n => n.visible).length;
          const visibleEdges = edges.filter(e => e.visible).length;

          setMetrics({
            fps: Math.round(fps),
            nodeCount: nodes.length,
            edgeCount: edges.length,
            visibleNodes,
            visibleEdges,
            drawCalls: gpuMetrics?.drawCalls || 0,
            memoryUsage: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) : 0,
            simulationAlpha: simulationRef.current?.alpha() || 0,
            contextType: gpuMetrics?.capabilities?.contextType || 'unknown'
          });
        }

        requestAnimationFrame(updateMetrics);
      };

      updateMetrics();
    };

    // Set up WebSocket connection for real-time updates
    const setupWebSocketConnection = () => {
      const wsService = wsServiceRef.current;

      // Set up event listeners
      wsService.on('connect', () => {
        console.log('🔌 WebSocket connected for graph updates');
        // Subscribe to graph updates for visible nodes
        if (nodes.length > 0) {
          const visibleNodeIds = nodes.filter(n => n.visible).map(n => n.id);
          wsService.subscribeToGraphUpdates(visibleNodeIds, 2);
        }
      });

      wsService.on('disconnect', () => {
        console.log('🔌 WebSocket disconnected');
      });

      wsService.on('graph_update', (message: any) => {
        console.log('📊 Real-time graph update received:', message);
        // Handle real-time graph updates here
        // This would update the Redux store with new/modified/removed nodes
        handleRealtimeGraphUpdate(message);
      });

      wsService.on('node_update', (message: any) => {
        console.log('🎵 Real-time node update received:', message);
        handleRealtimeNodeUpdate(message);
      });

      wsService.on('edge_update', (message: any) => {
        console.log('🔗 Real-time edge update received:', message);
        handleRealtimeEdgeUpdate(message);
      });

      // Connect to WebSocket server
      wsService.connect().catch(error => {
        console.warn('Failed to connect to WebSocket server:', error);
      });
    };

    // Handle real-time graph updates
    const handleRealtimeGraphUpdate = (message: any) => {
      // Update nodes and edges based on real-time data
      // This would typically dispatch actions to update the Redux store
      if (message.data) {
        const { added, modified, removed } = message.data;

        // Handle added nodes
        if (added && added.length > 0) {
          console.log('➕ Adding', added.length, 'new nodes');
          // Would dispatch action to add nodes to store
        }

        // Handle modified nodes
        if (modified && modified.length > 0) {
          console.log('🔄 Updating', modified.length, 'modified nodes');
          // Would dispatch action to update nodes in store
        }

        // Handle removed nodes
        if (removed && removed.length > 0) {
          console.log('➖ Removing', removed.length, 'nodes');
          // Would dispatch action to remove nodes from store
        }
      }
    };

    // Handle real-time node updates
    const handleRealtimeNodeUpdate = (message: any) => {
      if (message.data && message.data.nodeId) {
        const nodeId = message.data.nodeId;
        const updates = message.data.updates;

        // Update specific node
        dispatch(updateNodeVisuals([{ id: nodeId, updates }]));
      }
    };

    // Handle real-time edge updates
    const handleRealtimeEdgeUpdate = (message: any) => {
      if (message.data) {
        // Handle edge updates
        console.log('🔗 Processing edge update:', message.data);
        // Would update edges in the visualization
      }
    };

    initializeGraphVisualization();

    return () => {
      // Cleanup WebSocket connection
      if (enableRealTimeUpdates && wsServiceRef.current) {
        wsServiceRef.current.disconnect();
      }

      // Cleanup D3 simulation
      if (simulationRef.current) {
        simulationRef.current.stop();
      }

      // Cleanup tooltip
      if (tooltipRef.current) {
        document.body.removeChild(tooltipRef.current);
      }

      // Cleanup GPU resources
      if (gpuOptimizerRef.current) {
        gpuOptimizerRef.current.destroy();
      }

      // Cleanup PIXI application
      if (appRef.current) {
        appRef.current.destroy(true);
      }

      // Clear sprite references
      nodeSpritesRef.current.clear();
      edgeGraphicsRef.current.clear();
    };
  }, [width, height, performanceMode]);

  // Setup interaction handlers
  const setupInteractionHandlers = (canvas: HTMLCanvasElement) => {
    const getPointerPosition = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / viewport.scale - viewport.x,
        y: (event.clientY - rect.top) / viewport.scale - viewport.y
      };
    };

    const findNodeAtPosition = (x: number, y: number): NodeVisual | null => {
      for (const node of nodes) {
        if (!node.visible) continue;
        const dx = node.x - x;
        const dy = node.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= node.radius) {
          return node;
        }
      }
      return null;
    };

    // Pointer down - start drag or selection
    canvas.addEventListener('pointerdown', (event) => {
      const pos = getPointerPosition(event);
      const node = findNodeAtPosition(pos.x, pos.y);

      if (node) {
        setDraggedNode(node);
        setIsDragging(true);
        canvas.style.cursor = 'grabbing';

        // Fix node position during drag
        if (simulationRef.current) {
          node.fx = node.x;
          node.fy = node.y;
          simulationRef.current.alphaTarget(0.3).restart();
        }

        // Handle selection
        if (event.ctrlKey || event.metaKey) {
          dispatch(addToSelection(node.id));
        } else {
          dispatch(setSelectedNodes([node.id]));
        }

        onNodeClick?.(node);
      } else {
        // Clear selection if clicking empty space
        if (!(event.ctrlKey || event.metaKey)) {
          dispatch(setSelectedNodes([]));
        }
        setIsDragging(true);
      }

      setLastPointerPosition(pos);
    });

    // Pointer move - drag node or pan viewport
    canvas.addEventListener('pointermove', (event) => {
      const pos = getPointerPosition(event);

      if (isDragging) {
        if (draggedNode) {
          // Drag node
          draggedNode.fx = pos.x;
          draggedNode.fy = pos.y;
        } else {
          // Pan viewport
          const dx = pos.x - lastPointerPosition.x;
          const dy = pos.y - lastPointerPosition.y;

          setViewport(prev => ({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
          }));

          updateViewportTransform();
        }
      } else {
        // Handle hover
        const node = findNodeAtPosition(pos.x, pos.y);

        if (node !== (hoveredNode ? nodes.find(n => n.id === hoveredNode) : null)) {
          dispatch(setHoveredNode(node?.id || null));
          onNodeHover?.(node);

          // Update tooltip
          updateTooltip(event, node);
        }

        canvas.style.cursor = node ? 'pointer' : 'grab';
      }

      setLastPointerPosition(pos);
    });

    // Pointer up - end drag
    canvas.addEventListener('pointerup', () => {
      if (draggedNode && simulationRef.current) {
        // Release node
        draggedNode.fx = null;
        draggedNode.fy = null;
        simulationRef.current.alphaTarget(0);
      }

      setIsDragging(false);
      setDraggedNode(null);
      canvas.style.cursor = 'grab';
    });

    // Wheel - zoom
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();

      const zoomFactor = 1 + (event.deltaY > 0 ? -0.1 : 0.1);
      const newScale = Math.max(0.1, Math.min(10, viewport.scale * zoomFactor));

      // Zoom towards mouse position
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      setViewport(prev => ({
        x: mouseX - (mouseX - prev.x) * (newScale / prev.scale),
        y: mouseY - (mouseY - prev.y) * (newScale / prev.scale),
        scale: newScale
      }));

      updateViewportTransform();
    });
  };

  // Update tooltip
  const updateTooltip = (event: PointerEvent, node: NodeVisual | null) => {
    if (!tooltipRef.current) return;

    if (node) {
      const title = node.title || 'Unknown Track';
      const artist = node.artist || 'Unknown Artist';
      const degree = node.metrics?.degree || 0;

      tooltipRef.current.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
        <div style="margin-bottom: 2px;">by ${artist}</div>
        <div style="font-size: 11px; opacity: 0.8;">Connections: ${degree}</div>
      `;

      tooltipRef.current.style.left = `${event.clientX + 10}px`;
      tooltipRef.current.style.top = `${event.clientY - 10}px`;
      tooltipRef.current.style.opacity = '1';
    } else {
      tooltipRef.current.style.opacity = '0';
    }
  };

  // Update viewport transform
  const updateViewportTransform = useCallback(() => {
    if (appRef.current) {
      appRef.current.stage.position.set(viewport.x, viewport.y);
      appRef.current.stage.scale.set(viewport.scale);
    }
  }, [viewport]);

  // Update D3 simulation with new data
  useEffect(() => {
    if (!simulationRef.current || nodes.length === 0) return;

    console.log('🔄 Updating D3 simulation with', nodes.length, 'nodes and', edges.length, 'edges');

    // Update simulation nodes and links
    simulationRef.current.nodes(nodes);

    const linkForce = simulationRef.current.force('link') as d3.ForceLink<NodeVisual, EdgeVisual>;
    if (linkForce) {
      linkForce.links(edges);
    }

    // Restart simulation
    simulationRef.current.alpha(1).restart();

    // Update visualization containers
    updateVisualization();
  }, [nodes, edges]);

  // Update visualization with performance optimizations
  const updateVisualization = useCallback(() => {
    if (!nodeContainerRef.current || !edgeContainerRef.current) return;

    const nodeContainer = nodeContainerRef.current;
    const edgeContainer = edgeContainerRef.current;

    // Performance optimization: LOD (Level of Detail) system
    const zoomLevel = viewport.scale;
    const maxNodesForCurrentZoom = getMaxNodesForZoom(zoomLevel);
    const maxEdgesForCurrentZoom = getMaxEdgesForZoom(zoomLevel);

    // Filter nodes and edges based on viewport culling and LOD
    const visibleNodes = cullAndFilterNodes(nodes, maxNodesForCurrentZoom);
    const visibleEdges = cullAndFilterEdges(edges, visibleNodes, maxEdgesForCurrentZoom);

    // Efficient rendering: only update changed sprites
    updateEdgeRendering(edgeContainer, visibleEdges);
    updateNodeRendering(nodeContainer, visibleNodes);

    // Batch position updates to Redux store
    if (visibleNodes.length > 0) {
      const positionUpdates = visibleNodes.map(node => ({
        id: node.id,
        x: node.x,
        y: node.y
      }));

      // Throttle Redux updates for performance
      if (positionUpdates.length < 1000 || Math.random() < 0.1) {
        dispatch(updateNodePositions(positionUpdates));
      }
    }
  }, [nodes, edges, viewport, dispatch]);

  // Performance optimization: viewport culling
  const cullAndFilterNodes = (allNodes: NodeVisual[], maxNodes: number): NodeVisual[] => {
    // Calculate viewport bounds with padding
    const padding = 100;
    const viewportBounds = {
      left: -viewport.x / viewport.scale - padding,
      right: (-viewport.x + width) / viewport.scale + padding,
      top: -viewport.y / viewport.scale - padding,
      bottom: (-viewport.y + height) / viewport.scale + padding
    };

    // Filter nodes within viewport
    const culledNodes = allNodes.filter(node => {
      if (!node.visible) return false;

      return node.x >= viewportBounds.left &&
             node.x <= viewportBounds.right &&
             node.y >= viewportBounds.top &&
             node.y <= viewportBounds.bottom;
    });

    // Apply LOD: prioritize important nodes if we have too many
    if (culledNodes.length > maxNodes) {
      // Sort by importance (degree, centrality, selection state)
      return culledNodes
        .sort((a, b) => {
          // Selected nodes have highest priority
          if (a.selected && !b.selected) return -1;
          if (!a.selected && b.selected) return 1;

          // Hovered nodes have second priority
          if (a.highlighted && !b.highlighted) return -1;
          if (!a.highlighted && b.highlighted) return 1;

          // Then by degree/centrality
          const aDegree = a.metrics?.degree || 0;
          const bDegree = b.metrics?.degree || 0;
          return bDegree - aDegree;
        })
        .slice(0, maxNodes);
    }

    return culledNodes;
  };

  // Performance optimization: edge culling
  const cullAndFilterEdges = (allEdges: EdgeVisual[], visibleNodes: NodeVisual[], maxEdges: number): EdgeVisual[] => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

    const culledEdges = allEdges.filter(edge => {
      if (!edge.visible) return false;

      return visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
    });

    // Apply edge LOD: prioritize stronger connections
    if (culledEdges.length > maxEdges) {
      return culledEdges
        .sort((a, b) => b.weight - a.weight)
        .slice(0, maxEdges);
    }

    return culledEdges;
  };

  // Get max nodes based on zoom level for LOD
  const getMaxNodesForZoom = (zoom: number): number => {
    if (zoom > 2) return 5000; // Very zoomed in - show all details
    if (zoom > 1) return 2000; // Moderately zoomed in
    if (zoom > 0.5) return 1000; // Normal zoom
    if (zoom > 0.25) return 500; // Zoomed out
    return 200; // Very zoomed out - show only major nodes
  };

  // Get max edges based on zoom level for LOD
  const getMaxEdgesForZoom = (zoom: number): number => {
    if (zoom > 2) return 10000; // Very zoomed in
    if (zoom > 1) return 5000; // Moderately zoomed in
    if (zoom > 0.5) return 2000; // Normal zoom
    if (zoom > 0.25) return 1000; // Zoomed out
    return 300; // Very zoomed out
  };

  // Efficient edge rendering with object pooling
  const updateEdgeRendering = (container: PIXI.Container, visibleEdges: EdgeVisual[]) => {
    // Clear previous edges
    container.removeChildren();
    edgeGraphicsRef.current.clear();

    // Batch edge rendering for performance
    const graphics = new PIXI.Graphics();

    visibleEdges.forEach(edge => {
      if (!edge.sourceNode || !edge.targetNode) return;

      // Use simple line rendering for performance
      graphics.lineStyle(
        Math.max(0.5, edge.width * viewport.scale), // Scale line width with zoom
        parseInt(edge.color.replace('#', '0x')),
        edge.opacity
      );
      graphics.moveTo(edge.sourceNode.x, edge.sourceNode.y);
      graphics.lineTo(edge.targetNode.x, edge.targetNode.y);
    });

    container.addChild(graphics);
    edgeGraphicsRef.current.set('batch', graphics);
  };

  // Efficient node rendering with sprite pooling
  const updateNodeRendering = (container: PIXI.ParticleContainer, visibleNodes: NodeVisual[]) => {
    // Clear previous nodes
    container.removeChildren();
    nodeSpritesRef.current.clear();

    visibleNodes.forEach(node => {
      const texture = gpuOptimizerRef.current?.getOptimizedTexture('circle', node.radius * 2);
      if (texture) {
        const sprite = new PIXI.Sprite(texture);
        sprite.x = node.x;
        sprite.y = node.y;
        sprite.anchor.set(0.5);

        // Adaptive node size based on zoom and importance
        const baseSize = node.radius / 32;
        const zoomSize = Math.max(0.3, Math.min(2.0, baseSize * Math.sqrt(viewport.scale)));
        sprite.scale.set(zoomSize);

        sprite.tint = parseInt(node.color.replace('#', '0x'));
        sprite.alpha = node.opacity;

        // Highlight selected/hovered nodes
        if (node.selected) {
          sprite.tint = 0x00ff00; // Green for selected
          sprite.scale.set(sprite.scale.x * 1.3);
        } else if (node.highlighted) {
          sprite.tint = 0xffaa00; // Orange for hovered
          sprite.scale.set(sprite.scale.x * 1.2);
        }

        container.addChild(sprite);
        nodeSpritesRef.current.set(node.id, sprite);
      }
    });
  };

  // Update graph bounds
  const updateGraphBounds = useCallback(() => {
    if (nodes.length === 0) return;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);

    const bounds: GraphBounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };

    dispatch(updateBounds(bounds));
  }, [nodes, dispatch]);

  // Update viewport transform when viewport changes
  useEffect(() => {
    updateViewportTransform();
  }, [updateViewportTransform]);

  // Fit graph to viewport
  const fitToViewport = useCallback(() => {
    if (!bounds) return;

    const padding = 50;
    const scaleX = (width - padding * 2) / bounds.width;
    const scaleY = (height - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 2); // Max scale of 2

    const centerX = width / 2 - (bounds.minX + bounds.width / 2) * scale;
    const centerY = height / 2 - (bounds.minY + bounds.height / 2) * scale;

    setViewport({ x: centerX, y: centerY, scale });
  }, [bounds, width, height]);

  // Responsive canvas sizing
  useEffect(() => {
    const handleResize = () => {
      if (appRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        appRef.current.renderer.resize(rect.width, rect.height);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Performance mode adjustments
  useEffect(() => {
    if (appRef.current) {
      const renderer = appRef.current.renderer;

      switch (performanceMode) {
        case 'performance':
          renderer.plugins.interaction.interactionFrequency = 30; // Lower interaction frequency
          break;
        case 'quality':
          renderer.plugins.interaction.interactionFrequency = 60; // Higher interaction frequency
          break;
        case 'balanced':
        default:
          renderer.plugins.interaction.interactionFrequency = 45; // Balanced
          break;
      }
    }
  }, [performanceMode]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="border border-gray-700 rounded bg-gray-900 w-full h-full"
        style={{ minWidth: width, minHeight: height }}
      />

      {/* Performance Metrics - Responsive positioning */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-black/80 text-white p-2 sm:p-3 rounded text-xs font-mono space-y-1 max-w-[160px] sm:max-w-none">
        <div className="text-green-400 font-bold mb-1 sm:mb-2">Graph Visualization</div>
        <div>FPS: {metrics.fps || 0}</div>
        <div className="hidden sm:block">Nodes: {metrics.visibleNodes || 0}/{metrics.nodeCount || 0}</div>
        <div className="sm:hidden">N: {metrics.visibleNodes || 0}/{metrics.nodeCount || 0}</div>
        <div className="hidden sm:block">Edges: {metrics.visibleEdges || 0}/{metrics.edgeCount || 0}</div>
        <div className="sm:hidden">E: {metrics.visibleEdges || 0}/{metrics.edgeCount || 0}</div>
        <div className="hidden md:block">WebGL: {metrics.contextType || 'unknown'}</div>
        <div className="hidden md:block">Memory: {metrics.memoryUsage || 0}MB</div>
        <div className="hidden sm:block">Simulation: {((metrics.simulationAlpha || 0) * 100).toFixed(1)}%</div>
        {performanceMetrics && (
          <div className="text-xs">
            Status: <span className={getPerformanceStatus() === 'excellent' ? 'text-green-400' : getPerformanceStatus() === 'good' ? 'text-yellow-400' : 'text-red-400'}>
              {getPerformanceStatus()}
            </span>
          </div>
        )}
      </div>

      {/* Controls - Responsive layout */}
      <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-black/80 text-white p-2 rounded space-y-2">
        <div className="flex flex-col space-y-1 sm:space-y-2">
          <button
            onClick={fitToViewport}
            className="px-2 py-1 sm:px-3 sm:py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            disabled={!bounds}
            title="Fit graph to viewport"
          >
            <span className="hidden sm:inline">Fit to View</span>
            <span className="sm:hidden">Fit</span>
          </button>
          <button
            onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
            className="px-2 py-1 sm:px-3 sm:py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
            title="Reset zoom and pan"
          >
            <span className="hidden sm:inline">Reset</span>
            <span className="sm:hidden">↺</span>
          </button>
        </div>
        <div className="text-xs opacity-75">
          <span className="hidden sm:inline">Zoom: </span>{((viewport.scale || 1) * 100).toFixed(0)}%
        </div>
        {(selectedNodes?.length || 0) > 0 && (
          <div className="text-xs text-yellow-400">
            <span className="hidden sm:inline">Selected: </span>{selectedNodes?.length || 0}
          </div>
        )}
      </div>

      {/* Performance Mode Indicator - Mobile friendly */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 sm:top-4">
        <div className="bg-black/60 text-white px-2 py-1 rounded text-xs flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${
            performanceMode === 'performance' ? 'bg-red-500' :
            performanceMode === 'quality' ? 'bg-blue-500' : 'bg-green-500'
          }`}></div>
          <span className="hidden sm:inline">{performanceMode} mode</span>
          <span className="sm:hidden capitalize">{performanceMode[0]}</span>
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-3 sm:p-4 flex items-center space-x-2 sm:space-x-3 mx-4">
            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm sm:text-base">Loading graph data...</span>
          </div>
        </div>
      )}

      {/* WebSocket Connection Status */}
      {enableRealTimeUpdates && (
        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4">
          <div className={`flex items-center space-x-1 sm:space-x-2 px-2 py-1 rounded text-xs ${
            wsServiceRef.current.isConnectedToServer()
              ? 'bg-green-900/80 text-green-300'
              : 'bg-red-900/80 text-red-300'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              wsServiceRef.current.isConnectedToServer() ? 'bg-green-500' : 'bg-red-500'
            } animate-pulse`}></div>
            <span className="hidden sm:inline">
              {wsServiceRef.current.isConnectedToServer() ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      )}

      {/* Status indicator - Bottom left */}
      <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          metrics.fps > 30 ? 'bg-green-500' : metrics.fps > 15 ? 'bg-yellow-500' : 'bg-red-500'
        } animate-pulse`}></div>
        <span className="text-xs sm:text-sm text-gray-300">
          <span className="hidden sm:inline">
            {enableRealTimeUpdates ? 'Real-time' : 'Static'} |
          </span>
          {metrics.fps} FPS
        </span>
      </div>

      {/* Mobile-specific touch instructions */}
      {typeof window !== 'undefined' && 'ontouchstart' in window && (
        <div className="absolute bottom-12 left-2 right-2 sm:hidden">
          <div className="bg-black/60 text-white text-xs p-2 rounded text-center">
            Pinch to zoom • Drag to pan • Tap node to select
          </div>
        </div>
      )}
    </div>
  );
};

// Export both the new component and keep the old name for backward compatibility
export default GraphCanvas;
export { GraphCanvas as SimpleGPUCanvas };