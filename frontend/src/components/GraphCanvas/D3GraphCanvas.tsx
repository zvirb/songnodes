import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { updateNodePositions, setSelectedNodes, setHoveredNode } from '../../store/graphSlice';
import { NodeVisual, EdgeVisual } from '../../types/graph';

interface D3GraphCanvasProps {
  width: number;
  height: number;
  className?: string;
  nodeSize?: number;
  edgeLabelSize?: number;
  distancePower?: number;
  relationshipPower?: number;
}

interface D3Node extends NodeVisual {
  index?: number;
}

interface D3Edge extends Omit<EdgeVisual, 'source' | 'target'> {
  source: D3Node;
  target: D3Node;
}

/**
 * High-performance D3.js force-directed graph visualization component
 * Renders nodes and edges with interactive features and proper color coding
 */
export const D3GraphCanvas: React.FC<D3GraphCanvasProps> = ({
  width,
  height,
  className,
  nodeSize = 12,
  edgeLabelSize = 12,
  distancePower = 0,
  relationshipPower = 0
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);
  const dispatch = useAppDispatch();

  // Get Redux data
  const { nodes, edges, selectedNodes, hoveredNode } = useAppSelector(state => state.graph);

  // Color mapping for different node types
  const getNodeColor = useCallback((node: NodeVisual) => {
    if (node.selected) return '#F59E0B'; // Amber for selected
    if (node.highlighted) return '#EF4444'; // Red for hovered

    // Color by type
    switch (node.type) {
      case 'artist': return '#3B82F6'; // Blue for artists
      case 'venue': return '#10B981'; // Green for venues
      case 'location': return '#F59E0B'; // Yellow for locations
      case 'track': return '#8B5CF6'; // Purple for tracks
      case 'album': return '#EC4899'; // Pink for albums
      default: return '#6B7280'; // Gray for unknown
    }
  }, []);

  // Get node radius based on importance/degree and nodeSize prop
  const getNodeRadius = useCallback((node: NodeVisual) => {
    if (node.radius) return node.radius * (nodeSize / 12);

    // Calculate radius based on degree or use default, scaled by nodeSize
    const baseRadius = (nodeSize / 2);
    const maxRadius = nodeSize;
    const degree = node.metrics?.degree || 1;

    return Math.min(maxRadius, baseRadius + (degree * 0.5));
  }, [nodeSize]);

  // Memoize processed data to prevent unnecessary re-renders
  const processedData = useMemo(() => {
    if (!nodes.length) return { processedNodes: [], processedEdges: [] };

    // Create node map for quick lookups
    const nodeMap = new Map<string, D3Node>();
    const processedNodes: D3Node[] = nodes.map(node => {
      const d3Node: D3Node = {
        ...node,
        x: node.x || Math.random() * width,
        y: node.y || Math.random() * height,
      };
      nodeMap.set(node.id, d3Node);
      return d3Node;
    });

    // Create edges with proper source/target references
    const processedEdges: D3Edge[] = edges
      .map(edge => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        if (!sourceNode || !targetNode) {
          console.warn('Edge references non-existent node:', edge);
          return null;
        }

        return {
          ...edge,
          source: sourceNode,
          target: targetNode,
          sourceNode: sourceNode,
          targetNode: targetNode,
          visible: true,
          opacity: 0.6,
          width: Math.max(1, (edge.weight || 1) * 2),
          color: '#64748B',
        } as D3Edge;
      })
      .filter(Boolean) as D3Edge[];

    return { processedNodes, processedEdges };
  }, [nodes, edges, width, height]);

  // Handle node interactions
  const handleNodeClick = useCallback((event: MouseEvent, node: D3Node) => {
    event.stopPropagation();
    const isSelected = selectedNodes.includes(node.id);

    if (event.ctrlKey || event.metaKey) {
      // Multi-select with Ctrl/Cmd
      if (isSelected) {
        dispatch(setSelectedNodes(selectedNodes.filter(id => id !== node.id)));
      } else {
        dispatch(setSelectedNodes([...selectedNodes, node.id]));
      }
    } else {
      // Single select
      dispatch(setSelectedNodes(isSelected ? [] : [node.id]));
    }

    // Call the parent's onNodeClick handler if provided
    if (onNodeClick) {
      onNodeClick(node);
    }
  }, [dispatch, selectedNodes, onNodeClick]);

  const handleNodeMouseEnter = useCallback((event: MouseEvent, node: D3Node) => {
    dispatch(setHoveredNode(node.id));
  }, [dispatch]);

  const handleNodeMouseLeave = useCallback(() => {
    dispatch(setHoveredNode(null));
  }, [dispatch]);

  // Initialize and update D3 visualization
  useEffect(() => {
    if (!svgRef.current || !processedData.processedNodes.length) return;

    const svg = d3.select(svgRef.current);
    const { processedNodes, processedEdges } = processedData;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create container groups
    const container = svg.append('g').attr('class', 'graph-container');
    const edgeGroup = container.append('g').attr('class', 'edges');
    const nodeGroup = container.append('g').attr('class', 'nodes');

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Initialize force simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    simulationRef.current = d3.forceSimulation(processedNodes)
      .force('link', d3.forceLink<D3Node, D3Edge>(processedEdges)
        .id((d) => d.id)
        .distance(80 * Math.pow(10, distancePower / 5))
        .strength(0.1 * Math.pow(10, relationshipPower / 5))
      )
      .force('charge', d3.forceManyBody()
        .strength(-300 * Math.pow(10, distancePower / 5))
        .distanceMax(400 * Math.pow(10, distancePower / 5))
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide()
        .radius((d) => getNodeRadius(d) + 2)
        .strength(0.8)
      );

    // Create edges
    const edgeElements = edgeGroup
      .selectAll<SVGLineElement, D3Edge>('line')
      .data(processedEdges)
      .enter()
      .append('line')
      .attr('stroke', '#64748B')
      .attr('stroke-width', (d) => Math.max(1, (d.weight || 1) * 2))
      .attr('stroke-opacity', 0.6)
      .attr('class', 'graph-edge');

    // Create edge labels (if enabled)
    const edgeLabelElements = edgeLabelSize > 0 ? edgeGroup
      .selectAll<SVGTextElement, D3Edge>('text.edge-label')
      .data(processedEdges)
      .enter()
      .append('text')
      .attr('class', 'edge-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', `${edgeLabelSize}px`)
      .attr('fill', '#94a3b8')
      .attr('stroke', '#0F172A')
      .attr('stroke-width', 0.3)
      .attr('pointer-events', 'none')
      .text((d) => {
        // Show weight or relationship type
        if (d.label) return d.label;
        if (d.weight && d.weight > 1) return d.weight.toFixed(1);
        return '';
      }) : null;

    // Create nodes
    const nodeElements = nodeGroup
      .selectAll<SVGCircleElement, D3Node>('circle')
      .data(processedNodes)
      .enter()
      .append('circle')
      .attr('r', getNodeRadius)
      .attr('fill', getNodeColor)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .on('click', handleNodeClick)
      .on('mouseenter', handleNodeMouseEnter)
      .on('mouseleave', handleNodeMouseLeave);

    // Add labels for nodes
    const labelElements = nodeGroup
      .selectAll<SVGTextElement, D3Node>('text')
      .data(processedNodes)
      .enter()
      .append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', `${Math.max(8, edgeLabelSize * 0.8)}px`)
      .attr('font-weight', 'bold')
      .attr('fill', '#FFFFFF')
      .attr('stroke', '#000000')
      .attr('stroke-width', 0.5)
      .attr('pointer-events', 'none')
      .text((d) => {
        const label = d.label || d.title || d.artist || 'Unknown';
        return label.length > 15 ? label.substring(0, 12) + '...' : label;
      });

    // Add drag behavior
    const dragBehavior = d3.drag<SVGCircleElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active && simulationRef.current) {
          simulationRef.current.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(dragBehavior);

    // Update positions on simulation tick
    simulationRef.current.on('tick', () => {
      // Update edge positions
      edgeElements
        .attr('x1', (d) => d.source.x!)
        .attr('y1', (d) => d.source.y!)
        .attr('x2', (d) => d.target.x!)
        .attr('y2', (d) => d.target.y!);

      // Update edge label positions (centered on edge)
      if (edgeLabelElements) {
        edgeLabelElements
          .attr('x', (d) => (d.source.x! + d.target.x!) / 2)
          .attr('y', (d) => (d.source.y! + d.target.y!) / 2);
      }

      // Update node positions
      nodeElements
        .attr('cx', (d) => d.x!)
        .attr('cy', (d) => d.y!);

      // Update label positions
      labelElements
        .attr('x', (d) => d.x!)
        .attr('y', (d) => d.y!);

      // Update Redux store with new positions (throttled)
      if (simulationRef.current && simulationRef.current.alpha() < 0.1) {
        const positionUpdates = processedNodes.map(node => ({
          id: node.id,
          x: node.x!,
          y: node.y!
        }));
        dispatch(updateNodePositions(positionUpdates));
      }
    });

    // Initial zoom to fit content
    const bounds = container.node()?.getBBox();
    if (bounds) {
      const fullWidth = bounds.width;
      const fullHeight = bounds.height;
      const scale = 0.9 * Math.min(width / fullWidth, height / fullHeight);
      const translate = [
        (width - scale * (bounds.x + fullWidth / 2)) / scale,
        (height - scale * (bounds.y + fullHeight / 2)) / scale
      ];

      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(translate[0], translate[1])
          .scale(scale)
      );
    }

    // Cleanup function
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [
    processedData,
    width,
    height,
    getNodeColor,
    getNodeRadius,
    handleNodeClick,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    dispatch,
    nodeSize,
    edgeLabelSize,
    distancePower,
    relationshipPower
  ]);

  // Update node colors when selection/hover state changes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGCircleElement, D3Node>('.graph-node')
      .attr('fill', getNodeColor);
  }, [selectedNodes, hoveredNode, getNodeColor]);

  if (!processedData.processedNodes.length) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-xl font-bold mb-2">🎵 D3.js Graph Visualization</div>
            <div className="text-sm text-gray-400">Waiting for graph data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={className || "absolute inset-0"}
      style={{ width, height, backgroundColor: '#0F172A' }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block' }}
      >
        {/* Background for click-to-deselect */}
        <rect
          width={width}
          height={height}
          fill="transparent"
          onClick={() => dispatch(setSelectedNodes([]))}
        />
      </svg>

      {/* Info overlay */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white text-xs p-3 rounded font-mono">
        <div className="font-bold text-green-400 mb-1">🎵 D3.js Force Simulation</div>
        <div>Nodes: {processedData.processedNodes.length}</div>
        <div>Edges: {processedData.processedEdges.length}</div>
        {selectedNodes.length > 0 && (
          <div className="text-yellow-400">Selected: {selectedNodes.length}</div>
        )}
        {hoveredNode && (
          <div className="text-blue-400">
            Hovered: {nodes.find(n => n.id === hoveredNode)?.label || hoveredNode}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-2">
          • Click: select node<br/>
          • Ctrl+Click: multi-select<br/>
          • Drag: move node<br/>
          • Scroll: zoom<br/>
          • Click background: deselect
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white text-xs p-3 rounded">
        <div className="font-bold mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Artists</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Venues</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Locations</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Tracks</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-pink-500"></div>
            <span>Albums</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default D3GraphCanvas;