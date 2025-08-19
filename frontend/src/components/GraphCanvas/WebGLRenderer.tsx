import React, { useEffect, useMemo, useRef } from 'react';
import { Container, Graphics, ParticleContainer, Sprite, Text, TextStyle } from 'pixi.js';
import { PixiComponent, useApp } from '@pixi/react';
import { NodeVisual, EdgeVisual, RenderSettings } from '@types/graph';
import * as d3 from 'd3';

interface WebGLRendererProps {
  nodes: NodeVisual[];
  edges: EdgeVisual[];
  viewport: { x: number; y: number; scale: number };
  renderSettings: RenderSettings;
  selectedNodes: Set<string>;
  hoveredNode: string | null;
  highlightedPath: string[];
}

// Custom PIXI component for efficient node rendering
const NodeRenderer = PixiComponent('NodeRenderer', {
  create: ({ nodes, renderSettings }: { nodes: NodeVisual[]; renderSettings: RenderSettings }) => {
    const container = new Container();
    
    // Use ParticleContainer for better performance with large numbers of nodes
    const particleContainer = new ParticleContainer(
      renderSettings.maxNodes,
      {
        scale: true,
        position: true,
        rotation: false,
        uvs: false,
        alpha: true,
      }
    );
    
    container.addChild(particleContainer);
    
    // Create node sprites
    const nodeSprites = new Map<string, Sprite>();
    const nodeGraphics = new Graphics();
    
    // Pre-generate node textures for different states
    const createNodeTexture = (
      radius: number, 
      color: number, 
      opacity: number, 
      isSelected: boolean = false,
      isHighlighted: boolean = false
    ) => {
      const graphics = new Graphics();
      
      // Base circle
      graphics.beginFill(color, opacity);
      graphics.drawCircle(0, 0, radius);
      graphics.endFill();
      
      // Selection ring
      if (isSelected) {
        graphics.lineStyle(3, 0xEC4899, 1);
        graphics.drawCircle(0, 0, radius + 4);
      }
      
      // Highlight glow
      if (isHighlighted) {
        graphics.lineStyle(2, 0xF59E0B, 0.8);
        graphics.drawCircle(0, 0, radius + 2);
      }
      
      return graphics;
    };
    
    return { container, particleContainer, nodeSprites, nodeGraphics, createNodeTexture };
  },
  
  applyProps: (instance, oldProps, newProps) => {
    const { nodes, renderSettings, selectedNodes, hoveredNode, highlightedPath, viewport } = newProps;
    const { particleContainer, nodeSprites, nodeGraphics, createNodeTexture } = instance;
    
    // Clear previous rendering
    particleContainer.removeChildren();
    nodeGraphics.clear();
    
    // Color scale for node types
    const genreColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Size scale based on node degree or popularity
    const sizeScale = (() => {
      const values = nodes.map(node => {
        switch (renderSettings.nodeSize.basedOn) {
          case 'degree': return node.metrics?.degree ?? 1;
          case 'popularity': return node.popularity ?? 50;
          case 'centrality': return node.metrics?.centrality ?? 0.1;
          default: return 1;
        }
      });
      
      const extent = d3.extent(values) as [number, number];
      
      switch (renderSettings.nodeSize.scale) {
        case 'sqrt': return d3.scaleSqrt().domain(extent).range([renderSettings.nodeSize.min, renderSettings.nodeSize.max]);
        case 'log': return d3.scaleLog().domain([Math.max(extent[0], 0.1), extent[1]]).range([renderSettings.nodeSize.min, renderSettings.nodeSize.max]);
        default: return d3.scaleLinear().domain(extent).range([renderSettings.nodeSize.min, renderSettings.nodeSize.max]);
      }
    })();
    
    // Render each node
    nodes.forEach(node => {
      if (!node.visible) return;
      
      const isSelected = selectedNodes.has(node.id);
      const isHovered = hoveredNode === node.id;
      const isHighlighted = highlightedPath.includes(node.id);
      const shouldHighlight = isSelected || isHovered || isHighlighted;
      
      // Calculate node properties
      const baseRadius = sizeScale(
        renderSettings.nodeSize.basedOn === 'degree' ? (node.metrics?.degree ?? 1) :
        renderSettings.nodeSize.basedOn === 'popularity' ? (node.popularity ?? 50) :
        renderSettings.nodeSize.basedOn === 'centrality' ? (node.metrics?.centrality ?? 0.1) : 1
      );
      
      const radius = Math.max(renderSettings.nodeSize.min, Math.min(renderSettings.nodeSize.max, baseRadius));
      
      // Determine color
      let color = 0x4F46E5; // Default blue
      if (node.genres.length > 0) {
        const genreColor = genreColorScale(node.genres[0]);
        color = parseInt(genreColor.slice(1), 16);
      }
      if (isSelected) color = 0xEC4899; // Pink for selected
      if (isHovered) color = 0x6366F1; // Light blue for hover
      
      // LOD-based rendering
      const screenRadius = radius * viewport.scale;
      const lodLevel = screenRadius < 4 ? 3 : screenRadius < 8 ? 2 : screenRadius < 16 ? 1 : 0;
      
      if (lodLevel >= 3) {
        // Minimal rendering - just a pixel
        nodeGraphics.beginFill(color, node.opacity);
        nodeGraphics.drawRect(node.x - 0.5, node.y - 0.5, 1, 1);
        nodeGraphics.endFill();
      } else if (lodLevel >= 2) {
        // Simple circle without details
        nodeGraphics.beginFill(color, node.opacity);
        nodeGraphics.drawCircle(node.x, node.y, radius);
        nodeGraphics.endFill();
      } else {
        // Full rendering with details
        const graphics = createNodeTexture(radius, color, node.opacity, isSelected, shouldHighlight);
        graphics.x = node.x;
        graphics.y = node.y;
        
        // Add to main graphics
        nodeGraphics.addChild(graphics);
        
        // Add label for important nodes
        if (lodLevel === 0 && (isSelected || isHovered || screenRadius > 20)) {
          const labelStyle = new TextStyle({
            fontFamily: 'Inter',
            fontSize: Math.max(10, screenRadius / 4),
            fill: 0xFFFFFF,
            align: 'center',
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowDistance: 1,
            dropShadowAlpha: 0.8,
          });
          
          const label = new Text(node.title, labelStyle);
          label.anchor.set(0.5);
          label.x = node.x;
          label.y = node.y + radius + 5;
          
          nodeGraphics.addChild(label);
        }
      }
    });
    
    // Update particle container if using sprites
    instance.container.addChild(nodeGraphics);
  },
});

