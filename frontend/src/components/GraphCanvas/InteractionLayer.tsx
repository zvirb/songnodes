import React, { useCallback, useRef, useMemo } from 'react';
import { Container, Graphics, FederatedPointerEvent } from 'pixi.js';
import { PixiComponent } from '@pixi/react';
import { NodeVisual, EdgeVisual } from '../../types/graph';
import { InteractionMode } from '../../types/ui';
import * as d3 from 'd3';

interface InteractionLayerProps {
  width: number;
  height: number;
  nodes: NodeVisual[];
  edges: EdgeVisual[];
  viewport: { x: number; y: number; scale: number };
  interactionMode: InteractionMode;
  isDragging: boolean;
  isMultiSelecting: boolean;
  onNodeClick: (node: NodeVisual, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (node: NodeVisual) => void;
  onNodeHover: (node: NodeVisual | null) => void;
  onEdgeClick?: (edge: EdgeVisual) => void;
  onBackgroundClick?: (event: React.MouseEvent) => void;
  onViewportChange: (viewport: { x: number; y: number; scale: number }) => void;
}

// Custom interaction handler component
const InteractionHandler = PixiComponent<InteractionLayerProps, Container>('InteractionHandler', {
  create: (props: InteractionLayerProps) => {
    const container = new Container();
    
    // Create invisible hit area for background interactions
    const background = new Graphics();
    background.beginFill(0x000000, 0.001); // Almost transparent but interactive
    background.drawRect(0, 0, props.width, props.height);
    background.endFill();
    background.eventMode = 'static';
    background.interactiveChildren = false;
    
    container.addChild(background);
    
    // State for interaction handling
    let isDragging = false;
    let dragStart: { x: number; y: number } | null = null;
    let draggedNode: NodeVisual | null = null;
    let lastHoveredNode: NodeVisual | null = null;
    let panStart: { x: number; y: number; viewX: number; viewY: number } | null = null;
    let selectionBox: { start: { x: number; y: number }; end: { x: number; y: number } } | null = null;
    
    // Zoom behavior using D3
    const zoom = d3.zoom<HTMLElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        const { transform } = event;
        props.onViewportChange({
          x: transform.x,
          y: transform.y,
          scale: transform.k,
        });
      });
    
    // Helper function to find node at position
    const findNodeAtPosition = (x: number, y: number): NodeVisual | null => {
      for (const node of props.nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= node.radius) {
          return node;
        }
      }
      return null;
    };
    
    // Helper function to find edge at position
    const findEdgeAtPosition = (x: number, y: number): EdgeVisual | null => {
      for (const edge of props.edges) {
        const { sourceNode, targetNode } = edge;
        if (!sourceNode || !targetNode) continue;
        
        // Calculate distance from point to line segment
        const A = x - sourceNode.x;
        const B = y - sourceNode.y;
        const C = targetNode.x - sourceNode.x;
        const D = targetNode.y - sourceNode.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) continue;
        
        const param = dot / lenSq;
        
        let xx: number, yy: number;
        if (param < 0) {
          xx = sourceNode.x;
          yy = sourceNode.y;
        } else if (param > 1) {
          xx = targetNode.x;
          yy = targetNode.y;
        } else {
          xx = sourceNode.x + param * C;
          yy = sourceNode.y + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Consider edge width for hit detection
        const hitRadius = Math.max(5, edge.width);
        if (distance <= hitRadius) {
          return edge;
        }
      }
      return null;
    };
    
    // Convert screen coordinates to world coordinates
    const screenToWorld = (screenX: number, screenY: number) => ({
      x: (screenX - props.viewport.x) / props.viewport.scale,
      y: (screenY - props.viewport.y) / props.viewport.scale,
    });
    
    // Mouse/touch event handlers
    const handlePointerDown = (event: FederatedPointerEvent) => {
      const worldPos = screenToWorld(event.data.global.x, event.data.global.y);
      const clickedNode = findNodeAtPosition(worldPos.x, worldPos.y);
      
      isDragging = true;
      dragStart = { x: event.data.global.x, y: event.data.global.y };
      
      if (clickedNode && props.interactionMode === InteractionMode.SELECT) {
        // Start node dragging
        draggedNode = clickedNode;
        // Fix node position during drag
        clickedNode.fx = clickedNode.x;
        clickedNode.fy = clickedNode.y;
      } else if (props.interactionMode === InteractionMode.PAN) {
        // Start panning
        panStart = {
          x: event.data.global.x,
          y: event.data.global.y,
          viewX: props.viewport.x,
          viewY: props.viewport.y,
        };
      } else if (props.interactionMode === InteractionMode.SELECT && (event.nativeEvent as PointerEvent).shiftKey) {
        // Start selection box
        selectionBox = {
          start: worldPos,
          end: worldPos,
        };
      }
      
      event.stopPropagation();
    };
    
