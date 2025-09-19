import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { useAppSelector, useAppDispatch } from '../../store/index';
import { setSelectedNodes } from '../../store/graphSlice';
import {
  setStartNode,
  setEndNode,
  addWaypoint,
  undoLastAction,
  setPlayedTracks,
  startPathCalculation,
} from '../../store/pathfindingSlice';
import { useAutoPathCalculation } from '../../hooks/useAutoPathCalculation';

interface WorkingD3CanvasProps {
  width: number;
  height: number;
  className?: string;
  distancePower?: number;
  relationshipPower?: number;
}

interface SimpleNode {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  color?: string;
  selected?: boolean;
  highlighted?: boolean;
}

interface SimpleEdge {
  id: string;
  source: string | SimpleNode;
  target: string | SimpleNode;
  weight?: number;
}

/**
 * Working D3.js graph visualization that bypasses complex TypeScript constraints
 * Focuses on functionality over strict typing for rapid prototyping
 */
export const WorkingD3Canvas: React.FC<WorkingD3CanvasProps> = ({
  width,
  height,
  className,
  distancePower = 1,
  relationshipPower = 0
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<SimpleNode, SimpleEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const dispatch = useAppDispatch();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; clickableNodes?: Array<{id: string, title: string}> } | null>(null);
  const [persistentTooltip, setPersistentTooltip] = useState<{ x: number; y: number; content: string; clickableNodes: Array<{id: string, title: string}>; nodeId: string } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [centeredNodeId, setCenteredNodeId] = useState<string | null>(null);
  const [edgeInfo, setEdgeInfo] = useState<{ nodeId: string; edges: any[] } | null>(null);
  const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set());

  // Get data from Redux store (with basic type handling)
  const { nodes, edges, selectedNodes } = useAppSelector(state => state.graph);
  const pathState = useAppSelector(state => state.pathfinding);

  // Enable automatic path calculation when start and end nodes are selected
  useAutoPathCalculation();

  // Color mapping for different node types
  const getNodeColor = useCallback((node: any) => {
    // Played songs get a special purple color
    if (playedSongs.has(node.id)) return '#A855F7'; // Purple for played songs

    if (centeredNodeId === node.id) return '#F59E0B'; // Amber for centered node
    if (node.selected || selectedNodes.includes(node.id)) return '#FCD34D'; // Light amber for selected
    if (node.highlighted) return '#EF4444'; // Red

    // Check if this node is part of the current path
    const routeNodes = pathState.currentPath?.nodes || [];
    if (routeNodes.includes(node.id)) {
      // Path nodes that aren't played yet are orange
      return '#FB923C'; // Orange for path nodes
    }

    // Grey out if not in collection (owned === false)
    const owned = node?.metadata?.owned;
    if (owned === false) return '#475569'; // Slate grey

    switch (node.type) {
      case 'artist': return '#3B82F6'; // Blue
      case 'venue': return '#10B981'; // Green
      case 'location': return '#F59E0B'; // Yellow
      case 'track': return '#8B5CF6'; // Purple
      case 'album': return '#EC4899'; // Pink
      default: return '#6B7280'; // Gray
    }
  }, [selectedNodes, centeredNodeId, playedSongs, pathState]);

  // Calculate distance from centered node using BFS
  const calculateDistance = useCallback((fromNodeId: string, toNodeId: string) => {
    if (fromNodeId === toNodeId) return 0;

    const visited = new Set<string>();
    const queue = [{ nodeId: fromNodeId, distance: 0 }];

    while (queue.length > 0) {
      const { nodeId, distance } = queue.shift()!;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      if (nodeId === toNodeId) return distance;

      // Add connected nodes to queue
      const connectedNodes = edges.filter(edge =>
        edge.source === nodeId || edge.target === nodeId
      );

      for (const edge of connectedNodes) {
        const nextNodeId = edge.source === nodeId ? edge.target : edge.source;
        if (!visited.has(nextNodeId)) {
          queue.push({ nodeId: nextNodeId, distance: distance + 1 });
        }
      }
    }

    return Infinity; // No path found
  }, [edges]);

  // Get transparency based on distance from centered node
  const getNodeOpacity = useCallback((node: any) => {
    if (!centeredNodeId) return 1;
    if (node.id === centeredNodeId) return 1;

    const distance = calculateDistance(centeredNodeId, node.id);
    if (distance === Infinity) return 0.1;

    // Exponential falloff: closer nodes are more opaque
    const maxDistance = 4; // Consider up to 4 hops
    const normalizedDistance = Math.min(distance / maxDistance, 1);
    return Math.max(0.1, 1 - normalizedDistance * 0.8);
  }, [centeredNodeId, calculateDistance]);

  // Get edge opacity based on distance from centered node and pathfinding state
  const getEdgeOpacity = useCallback((edge: any) => {
    // Get the actual node IDs from edge (might be objects or strings)
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

    // Check if this edge is part of the current path - make it fully opaque and red
    const routeNodes = pathState.currentPath?.nodes || [];
    for (let i = 0; i < routeNodes.length - 1; i++) {
      if ((routeNodes[i] === sourceId && routeNodes[i+1] === targetId) ||
          (routeNodes[i] === targetId && routeNodes[i+1] === sourceId)) {
        return 1.0; // Full opacity for path edges
      }
    }

    if (!centeredNodeId) return 0.3; // Default lower opacity when no node selected

    const sourceDistance = calculateDistance(centeredNodeId, sourceId);
    const targetDistance = calculateDistance(centeredNodeId, targetId);
    const minDistance = Math.min(sourceDistance, targetDistance);

    // Direct connections (distance 0) to selected node are fully opaque
    if (minDistance === 0) return 1.0;

    // Calculate transparency based on distance - further = more transparent
    const maxDistance = 4; // Consider edges up to 4 hops away
    if (minDistance > maxDistance) return 0.05; // Very faint but still visible if too far

    // Use exponential decay for smoother opacity falloff
    // Distance 1: ~0.7, Distance 2: ~0.4, Distance 3: ~0.2, Distance 4: ~0.1
    const normalizedDistance = minDistance / maxDistance;
    const opacity = Math.exp(-2 * normalizedDistance) * 0.9;

    // Ensure minimum visibility of 0.05 and maximum of 0.8 for non-direct edges
    return Math.max(0.05, Math.min(0.8, opacity));
  }, [centeredNodeId, calculateDistance, pathState]);

  // Get node radius
  const getNodeRadius = useCallback((node: any) => {
    const baseRadius = 8;
    const degree = (node.metrics?.degree || 1);
    const isCentered = centeredNodeId === node.id;
    return Math.min(20, baseRadius + Math.sqrt(degree) + (isCentered ? 4 : 0));
  }, [centeredNodeId]);

  // Helper function to wrap text into lines with max 15 characters per line
  const wrapText = useCallback((text: string, maxLength: number = 15): string[] => {
    if (!text) return [''];

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than maxLength, truncate it
          lines.push(word.substring(0, maxLength - 3) + '...');
          currentLine = '';
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }, []);

  // Get formatted node text with title and artist
  const getNodeDisplayText = useCallback((node: any): { lines: string[], totalHeight: number } => {
    const title = node.title || node.label || 'Unknown';
    const artist = node.artist || '';

    const titleLines = wrapText(title, 15);
    const artistLines = artist ? wrapText(artist, 15) : [];

    // Combine title and artist with separator if both exist
    const allLines = artist ? [...titleLines, '---', ...artistLines] : titleLines;

    // Limit to maximum 4 lines total to keep nodes readable
    const maxLines = 4;
    const finalLines = allLines.slice(0, maxLines);

    if (allLines.length > maxLines) {
      finalLines[maxLines - 1] = finalLines[maxLines - 1].substring(0, 12) + '...';
    }

    return {
      lines: finalLines,
      totalHeight: finalLines.length * 12 // 12px line height
    };
  }, [wrapText]);

  // Center a node in the viewport
  const centerNode = useCallback((nodeId: string) => {
    setCenteredNodeId(nodeId);

    if (!simulationRef.current || !svgRef.current || !zoomRef.current) return;

    const simulation = simulationRef.current;
    const targetNode = simulation.nodes().find((n: any) => n.id === nodeId);
    const svg = d3.select(svgRef.current);
    const zoom = zoomRef.current;

    if (targetNode) {
      // Get the current zoom transform
      const currentTransform = d3.zoomTransform(svg.node()!);

      // Calculate the target position in screen coordinates
      const targetScreenX = targetNode.x! * currentTransform.k + currentTransform.x;
      const targetScreenY = targetNode.y! * currentTransform.k + currentTransform.y;

      // Calculate the offset needed to center the node
      const offsetX = width / 2 - targetScreenX;
      const offsetY = height / 2 - targetScreenY;

      // Create new transform that centers the node
      const newTransform = d3.zoomIdentity
        .translate(currentTransform.x + offsetX, currentTransform.y + offsetY)
        .scale(currentTransform.k);

      // Animate the zoom transform to center the node
      svg.transition()
        .duration(1000)
        .call(zoom.transform, newTransform);

      // Also set the node as temporarily fixed for physics
      targetNode.fx = targetNode.x;
      targetNode.fy = targetNode.y;

      // Restart simulation with higher alpha for visual feedback
      simulation.alpha(0.3).restart();

      // Release the fixed position after animation
      setTimeout(() => {
        targetNode.fx = null;
        targetNode.fy = null;
      }, 1500);
    }
  }, [width, height]);

  // Calculate min/max distances for gradient coloring
  const getDistanceRange = useCallback(() => {
    if (!edges.length) return { min: 0, max: 100 };

    const distances = edges.map(edge => {
      const metadata = edge.metadata || {};
      return metadata.visual_distance || 80;
    });

    return {
      min: Math.min(...distances),
      max: Math.max(...distances)
    };
  }, [edges]);

  // Get edge color based on distance with gradient
  const getEdgeColor = useCallback((edge: any, isHighlighted: boolean = false) => {
    // Get the actual node IDs from edge (might be objects or strings)
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

    // Check if this edge is part of the current path - make it red
    const routeNodes = pathState.currentPath?.nodes || [];
    for (let i = 0; i < routeNodes.length - 1; i++) {
      if ((routeNodes[i] === sourceId && routeNodes[i+1] === targetId) ||
          (routeNodes[i] === targetId && routeNodes[i+1] === sourceId)) {
        return '#EF4444'; // Red for path edges
      }
    }

    // Direct connections to selected node are orange
    if (centeredNodeId &&
        (sourceId === centeredNodeId || targetId === centeredNodeId)) {
      return '#F59E0B'; // Orange for direct connections
    }

    // Highlight connected edges to selected/centered node
    if (isHighlighted) return '#F59E0B'; // Bright amber for highlighted connections

    const metadata = edge.metadata || {};
    const distance = metadata.visual_distance || 80;
    const { min, max } = getDistanceRange();

    // Normalize distance to 0-1 range
    const normalized = max > min ? (distance - min) / (max - min) : 0;

    // Create gradient from close (red) to far (blue)
    // Close distances (low values) = Red/Orange
    // Medium distances = Yellow/Green
    // Far distances (high values) = Blue/Purple
    if (normalized < 0.25) {
      // Very close: Red to Orange
      const t = normalized / 0.25;
      return `rgb(${255}, ${Math.floor(69 + t * 100)}, ${Math.floor(t * 69)})`;
    } else if (normalized < 0.5) {
      // Close: Orange to Yellow
      const t = (normalized - 0.25) / 0.25;
      return `rgb(${255}, ${Math.floor(169 + t * 86)}, ${Math.floor(69 + t * 186)})`;
    } else if (normalized < 0.75) {
      // Medium: Yellow to Green
      const t = (normalized - 0.5) / 0.25;
      return `rgb(${Math.floor(255 - t * 139)}, ${255}, ${Math.floor(255 - t * 139)})`;
    } else {
      // Far: Green to Blue
      const t = (normalized - 0.75) / 0.25;
      return `rgb(${Math.floor(116 - t * 57)}, ${Math.floor(255 - t * 153)}, ${Math.floor(116 + t * 139)})`;
    }
  }, [edges, getDistanceRange, pathState, centeredNodeId]);

  // Handle interactions
  const handleNodeClick = useCallback((event: MouseEvent, node: any) => {
    event.stopPropagation();

    // Close any existing persistent tooltip first
    setPersistentTooltip(null);

    // Center the clicked node
    centerNode(node.id);

    // Select the node in Redux
    dispatch(setSelectedNodes([node.id]));

    // Create persistent tooltip with track information and connections
    const metadata = node.metadata || {};
    const lines = [];

    // Main track info
    const title = node.title || node.label;
    const artist = node.artist;
    if (title && title !== 'Unknown Track' && title !== 'Unknown Title') {
      lines.push(`🎵 ${title}`);
    }
    if (artist && artist !== 'Unknown Artist') {
      lines.push(`🎤 ${artist}`);
    }

    // Additional metadata
    if (metadata.is_remix) {
      lines.push('🔄 Remix');
    }
    if (metadata.is_mashup) {
      lines.push('🎭 Mashup');
    }
    if (metadata.position_in_setlist) {
      lines.push(`📍 Position: #${metadata.position_in_setlist}`);
    }

    // Collection status
    if (metadata.owned === false) {
      lines.push('❌ Not in collection');
    } else if (metadata.owned === true) {
      lines.push('✅ In your collection');
    }

    // Get connected tracks for navigation
    const connectedTracks = edges.filter(edge =>
      edge.source === node.id || edge.target === node.id
    ) // Show all connections
    .map(edge => {
      const connectedNodeId = edge.source === node.id ? edge.target : edge.source;
      const connectedNode = nodes.find(n => n.id === connectedNodeId);
      if (connectedNode) {
        return {
          id: connectedNode.id,
          title: connectedNode.title || connectedNode.label || 'Unknown',
          frequency: edge.metadata?.adjacency_frequency || 1,
          strength: edge.metadata?.strength_category || 'weak'
        };
      }
      return null;
    }).filter(Boolean)
    .sort((a, b) => (b?.frequency || 0) - (a?.frequency || 0)); // Sort by frequency

    const clickableNodes = connectedTracks.map(track => ({
      id: track!.id,
      title: track!.title,
      frequency: track!.frequency,
      strength: track!.strength
    }));

    // Create persistent tooltip positioned near the clicked node
    const svgElement = svgRef.current;
    const rect = svgElement?.getBoundingClientRect();
    const svgX = node.x || 0;
    const svgY = node.y || 0;

    // Convert SVG coordinates to screen coordinates
    const currentTransform = svgElement ? d3.zoomTransform(svgElement) : { x: 0, y: 0, k: 1 };
    const screenX = (rect?.left || 0) + svgX * currentTransform.k + currentTransform.x;
    const screenY = (rect?.top || 0) + svgY * currentTransform.k + currentTransform.y;

    // Ensure tooltip stays within viewport bounds
    const tooltipWidth = 350;
    const tooltipHeight = 400;
    const finalX = Math.min(Math.max(10, screenX), window.innerWidth - tooltipWidth - 10);
    const finalY = Math.min(Math.max(10, screenY), window.innerHeight - tooltipHeight - 10);

    // Delay tooltip creation to prevent it from being cleared by re-render
    setTimeout(() => {
      setPersistentTooltip({
        x: finalX,
        y: finalY,
        content: lines.join('\n'),
        clickableNodes,
        nodeId: node.id
      });
    }, 150);

    // Close any open menus/tooltips
    setMenu(null);
    setTooltip(null);
  }, [dispatch, centerNode, edges, nodes]);

  // Enhanced DOM hover effects with detailed track information
  const handleNodeMouseEnter = useCallback((event: MouseEvent, node: any) => {
    // Direct DOM manipulation for hover effect
    const target = event.target as SVGCircleElement;
    target.setAttribute('stroke', '#F59E0B');
    target.setAttribute('stroke-width', '3');
    target.setAttribute('r', String(Number(target.getAttribute('r')) * 1.2));

    // Enhanced tooltip with detailed track information
    const pt = event as any;
    const metadata = node.metadata || {};

    // Build detailed tooltip content
    const lines = [];

    // Main track info (show available data, skip only if explicitly unknown)
    const title = node.title || node.label;
    const artist = node.artist;
    if (title && title !== 'Unknown Track' && title !== 'Unknown Title') {
      lines.push(`🎵 ${title}`);
    }
    if (artist && artist !== 'Unknown Artist') {
      lines.push(`🎤 ${artist}`);
    }

    // Remix/mashup info
    if (metadata.is_remix) {
      lines.push('🔄 Remix');
    }
    if (metadata.is_mashup) {
      lines.push('🎭 Mashup');
    }

    // Track type and position info
    if (metadata.position_in_setlist) {
      lines.push(`📍 Position: #${metadata.position_in_setlist}`);
    }

    // Collection status
    if (metadata.owned === false) {
      lines.push('❌ Not in collection');
    } else if (metadata.owned === true) {
      lines.push('✅ In your collection');
    }

    // Adjacent tracks info - find connected tracks
    const connectedTracks = edges.filter(edge =>
      edge.source === node.id || edge.target === node.id
    ).slice(0, 3); // Show top 3 connections

    const clickableNodes: Array<{id: string, title: string}> = [];

    if (connectedTracks.length > 0) {
      lines.push('');
      lines.push('🔗 Often played with (click to center):');
      connectedTracks.forEach(edge => {
        const connectedNodeId = edge.source === node.id ? edge.target : edge.source;
        const connectedNode = nodes.find(n => n.id === connectedNodeId);
        if (connectedNode && edge.metadata) {
          const freq = edge.metadata.adjacency_frequency || 1;
          const strength = edge.metadata.strength_category || 'weak';
          const strengthEmoji = {
            'very_strong': '🔥',
            'strong': '⚡',
            'moderate': '🌟',
            'weak': '💫'
          }[strength] || '💫';

          const trackTitle = connectedNode.title || connectedNode.label;
          lines.push(`${strengthEmoji} ${trackTitle} (${freq}x)`);
          clickableNodes.push({ id: connectedNode.id, title: trackTitle });
        }
      });
    }

    // Notes if available
    if (metadata.notes) {
      lines.push('');
      lines.push(`📝 ${metadata.notes}`);
    }

    setTooltip({
      x: pt.clientX || 0,
      y: pt.clientY || 0,
      content: lines.join('\n'),
      clickableNodes
    });
  }, [nodes, edges]);

  const handleNodeMouseLeave = useCallback((event: MouseEvent, node: any) => {
    // Reset hover effects directly on DOM
    const target = event.target as SVGCircleElement;
    target.setAttribute('stroke', '');
    target.setAttribute('stroke-width', '0');
    target.setAttribute('r', String(Number(target.getAttribute('r')) / 1.2));
    setTooltip(null);
  }, []);

  // Handle clicking outside to close persistent tooltip and deselect nodes
  const handleBackgroundClick = useCallback(() => {
    setPersistentTooltip(null);
    dispatch(setSelectedNodes([]));
    setCenteredNodeId(null); // Clear the centered node to deselect
    setMenu(null); // Clear any open menus
  }, [dispatch]);

  // Toggle collection status for a track
  const handleToggleCollection = useCallback((nodeId: string) => {
    // Find the node and toggle its collection status
    const node = nodes.find(n => n.id === nodeId);
    if (node?.metadata) {
      const newStatus = !node.metadata.owned;
      // Update the node's metadata (this would normally be persisted to backend)
      node.metadata.owned = newStatus;

      // Force re-render by updating the persistent tooltip
      if (persistentTooltip?.nodeId === nodeId) {
        const fakeEvent = {
          stopPropagation: () => {},
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2
        } as any;
        setTimeout(() => handleNodeClick(fakeEvent, node), 100);
      }
    }
  }, [nodes, persistentTooltip, handleNodeClick]);

  // Pathfinding control functions
  const handleSetStartNode = useCallback((nodeId: string) => {
    // Check if there are played songs
    if (playedSongs.size > 0 && pathState.startNode !== nodeId) {
      alert('Cannot change start track after tracks have been played');
      return;
    }
    dispatch(setStartNode(nodeId));

    // Trigger automatic path calculation if end node is also set
    if (pathState.endNode) {
      dispatch(startPathCalculation());
    }
  }, [dispatch, pathState, playedSongs]);

  const handleSetEndNode = useCallback((nodeId: string) => {
    dispatch(setEndNode(nodeId));

    // Trigger automatic path calculation if start node is also set
    if (pathState.startNode) {
      dispatch(startPathCalculation());
    }
  }, [dispatch, pathState]);

  const handleAddWaypoint = useCallback((nodeId: string) => {
    dispatch(addWaypoint(nodeId));

    // Trigger automatic path recalculation if start and end are set
    if (pathState.startNode && pathState.endNode) {
      dispatch(startPathCalculation());
    }
  }, [dispatch, pathState]);

  const handleUndo = useCallback(() => {
    dispatch(undoLastAction());

    // Trigger path recalculation if needed
    if (pathState.startNode && pathState.endNode) {
      dispatch(startPathCalculation());
    }
  }, [dispatch, pathState]);

  // Mark song and all previous songs in path as played
  const handleMarkAsPlayed = useCallback((nodeId: string) => {
    const routeNodes = pathState.currentPath?.nodes || [];
    const currentIndex = routeNodes.indexOf(nodeId);

    if (currentIndex >= 0) {
      // Mark this song and all previous songs as played
      const newPlayedSongs = new Set(playedSongs);
      const playedArray: string[] = [];
      for (let i = 0; i <= currentIndex; i++) {
        newPlayedSongs.add(routeNodes[i]);
        playedArray.push(routeNodes[i]);
      }
      setPlayedSongs(newPlayedSongs);

      // Update Redux state with played tracks
      dispatch(setPlayedTracks(playedArray));

      // Update the persistent tooltip to show the new status
      if (persistentTooltip?.nodeId === nodeId) {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          const fakeEvent = {
            stopPropagation: () => {},
            clientX: window.innerWidth / 2,
            clientY: window.innerHeight / 2
          } as any;
          setTimeout(() => handleNodeClick(fakeEvent, node), 100);
        }
      }
    }
  }, [pathState, playedSongs, persistentTooltip, nodes, handleNodeClick, dispatch]);

  // Navigate to connected node from persistent tooltip
  const handleNavigateToNode = useCallback((nodeId: string) => {
    // Close current persistent tooltip first
    setPersistentTooltip(null);

    // Center and select the new node
    centerNode(nodeId);
    dispatch(setSelectedNodes([nodeId]));

    // After a brief delay, create new persistent tooltip for the new node
    setTimeout(() => {
      const newNode = nodes.find(n => n.id === nodeId);
      if (newNode) {
        // Simulate a click event to generate the persistent tooltip
        const fakeEvent = {
          stopPropagation: () => {},
          clientX: window.innerWidth / 2,
          clientY: window.innerHeight / 2
        } as any;
        handleNodeClick(fakeEvent, newNode);
      }
    }, 300); // Small delay to allow animation to center the node
  }, [centerNode, dispatch, nodes]);

  // Main D3 visualization effect
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    console.log('🎨 Creating D3 visualization with', nodes.length, 'nodes and', edges.length, 'edges');
    console.log('📏 Canvas dimensions:', { width, height });

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Convert Redux data to simple format with robust circular positioning
    const simpleNodes: SimpleNode[] = nodes.map((node, index) => {
      // Create multiple concentric circles for better distribution
      const nodesPerRing = 8;
      const ring = Math.floor(index / nodesPerRing);
      const positionInRing = index % nodesPerRing;
      const angle = (positionInRing / nodesPerRing) * 2 * Math.PI;

      // Create expanding rings
      const baseRadius = Math.min(width, height) * 0.15;
      const radius = baseRadius + (ring * 60);
      const centerX = width / 2;
      const centerY = height / 2;

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      console.log(`Node ${index}: positioned at (${x.toFixed(1)}, ${y.toFixed(1)}) in ring ${ring}`);

      return {
        id: node.id,
        label: node.label || node.title || 'Unknown',
        type: node.type || 'unknown',
        x: node.x || x,
        y: node.y || y,
        color: getNodeColor(node),
        selected: selectedNodes.includes(node.id),
        highlighted: Boolean((node as any).highlighted)
      };
    });

    const simpleEdges: SimpleEdge[] = edges.map((edge, index) => ({
      id: edge.id || `edge_${index}_${edge.source}_${edge.target}`,
      source: edge.source,
      target: edge.target,
      weight: edge.weight || 1
    }));

    // Create container with zoom
    const container = svg.append('g').attr('class', 'graph-container');
    const linkGroup = container.append('g').attr('class', 'links');
    const nodeGroup = container.append('g').attr('class', 'nodes');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    // Store zoom reference for centering functionality
    zoomRef.current = zoom;
    svg.call(zoom);

    // Create simulation with frequency-aware force parameters
    const nodeRadius = 15;
    const simulation = d3.forceSimulation(simpleNodes)
      .force('link', d3.forceLink<SimpleNode, SimpleEdge>(simpleEdges)
        .id(d => d.id)
        .distance((d: any) => {
          // Enhanced distance calculation for more obvious clustering
          const metadata = d.metadata || {};
          const frequency = metadata.adjacency_frequency || 1;
          const strengthCategory = metadata.strength_category || 'weak';

          // Create more dramatic base distance differences
          let baseDistance;
          switch (strengthCategory) {
            case 'very_strong': baseDistance = 30; break;   // Very close
            case 'strong': baseDistance = 60; break;        // Close
            case 'moderate': baseDistance = 120; break;     // Medium
            default: baseDistance = 200; break;             // Far apart
          }

          // Further reduce distance for high frequency connections
          const frequencyAdjustment = Math.max(0.3, 1 - (frequency * 0.1));
          const finalDistance = baseDistance * frequencyAdjustment;

          // Apply power scaling
          const adjustedDistance = finalDistance * Math.pow(10, distancePower);
          return Math.max(10, Math.min(1e10, adjustedDistance));
        })
        .strength((d: any) => {
          // Enhanced strength calculation for better clustering
          const metadata = d.metadata || {};
          const frequency = metadata.adjacency_frequency || 1;
          const strengthCategory = metadata.strength_category || 'weak';

          // More dramatic strength differences
          let baseStrength;
          switch (strengthCategory) {
            case 'very_strong': baseStrength = 0.8; break;
            case 'strong': baseStrength = 0.6; break;
            case 'moderate': baseStrength = 0.4; break;
            default: baseStrength = 0.1; break;
          }

          // Apply relationship power scaling (10^relationshipPower)
          const frequencyBonus = frequency * 0.05;
          const totalStrength = baseStrength + frequencyBonus;
          const adjustedStrength = totalStrength * Math.pow(10, relationshipPower);

          return Math.min(1.0, Math.max(0.01, adjustedStrength));
        })
      )
      .force('charge', d3.forceManyBody()
        .strength(-300)
        .distanceMin(nodeRadius * 2)
        .distanceMax(Math.min(width, height) * 0.5)
      )
      .force('collision', d3.forceCollide()
        .radius(d => getNodeRadius(d) + 8)
        .strength(0.8)
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.1))
      .alpha(1)
      .alphaDecay(0.01)
      .velocityDecay(0.4);

    simulationRef.current = simulation;

    // Create links with frequency-based visualization
    const routeSet = new Set<string>((pathState.currentPath?.nodes || []));
    const routeNodes = pathState.currentPath?.nodes || [];

    const link = linkGroup
      .selectAll('line')
      .data(simpleEdges)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => {
        // Get the actual node IDs from edge
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;

        // Check if this edge is part of the path - make it red and thick
        for (let i = 0; i < routeNodes.length - 1; i++) {
          if ((routeNodes[i] === sourceId && routeNodes[i+1] === targetId) ||
              (routeNodes[i] === targetId && routeNodes[i+1] === sourceId)) {
            return '#EF4444'; // Red for path edges
          }
        }

        // Check if this edge is connected to the centered or selected node
        const centeredOrSelected = centeredNodeId || selectedNodes[0];
        const isHighlighted = centeredOrSelected && (
          sourceId === centeredOrSelected ||
          targetId === centeredOrSelected
        );

        // Use distance-based gradient coloring with highlighting
        return getEdgeColor(d, isHighlighted);
      })
      .attr('stroke-width', (d: any) => {
        // Get the actual node IDs from edge
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;

        // Check if this edge is part of the path
        let isRoute = false;
        for (let i = 0; i < routeNodes.length - 1; i++) {
          if ((routeNodes[i] === sourceId && routeNodes[i+1] === targetId) ||
              (routeNodes[i] === targetId && routeNodes[i+1] === sourceId)) {
            isRoute = true;
            break;
          }
        }

        // Thinner width based on adjacency frequency
        const metadata = d.metadata || {};
        const frequency = metadata.adjacency_frequency || 1;
        return isRoute ? 4 : Math.max(0.5, Math.min(3, frequency * 0.8));
      })
      .attr('stroke-opacity', (d: any) => {
        // Combine base opacity with distance-based transparency
        const metadata = d.metadata || {};
        const frequency = metadata.adjacency_frequency || 1;
        const baseOpacity = Math.max(0.6, Math.min(1.0, 0.6 + (frequency * 0.1)));
        const distanceOpacity = getEdgeOpacity(d);
        return baseOpacity * distanceOpacity;
      })
      .attr('stroke-dasharray', 'none'); // All edges are solid lines

    // Create nodes
    const node = nodeGroup
      .selectAll('circle')
      .data(simpleNodes)
      .enter()
      .append('circle')
      .attr('r', getNodeRadius)
      .attr('fill', d => d.color || getNodeColor(d))
      .attr('fill-opacity', d => getNodeOpacity(d))
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', d => getNodeOpacity(d))
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => {
        // Inline click handler to prevent D3 re-rendering
        handleNodeClick(event, d);
      })
      .on('contextmenu', (event: any, d: any) => {
        event.preventDefault();
        handleNodeClick(event as any, d as any);
      })
      .on('mouseenter', handleNodeMouseEnter)
      .on('mouseleave', handleNodeMouseLeave);

    // Create labels with multi-line support
    const labelGroups = nodeGroup
      .selectAll('g.label-group')
      .data(simpleNodes)
      .enter()
      .append('g')
      .attr('class', 'label-group')
      .attr('pointer-events', 'none');

    // Add multi-line text for each node
    labelGroups.each(function(d: any) {
      const group = d3.select(this);
      const nodeData = nodes.find(n => n.id === d.id) || d;
      const textData = getNodeDisplayText(nodeData);

      textData.lines.forEach((line, index) => {
        group.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', `${(index - (textData.lines.length - 1) / 2) * 12}px`)
          .attr('font-size', '10px')
          .attr('font-weight', index === 0 ? 'bold' : 'normal') // Title bold, artist normal
          .attr('fill', '#FFFFFF')
          .attr('fill-opacity', getNodeOpacity(d))
          .text(line);
      });
    });

    // Route step labels
    if (routeNodes.length) {
      const stepIndex = new Map<string, number>();
      routeNodes.forEach((id, idx) => stepIndex.set(id, idx + 1));
      nodeGroup
        .selectAll('text.route-step')
        .data(simpleNodes.filter(n => stepIndex.has(n.id)))
        .enter()
        .append('text')
        .attr('class', 'route-step')
        .attr('text-anchor', 'middle')
        .attr('dy', '-1.2em')
        .attr('font-size', '10px')
        .attr('font-weight', 'bold')
        .attr('fill', '#F59E0B')
        .text(d => String(stepIndex.get(d.id)));
    }

    // Add drag behavior
    const drag = d3.drag<SVGCircleElement, SimpleNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as SimpleNode).x!)
        .attr('y1', d => (d.source as SimpleNode).y!)
        .attr('x2', d => (d.target as SimpleNode).x!)
        .attr('y2', d => (d.target as SimpleNode).y!);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      labelGroups
        .attr('transform', d => `translate(${d.x!}, ${d.y!})`);

      // Continuously follow centered node
      if (centeredNodeId && zoomRef.current) {
        const centeredNode = simpleNodes.find(n => n.id === centeredNodeId);
        if (centeredNode && centeredNode.x !== undefined && centeredNode.y !== undefined) {
          const currentTransform = d3.zoomTransform(svg.node()!);

          // Calculate where the centered node currently appears on screen
          const currentScreenX = centeredNode.x * currentTransform.k + currentTransform.x;
          const currentScreenY = centeredNode.y * currentTransform.k + currentTransform.y;

          // Calculate center of screen
          const centerX = width / 2;
          const centerY = height / 2;

          // Only adjust if node has moved significantly from center (threshold to prevent jitter)
          const threshold = 5;
          const deltaX = centerX - currentScreenX;
          const deltaY = centerY - currentScreenY;

          if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold) {
            // Smoothly adjust the transform to keep node centered
            const dampening = 0.1; // Smooth following, not instant
            const newTransform = d3.zoomIdentity
              .translate(
                currentTransform.x + (deltaX * dampening),
                currentTransform.y + (deltaY * dampening)
              )
              .scale(currentTransform.k);

            // Apply transform without animation (for smooth following)
            svg.call(zoomRef.current.transform, newTransform);
          }
        }
      }
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, getNodeColor, getNodeRadius, getNodeDisplayText, distancePower, relationshipPower]);

  // Update colors and opacity when selection changes
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // Update node colors and opacity
    svg.selectAll('.nodes circle')
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('fill-opacity', (d: any) => getNodeOpacity(d))
      .attr('stroke-opacity', (d: any) => getNodeOpacity(d));

    // Update node label opacity
    svg.selectAll('.nodes .label-group text')
      .attr('fill-opacity', (d: any) => getNodeOpacity(d));

    // Update edge colors and opacity with highlighting
    const routeNodes = pathState.currentPath?.nodes || [];
    svg.selectAll('.links line')
      .attr('stroke', (d: any) => {
        // Get the actual node IDs from edge
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;

        // Check if this edge is part of the path - make it red
        for (let i = 0; i < routeNodes.length - 1; i++) {
          if ((routeNodes[i] === sourceId && routeNodes[i+1] === targetId) ||
              (routeNodes[i] === targetId && routeNodes[i+1] === sourceId)) {
            return '#EF4444'; // Red for path edges
          }
        }

        // Check if this edge is connected to the centered or selected node
        const centeredOrSelected = centeredNodeId || selectedNodes[0];
        const isHighlighted = centeredOrSelected && (
          sourceId === centeredOrSelected ||
          targetId === centeredOrSelected
        );

        // Use distance-based gradient coloring with highlighting
        return getEdgeColor(d, isHighlighted);
      })
      .attr('stroke-width', (d: any) => {
        // Get the actual node IDs from edge
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;

        // Check if this edge is part of the path
        let isRoute = false;
        for (let i = 0; i < routeNodes.length - 1; i++) {
          if ((routeNodes[i] === sourceId && routeNodes[i+1] === targetId) ||
              (routeNodes[i] === targetId && routeNodes[i+1] === sourceId)) {
            isRoute = true;
            break;
          }
        }

        // Width based on path status and frequency
        const metadata = d.metadata || {};
        const frequency = metadata.adjacency_frequency || 1;
        return isRoute ? 4 : Math.max(0.5, Math.min(3, frequency * 0.8));
      })
      .attr('stroke-opacity', (d: any) => {
        // Combine base opacity with distance-based transparency
        const metadata = d.metadata || {};
        const frequency = metadata.adjacency_frequency || 1;
        const baseOpacity = Math.max(0.6, Math.min(1.0, 0.6 + (frequency * 0.1)));
        const distanceOpacity = getEdgeOpacity(d);
        return baseOpacity * distanceOpacity;
      });
  }, [selectedNodes, centeredNodeId, pathState, getNodeColor, getEdgeColor, getNodeOpacity, getEdgeOpacity]);

  if (!nodes.length) {
    return (
      <div
        className={className || "absolute inset-0"}
        style={{ width, height, backgroundColor: '#0F172A' }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <div className="text-center">
            <div className="text-xl font-bold mb-2">🎵 D3.js Graph Visualization</div>
            <div className="text-sm text-gray-400">Waiting for graph data...</div>
            <div className="text-xs text-gray-500 mt-2">
              Nodes: {nodes.length} | Edges: {edges.length}
            </div>
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
        <rect
          width={width}
          height={height}
          fill="transparent"
          onClick={handleBackgroundClick}
        />
      </svg>

      {/* Enhanced Interactive Tooltip with clickable connections */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltip.y + 15,
            left: tooltip.x + 15,
            pointerEvents: tooltip.clickableNodes?.length ? 'auto' : 'none',
            maxWidth: '350px',
            zIndex: 1000
          }}
          className="bg-gray-900 bg-opacity-95 text-white text-sm px-4 py-3 rounded-lg shadow-xl border border-gray-700"
        >
          {/* Main tooltip content */}
          <div className="whitespace-pre-line mb-2">
            {tooltip.content.split('🔗 Often played with (click to center):')[0]}
          </div>

          {/* Clickable connected tracks */}
          {tooltip.clickableNodes && tooltip.clickableNodes.length > 0 && (
            <div className="border-t border-gray-700 pt-2">
              <div className="text-gray-300 text-xs mb-2">🔗 Often played with (click to center):</div>
              {tooltip.clickableNodes.map((track, index) => {
                const hoveredNodeId = selectedNodes[0] || centeredNodeId;
                const connectedEdge = edges.find(edge =>
                  (edge.source === hoveredNodeId && edge.target === track.id) ||
                  (edge.target === hoveredNodeId && edge.source === track.id)
                );
                const freq = connectedEdge?.metadata?.adjacency_frequency || 1;
                const strength = connectedEdge?.metadata?.strength_category || 'weak';
                const strengthEmoji = {
                  'very_strong': '🔥',
                  'strong': '⚡',
                  'moderate': '🌟',
                  'weak': '💫'
                }[strength] || '💫';

                return (
                  <button
                    key={track.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      centerNode(track.id);
                      dispatch(setSelectedNodes([track.id]));
                      setTooltip(null);
                    }}
                    className="block w-full text-left px-2 py-1 rounded hover:bg-gray-700 hover:text-amber-300 transition-colors text-xs"
                  >
                    {strengthEmoji} {track.title} ({freq}x)
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Persistent Tooltip - Click to Explore */}
      {persistentTooltip && (
        <div
          style={{
            position: 'fixed',
            top: persistentTooltip.y,
            left: persistentTooltip.x,
            maxWidth: '350px',
            zIndex: 1500
          }}
          className="bg-gray-900 bg-opacity-98 text-white border border-amber-500 rounded-lg shadow-2xl animate-in fade-in duration-200"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-amber-400 font-semibold text-sm">🎵 Track Details</h3>
            <button
              onClick={() => setPersistentTooltip(null)}
              className="text-gray-400 hover:text-white text-lg font-bold w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          </div>

          {/* Main content */}
          <div className="p-3">
            <div className="whitespace-pre-line text-sm mb-3">
              {persistentTooltip.content}
            </div>

            {/* Collection toggle and pathfinding controls */}
            <div className="border-t border-gray-700 pt-3 mb-3">
              <div className="text-amber-400 text-xs font-semibold mb-2">
                🎯 Actions:
              </div>
              <div className="space-y-2">
                {/* Collection toggle */}
                {(() => {
                  const node = nodes.find(n => n.id === persistentTooltip.nodeId);
                  const isInCollection = node?.metadata?.owned;
                  const routeNodes = pathState.currentPath?.nodes || [];
                  const currentIndex = routeNodes.indexOf(persistentTooltip.nodeId);
                  const nextNode = currentIndex >= 0 && currentIndex < routeNodes.length - 1 ?
                    nodes.find(n => n.id === routeNodes[currentIndex + 1]) : null;
                  const prevNode = currentIndex > 0 ?
                    nodes.find(n => n.id === routeNodes[currentIndex - 1]) : null;

                  return (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleCollection(persistentTooltip.nodeId);
                        }}
                        className={`w-full text-left p-2 rounded border transition-all text-xs ${
                          isInCollection
                            ? 'border-green-500 bg-green-900 hover:bg-green-800 text-green-200'
                            : 'border-red-500 bg-red-900 hover:bg-red-800 text-red-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{isInCollection ? '✅' : '❌'}</span>
                          <span className="font-medium">
                            {isInCollection ? 'In your collection' : 'Not in collection'}
                          </span>
                          <span className="ml-auto text-xs opacity-75">Click to toggle</span>
                        </div>
                      </button>

                      {/* Pathfinding controls */}
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetStartNode(persistentTooltip.nodeId);
                          }}
                          className={`p-2 rounded border text-xs transition-all ${
                            pathState.startNode === persistentTooltip.nodeId
                              ? 'border-green-500 bg-green-900 text-green-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          🎬 Start
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddWaypoint(persistentTooltip.nodeId);
                          }}
                          className={`p-2 rounded border text-xs transition-all ${
                            pathState.waypoints?.includes(persistentTooltip.nodeId)
                              ? 'border-yellow-500 bg-yellow-900 text-yellow-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          📍 Waypoint
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetEndNode(persistentTooltip.nodeId);
                          }}
                          className={`p-2 rounded border text-xs transition-all ${
                            pathState.endNode === persistentTooltip.nodeId
                              ? 'border-red-500 bg-red-900 text-red-200'
                              : 'border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200'
                          }`}
                        >
                          🏁 End
                        </button>
                      </div>

                      {/* Undo button */}
                      {pathState.lastAction && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUndo();
                          }}
                          className="w-full p-2 rounded border text-xs transition-all mt-2 border-gray-500 bg-gray-800 hover:bg-gray-700 text-gray-200"
                        >
                          ↩️ Undo Last Action
                        </button>
                      )}

                      {/* Show path position and played status */}
                      {currentIndex >= 0 && (
                        <div className="border-t border-gray-600 pt-2 mt-2">
                          <div className="text-amber-400 text-xs font-semibold mb-1">
                            🛣️ Path Position: {currentIndex + 1} of {routeNodes.length}
                          </div>

                          {/* Current song status and play controls */}
                          <div className="mb-2">
                            <div className={`p-2 rounded border text-xs ${
                              playedSongs.has(persistentTooltip.nodeId)
                                ? 'border-purple-500 bg-purple-900 text-purple-200'
                                : 'border-orange-500 bg-orange-900 text-orange-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{playedSongs.has(persistentTooltip.nodeId) ? '🎵' : '▶️'}</span>
                                  <span className="font-medium">
                                    {playedSongs.has(persistentTooltip.nodeId) ? 'Already Played' : 'Current Track'}
                                  </span>
                                </div>
                                {!playedSongs.has(persistentTooltip.nodeId) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsPlayed(persistentTooltip.nodeId);
                                    }}
                                    className="bg-green-800 hover:bg-green-700 text-green-200 px-2 py-1 rounded text-xs transition-all"
                                  >
                                    Mark Played
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Navigation buttons */}
                          <div className="space-y-1">
                            {prevNode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigateToNode(prevNode.id);
                                }}
                                className={`w-full text-left p-2 rounded border text-xs transition-all ${
                                  playedSongs.has(prevNode.id)
                                    ? 'border-purple-500 bg-purple-900 hover:bg-purple-800 text-purple-200'
                                    : 'border-blue-500 bg-blue-900 hover:bg-blue-800 text-blue-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>⬅️</span>
                                  <span className="font-medium">
                                    Previous: {prevNode.title || prevNode.label}
                                  </span>
                                  {playedSongs.has(prevNode.id) && <span className="ml-auto">🎵</span>}
                                </div>
                              </button>
                            )}
                            {nextNode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigateToNode(nextNode.id);
                                }}
                                className={`w-full text-left p-2 rounded border text-xs transition-all ${
                                  playedSongs.has(nextNode.id)
                                    ? 'border-purple-500 bg-purple-900 hover:bg-purple-800 text-purple-200'
                                    : 'border-red-500 bg-red-900 hover:bg-red-800 text-red-200'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span>➡️</span>
                                  <span className="font-medium">
                                    Next: {nextNode.title || nextNode.label}
                                  </span>
                                  {playedSongs.has(nextNode.id) && <span className="ml-auto">🎵</span>}
                                </div>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Connected tracks for navigation */}
            {persistentTooltip.clickableNodes.length > 0 && (
              <div className="border-t border-gray-700 pt-3">
                <div className="text-amber-400 text-xs font-semibold mb-2">
                  🔗 Navigate to Connected Tracks ({persistentTooltip.clickableNodes.length}):
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {persistentTooltip.clickableNodes.map((track, index) => {
                    const strengthEmoji = {
                      'very_strong': '🔥',
                      'strong': '⚡',
                      'moderate': '🌟',
                      'weak': '💫'
                    }[track.strength as string] || '💫';

                    const strengthColor = {
                      'very_strong': 'border-red-500 hover:bg-red-900',
                      'strong': 'border-orange-500 hover:bg-orange-900',
                      'moderate': 'border-yellow-500 hover:bg-yellow-900',
                      'weak': 'border-blue-500 hover:bg-blue-900'
                    }[track.strength as string] || 'border-gray-500 hover:bg-gray-800';

                    return (
                      <button
                        key={track.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToNode(track.id);
                        }}
                        className={`w-full text-left p-2 rounded border ${strengthColor} bg-gray-800 hover:bg-opacity-80 transition-all text-xs group`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-sm">{strengthEmoji}</span>
                            <span className="text-white font-medium truncate group-hover:text-amber-300 transition-colors">
                              {track.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400 group-hover:text-amber-400 transition-colors">
                            <span className="text-xs">({track.frequency}x)</span>
                            <span className="text-xs">→</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation hint */}
            <div className="border-t border-gray-700 pt-2 mt-3">
              <div className="text-gray-500 text-xs">
                💡 Click track names above to navigate and explore connections
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edge Information Panel */}
      {edgeInfo && (
        <div
          className="fixed top-20 left-4 bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg shadow-xl p-4 max-w-md max-h-96 overflow-y-auto z-50"
          style={{ minWidth: '320px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-lg">Track Connections</h3>
            <button
              onClick={() => setEdgeInfo(null)}
              className="text-gray-400 hover:text-white text-xl font-bold"
            >
              ×
            </button>
          </div>

          <div className="text-gray-300 text-sm mb-3">
            Showing {edgeInfo.edges.length} connections for selected track
          </div>

          <div className="space-y-2">
            {edgeInfo.edges.map((edge, index) => {
              const connectedNode = edge.connectedNode;
              if (!connectedNode) return null;

              const freq = edge.metadata?.adjacency_frequency || 1;
              const strength = edge.metadata?.strength_category || 'weak';
              const strengthEmoji = {
                'very_strong': '🔥',
                'strong': '⚡',
                'moderate': '🌟',
                'weak': '💫'
              }[strength] || '💫';

              const strengthColor = {
                'very_strong': 'text-red-400',
                'strong': 'text-orange-400',
                'moderate': 'text-yellow-400',
                'weak': 'text-blue-400'
              }[strength] || 'text-gray-400';

              return (
                <button
                  key={edge.id}
                  onClick={() => {
                    centerNode(connectedNode.id);
                    dispatch(setSelectedNodes([connectedNode.id]));
                    setEdgeInfo(null);
                  }}
                  className="w-full text-left p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{strengthEmoji}</span>
                        <span className={`text-xs font-medium ${strengthColor}`}>
                          {strength.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">({freq}x)</span>
                      </div>
                      <div className="text-white font-medium truncate">
                        {connectedNode.title || connectedNode.label}
                      </div>
                      {connectedNode.artist && (
                        <div className="text-gray-400 text-sm truncate">
                          {connectedNode.artist}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs ml-2">
                      →
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {edgeInfo.edges.length === 0 && (
            <div className="text-gray-500 text-center py-4">
              No connections found for this track
            </div>
          )}
        </div>
      )}

      {/* Context Menu */}
      {menu && (
        <div
          className="bg-gray-900 border border-gray-700 rounded shadow-lg text-sm"
          style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 10000 }}
          onMouseLeave={() => setMenu(null)}
        >
          <button className="block w-full text-left px-3 py-2 hover:bg-gray-800 text-white" onClick={() => { dispatch(setStartNode(menu.nodeId)); setMenu(null); }}>
            First Track
          </button>
          <button className="block w-full text-left px-3 py-2 hover:bg-gray-800 text-white" onClick={() => { dispatch(setEndNode(menu.nodeId)); setMenu(null); }}>
            Last Track
          </button>
          <button className="block w-full text-left px-3 py-2 hover:bg-gray-800 text-white" onClick={() => { dispatch(addWaypoint(menu.nodeId)); setMenu(null); }}>
            Add to route
          </button>
          <button className="block w-full text-left px-3 py-2 hover:bg-gray-800 text-gray-300" onClick={() => setMenu(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkingD3Canvas;