// Custom PIXI component for efficient edge rendering
const EdgeRenderer = PixiComponent('EdgeRenderer', {
  create: ({ edges }: { edges: EdgeVisual[] }) => {
    const graphics = new Graphics();
    return graphics;
  },
  
  applyProps: (graphics, oldProps, newProps) => {
    const { edges, renderSettings, viewport, highlightedPath } = newProps;
    
    graphics.clear();
    
    // Width scale based on edge weight
    const widthScale = d3.scaleLinear()
      .domain(d3.extent(edges, d => d.weight) as [number, number])
      .range([renderSettings.edgeWidth.min, renderSettings.edgeWidth.max]);
    
    // Render edges with LOD
    edges.forEach(edge => {
      if (!edge.visible || !edge.sourceNode || !edge.targetNode) return;
      
      const screenWidth = widthScale(edge.weight) * viewport.scale;
      
      // Skip very thin edges
      if (screenWidth < 0.5) return;
      
      const isHighlighted = highlightedPath.includes(edge.source) && 
                           highlightedPath.includes(edge.target);
      
      const color = isHighlighted ? 0xF59E0B : parseInt(edge.color.slice(1), 16);
      const alpha = isHighlighted ? 1 : edge.opacity;
      const width = isHighlighted ? Math.max(2, screenWidth) : screenWidth;
      
      // LOD-based edge rendering
      if (screenWidth < 1) {
        // Minimal edge - just a line
        graphics.lineStyle(1, color, alpha);
        graphics.moveTo(edge.sourceNode.x, edge.sourceNode.y);
        graphics.lineTo(edge.targetNode.x, edge.targetNode.y);
      } else {
        // Full edge with proper width
        graphics.lineStyle(width, color, alpha);
        
        // Add curve for better aesthetics
        const dx = edge.targetNode.x - edge.sourceNode.x;
        const dy = edge.targetNode.y - edge.sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 100) {
          // Curved edge for longer connections
          const midX = (edge.sourceNode.x + edge.targetNode.x) / 2;
          const midY = (edge.sourceNode.y + edge.targetNode.y) / 2;
          const curveOffset = Math.min(50, distance * 0.1);
          
          const perpX = -dy / distance * curveOffset;
          const perpY = dx / distance * curveOffset;
          
          graphics.moveTo(edge.sourceNode.x, edge.sourceNode.y);
          graphics.quadraticCurveTo(
            midX + perpX,
            midY + perpY,
            edge.targetNode.x,
            edge.targetNode.y
          );
        } else {
          // Straight edge for short connections
          graphics.moveTo(edge.sourceNode.x, edge.sourceNode.y);
          graphics.lineTo(edge.targetNode.x, edge.targetNode.y);
        }
      }
    });
  },
});

export const WebGLRenderer: React.FC<WebGLRendererProps> = ({
  nodes,
  edges,
  viewport,
  renderSettings,
  selectedNodes,
  hoveredNode,
  highlightedPath,
}) => {
  const app = useApp();
  
  // Memoize props to prevent unnecessary re-renders
  const memoizedNodes = useMemo(() => nodes, [nodes]);
  const memoizedEdges = useMemo(() => edges, [edges]);
  
  return (
    <Container>
      {/* Render edges first (below nodes) */}
      <EdgeRenderer
        edges={memoizedEdges}
        renderSettings={renderSettings}
        viewport={viewport}
        highlightedPath={highlightedPath}
      />
      
      {/* Render nodes on top */}
      <NodeRenderer
        nodes={memoizedNodes}
        renderSettings={renderSettings}
        selectedNodes={selectedNodes}
        hoveredNode={hoveredNode}
        highlightedPath={highlightedPath}
        viewport={viewport}
      />
    </Container>
  );
};

export default WebGLRenderer;