    const handlePointerMove = (event: FederatedPointerEvent) => {
      const worldPos = screenToWorld(event.data.global.x, event.data.global.y);
      
      if (isDragging && dragStart) {
        const dx = event.global.x - dragStart.x;
        const dy = event.global.y - dragStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 5) { // Minimum drag distance to start dragging
          if (draggedNode) {
            // Update node position
            draggedNode.fx = worldPos.x;
            draggedNode.fy = worldPos.y;
          } else if (panStart) {
            // Update viewport
            const newViewport = {
              x: panStart.viewX + (event.data.global.x - panStart.x),
              y: panStart.viewY + (event.data.global.y - panStart.y),
              scale: props.viewport.scale,
            };
            props.onViewportChange(newViewport);
          } else if (selectionBox) {
            // Update selection box
            selectionBox.end = worldPos;
          }
        }
      } else {
        // Handle hover without dragging
        const hoveredNode = findNodeAtPosition(worldPos.x, worldPos.y);
        if (hoveredNode !== lastHoveredNode) {
          lastHoveredNode = hoveredNode;
          props.onNodeHover(hoveredNode);
        }
      }
    };
    
    const handlePointerUp = (event: FederatedPointerEvent) => {
      const worldPos = screenToWorld(event.data.global.x, event.data.global.y);
      
      if (isDragging && dragStart) {
        const dx = event.global.x - dragStart.x;
        const dy = event.global.y - dragStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
          // This was a click, not a drag
          const clickedNode = findNodeAtPosition(worldPos.x, worldPos.y);
          const clickedEdge = findEdgeAtPosition(worldPos.x, worldPos.y);
          
          if (clickedNode) {
            // Simulate React mouse event for compatibility
            const syntheticEvent = {
              ctrlKey: (event.nativeEvent as PointerEvent).ctrlKey,
              metaKey: (event.nativeEvent as PointerEvent).metaKey,
              shiftKey: (event.nativeEvent as PointerEvent).shiftKey,
              stopPropagation: () => {},
              preventDefault: () => {},
            } as React.MouseEvent;
            
            props.onNodeClick(clickedNode, syntheticEvent);
          } else if (clickedEdge && props.onEdgeClick) {
            props.onEdgeClick(clickedEdge);
          } else if (props.onBackgroundClick) {
            const syntheticEvent = {
              stopPropagation: () => {},
              preventDefault: () => {},
            } as React.MouseEvent;
            
            props.onBackgroundClick(syntheticEvent);
          }
        } else {
          // This was a drag
          if (selectionBox) {
            // Handle multi-selection
            const { start, end } = selectionBox;
            const minX = Math.min(start.x, end.x);
            const maxX = Math.max(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxY = Math.max(start.y, end.y);
            
            const selectedNodes = props.nodes.filter(node => 
              node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
            );
            
            // This would need to be handled differently since we don't have direct access to dispatch here
            // For now, we'll just emit the first selected node
            if (selectedNodes.length > 0) {
              const syntheticEvent = {
                ctrlKey: true, // Simulate ctrl+click for multi-select
                metaKey: false,
                shiftKey: true,
                stopPropagation: () => {},
                preventDefault: () => {},
              } as React.MouseEvent;
              
              selectedNodes.forEach((node, index) => {
                if (index === 0) props.onNodeClick(node, syntheticEvent);
              });
            }
          }
        }
      }
      
      // Clean up drag state
      if (draggedNode) {
        draggedNode.fx = null;
        draggedNode.fy = null;
        draggedNode = null;
      }
      
      isDragging = false;
      dragStart = null;
      panStart = null;
      selectionBox = null;
    };
    
    // Wheel event for zooming
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(10, props.viewport.scale * scaleFactor));
      
      // Zoom towards cursor position
      const worldPoint = screenToWorld(x, y);
      const newViewport = {
        x: x - worldPoint.x * newScale,
        y: y - worldPoint.y * newScale,
        scale: newScale,
      };
      
      props.onViewportChange(newViewport);
    };
    
    // Set up event listeners
    background.on('pointerdown', handlePointerDown);
    background.on('pointermove', handlePointerMove);
    background.on('pointerup', handlePointerUp);
    background.on('pointerupoutside', handlePointerUp);
    
    // Add wheel listener to the container's DOM element
    // This would need to be handled at a higher level
    
    // Store additional data as properties on the container
    (container as any).background = background;
    (container as any).handleWheel = handleWheel;
    (container as any).cleanup = () => {
      background.off('pointerdown', handlePointerDown);
      background.off('pointermove', handlePointerMove);
      background.off('pointerup', handlePointerUp);
      background.off('pointerupoutside', handlePointerUp);
    };
    
    return container;
  },
  
  applyProps: (container, oldProps, newProps) => {
    const background = (container as any).background;
    
    // Update background size
    background.clear();
    background.beginFill(0x000000, 0.001);
    background.drawRect(0, 0, newProps.width, newProps.height);
    background.endFill();
    
    // Update cursor based on interaction mode
    switch (newProps.interactionMode) {
      case InteractionMode.PAN:
        background.cursor = newProps.isDragging ? 'grabbing' : 'grab';
        break;
      case InteractionMode.SELECT:
        background.cursor = 'default';
        break;
      case InteractionMode.ZOOM:
        background.cursor = 'zoom-in';
        break;
      default:
        background.cursor = 'default';
    }
  },
  
  willUnmount: (container) => {
    const cleanup = (container as any).cleanup;
    if (cleanup) {
      cleanup();
    }
  },
});

export const InteractionLayer: React.FC<InteractionLayerProps> = (props) => {
  return <InteractionHandler {...props} />;
};

export default InteractionLayer;