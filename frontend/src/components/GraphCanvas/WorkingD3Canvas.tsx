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
  nodeSize?: number;
  edgeLabelSize?: number;
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
  relationshipPower = 0,
  nodeSize = 12,
  edgeLabelSize = 12
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

  // Color mapping for different node types with distinctive colors for pathfinding
  const getNodeColor = useCallback((node: any) => {
    // Priority 1: First track (start node) - Bright Green
    if (pathState.startNode === node.id) return '#22C55E'; // Bright green for start

    // Priority 2: Last track (end node) - Bright Red
    if (pathState.endNode === node.id) return '#EF4444'; // Bright red for end

    // Priority 3: Played songs - Deep Purple
    if (playedSongs.has(node.id)) return '#7C3AED'; // Deep purple for played songs

    // Priority 4: Waypoint tracks - Bright Orange
    if (pathState.waypoints?.includes(node.id)) return '#F97316'; // Bright orange for waypoints

    // Priority 5: Centered node
    if (centeredNodeId === node.id) return '#F59E0B'; // Amber for centered node

    // Priority 6: Selected nodes
    if (node.selected || selectedNodes.includes(node.id)) return '#FCD34D'; // Light amber for selected

    // Priority 7: Highlighted nodes
    if (node.highlighted) return '#EF4444'; // Red

    // Priority 8: Check if this node is part of the current path (but not start/end/waypoint)
    const routeNodes = pathState.currentPath?.nodes || [];
    if (routeNodes.includes(node.id)) {
      // Path nodes that aren't played yet are light orange
      return '#FB923C'; // Light orange for path nodes
    }

    // Priority 9: Grey out if not in collection (owned === false)
    const owned = node?.metadata?.owned;
    if (owned === false) return '#475569'; // Slate grey

    // Default colors by type
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
    const baseRadius = nodeSize;
    const degree = (node.metrics?.degree || 1);
    const isCentered = centeredNodeId === node.id;
    return Math.min(24, baseRadius + Math.sqrt(degree) + (isCentered ? 4 : 0));
  }, [centeredNodeId, nodeSize]);

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

  // Check if only one node is visible in current viewport (for edge labeling)
  const getVisibleNodesCount = useCallback(() => {
    if (!svgRef.current || !simulationRef.current) return 0;

    const svg = d3.select(svgRef.current);
    const currentTransform = d3.zoomTransform(svg.node()!);
    const nodes = simulationRef.current.nodes();

    let visibleCount = 0;
    const margin = 20; // Reduced buffer zone for more precise detection

    nodes.forEach((node: any) => {
      if (node.x !== undefined && node.y !== undefined) {
        // Calculate screen position
        const screenX = node.x * currentTransform.k + currentTransform.x;
        const screenY = node.y * currentTransform.k + currentTransform.y;

        // Check if node is within viewport (more strict detection)
        if (screenX >= -margin && screenX <= width + margin &&
            screenY >= -margin && screenY <= height + margin) {
          visibleCount++;
        }
      }
    });

    // Debug logging for troubleshooting
    console.log(`Visible nodes count: ${visibleCount}, zoom level: ${currentTransform.k.toFixed(2)}`);

    return visibleCount;
  }, [width, height]);

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

    // Only set the centered node for highlighting, don't actually center the viewport
    setCenteredNodeId(node.id);

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
  }, [dispatch, edges, nodes]);

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

  // Centralized deselection logic
  const deselectAll = useCallback(() => {
    setPersistentTooltip(null);
    dispatch(setSelectedNodes([]));
    setCenteredNodeId(null); // Clear the centered node to deselect
    setMenu(null); // Clear any open menus

    // Release any fixed node positions but don't restart simulation
    if (simulationRef.current) {
      simulationRef.current.nodes().forEach((node: any) => {
        node.fx = null;
        node.fy = null;
      });
      // Don't restart the simulation - let nodes stay where they are
    }
  }, [dispatch]);

  // Handle clicking outside to close persistent tooltip and deselect nodes
  const handleBackgroundClick = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  // Handle escape key to deselect all
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      deselectAll();
    }
  }, [deselectAll]);

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

    // Select the new node without centering camera
    setCenteredNodeId(nodeId);
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
    }, 100); // Reduced delay since no animation
  }, [dispatch, nodes, handleNodeClick]);

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
        // Update edge labels when zoom changes
        updateEdgeLabels();
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
          // Enhanced distance calculation with bridge connection detection
          const metadata = d.metadata || {};
          const frequency = metadata.adjacency_frequency || 1;
          const strengthCategory = metadata.strength_category || 'weak';

          // Identify bridge connections: strong links between nodes with different cluster memberships
          const sourceNode = typeof d.source === 'object' ? d.source : simpleNodes.find(n => n.id === d.source);
          const targetNode = typeof d.target === 'object' ? d.target : simpleNodes.find(n => n.id === d.target);

          // Check if this is a bridge connection (strong connection between different clusters)
          let isBridgeConnection = false;
          if (sourceNode && targetNode && (strengthCategory === 'strong' || strengthCategory === 'very_strong')) {
            // Count how many neighbors each node shares
            const sourceNeighbors = simpleEdges.filter(e =>
              e.source === sourceNode.id || e.target === sourceNode.id ||
              (typeof e.source === 'object' && e.source.id === sourceNode.id) ||
              (typeof e.target === 'object' && e.target.id === sourceNode.id)
            ).map(e => typeof e.source === 'object' ?
              (e.source.id === sourceNode.id ? e.target.id : e.source.id) :
              (e.source === sourceNode.id ? e.target : e.source));

            const targetNeighbors = simpleEdges.filter(e =>
              e.source === targetNode.id || e.target === targetNode.id ||
              (typeof e.source === 'object' && e.source.id === targetNode.id) ||
              (typeof e.target === 'object' && e.target.id === targetNode.id)
            ).map(e => typeof e.source === 'object' ?
              (e.source.id === targetNode.id ? e.target.id : e.source.id) :
              (e.source === targetNode.id ? e.target : e.source));

            // Calculate shared neighbors (indicates same cluster)
            const sharedNeighbors = sourceNeighbors.filter(n => targetNeighbors.includes(n));
            const totalUniqueNeighbors = new Set([...sourceNeighbors, ...targetNeighbors]).size;

            // If they share few neighbors relative to their total, it's likely a bridge
            const sharedRatio = sharedNeighbors.length / Math.max(1, totalUniqueNeighbors);
            isBridgeConnection = sharedRatio < 0.3; // Less than 30% shared neighbors indicates bridge
          }

          // Base distances with special handling for bridge connections
          let minDistance;
          if (isBridgeConnection) {
            // Bridge connections get elastic distances to stretch between clusters
            minDistance = 150; // Allows stretching but maintains connection visibility
          } else {
            switch (strengthCategory) {
              case 'very_strong': minDistance = 25; break;    // Minimum for tight clusters
              case 'strong': minDistance = 45; break;         // Minimum for visible clusters
              case 'moderate': minDistance = 120; break;      // Minimum for moderate separation
              default: minDistance = 600; break;              // High minimum for unrelated tracks
            }
          }

          // Variable distance calculation
          let variableDistance;
          if (isBridgeConnection) {
            // Bridge connections: Allow elastic stretching based on cluster separation
            // Higher frequency bridges are slightly less elastic
            const elasticity = 3.0 - (frequency * 0.1); // Range: 2.0 to 3.0
            variableDistance = minDistance * elasticity;
          } else if (strengthCategory !== 'weak') {
            // For related tracks within same cluster
            const frequencyVariation = 1 + (frequency * 0.1);
            const baseVariableDistance = minDistance * (2 - (frequency * 0.15));
            variableDistance = Math.max(minDistance, baseVariableDistance / frequencyVariation);
          } else {
            // For unrelated tracks, use aggressive separation
            const separationMultiplier = Math.max(2.0, 4.0 - (frequency * 0.3));
            variableDistance = minDistance * separationMultiplier;

            if (frequency <= 2) {
              variableDistance *= 1.8;
            }
          }

          let finalDistance = variableDistance;

          // Apply power scaling with expanded range, ensuring minimum distance is always respected
          const adjustedDistance = finalDistance * Math.pow(10, distancePower);
          return Math.max(minDistance, Math.min(2e10, adjustedDistance));
        })
        .strength((d: any) => {
          // Enhanced strength calculation for better clustering
          const metadata = d.metadata || {};
          const frequency = metadata.adjacency_frequency || 1;
          const strengthCategory = metadata.strength_category || 'weak';

          // Check if this is a bridge connection (simplified check)
          const sourceNode = typeof d.source === 'object' ? d.source : simpleNodes.find(n => n.id === d.source);
          const targetNode = typeof d.target === 'object' ? d.target : simpleNodes.find(n => n.id === d.target);

          let isBridgeConnection = false;
          if (sourceNode && targetNode && (strengthCategory === 'strong' || strengthCategory === 'very_strong')) {
            // Simple bridge detection: count shared neighbors
            const sourceEdges = simpleEdges.filter(e =>
              e.source === sourceNode.id || e.target === sourceNode.id ||
              (typeof e.source === 'object' && e.source.id === sourceNode.id) ||
              (typeof e.target === 'object' && e.target.id === sourceNode.id)
            );
            const targetEdges = simpleEdges.filter(e =>
              e.source === targetNode.id || e.target === targetNode.id ||
              (typeof e.source === 'object' && e.source.id === targetNode.id) ||
              (typeof e.target === 'object' && e.target.id === targetNode.id)
            );

            // If nodes have many edges but few shared neighbors, it's likely a bridge
            isBridgeConnection = sourceEdges.length > 3 && targetEdges.length > 3;
          }

          // Adjusted strength for bridge connections vs intra-cluster connections
          let baseStrength;
          if (isBridgeConnection) {
            // Bridge connections get lower strength to allow stretching between clusters
            baseStrength = 0.25; // Much more elastic for bridges
          } else {
            switch (strengthCategory) {
              case 'very_strong': baseStrength = 0.8; break;
              case 'strong': baseStrength = 0.6; break;
              case 'moderate': baseStrength = 0.4; break;
              default: baseStrength = 0.1; break;
            }
          }

          // Apply relationship power scaling (10^relationshipPower)
          const frequencyBonus = frequency * 0.05;
          const totalStrength = baseStrength + frequencyBonus;
          const adjustedStrength = totalStrength * Math.pow(10, relationshipPower);

          return Math.min(1.0, Math.max(0.01, adjustedStrength));
        })
      )
      .force('charge', d3.forceManyBody()
        .strength((d: any) => {
          // Variable repulsion based on node connectivity
          const nodeId = d.id;
          const connectedEdges = simpleEdges.filter(edge =>
            edge.source === nodeId || edge.target === nodeId ||
            (typeof edge.source === 'object' && edge.source.id === nodeId) ||
            (typeof edge.target === 'object' && edge.target.id === nodeId)
          );

          // Highly connected nodes (hubs) have stronger repulsion to spread the graph
          const connectionCount = connectedEdges.length;
          const baseRepulsion = -900; // Much stronger repulsion for maximum separation
          const hubMultiplier = connectionCount > 5 ? 2.0 : 1.2; // Stronger hub effect

          return baseRepulsion * hubMultiplier;
        })
        .distanceMin(nodeRadius * 5) // Much increased minimum distance for better separation
        .distanceMax(Math.min(width, height) * 0.8) // Expanded maximum influence
      )
      .force('collision', d3.forceCollide()
        .radius(d => {
          // Enhanced collision radius for better spacing
          const baseRadius = getNodeRadius(d);
          const nodeId = d.id;
          const connectedEdges = simpleEdges.filter(edge =>
            edge.source === nodeId || edge.target === nodeId ||
            (typeof edge.source === 'object' && edge.source.id === nodeId) ||
            (typeof edge.target === 'object' && edge.target.id === nodeId)
          );

          // Hub nodes get much larger collision radius to create maximum space
          const hubMultiplier = connectedEdges.length > 5 ? 2.0 : 1.3;
          return baseRadius * hubMultiplier + 20; // Much increased padding for greater separation
        })
        .strength(0.9) // Stronger collision detection
      )
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.02)) // Much weaker center to maximize spreading
      .force('separation', () => {
        // Custom force to push unrelated node types apart
        simpleNodes.forEach((nodeA, i) => {
          simpleNodes.forEach((nodeB, j) => {
            if (i >= j) return; // Avoid duplicate calculations

            const nodeAData = nodes.find(n => n.id === nodeA.id);
            const nodeBData = nodes.find(n => n.id === nodeB.id);

            if (!nodeAData || !nodeBData) return;

            // Check if nodes are connected
            const isConnected = simpleEdges.some(edge =>
              (edge.source === nodeA.id && edge.target === nodeB.id) ||
              (edge.target === nodeA.id && edge.source === nodeB.id) ||
              (typeof edge.source === 'object' && typeof edge.target === 'object' &&
               ((edge.source.id === nodeA.id && edge.target.id === nodeB.id) ||
                (edge.target.id === nodeA.id && edge.source.id === nodeB.id)))
            );

            // If not connected, apply much stronger repulsion for maximum separation
            if (!isConnected) {
              const dx = (nodeB.x || 0) - (nodeA.x || 0);
              const dy = (nodeB.y || 0) - (nodeA.y || 0);
              const distance = Math.sqrt(dx * dx + dy * dy);

              if (distance > 0 && distance < 400) { // Affect unconnected nodes at greater distances
                const force = 80 / (distance * distance); // Much stronger inverse square repulsion
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;

                // Apply stronger force to push unrelated tracks much further apart
                nodeA.vx = (nodeA.vx || 0) - fx;
                nodeA.vy = (nodeA.vy || 0) - fy;
                nodeB.vx = (nodeB.vx || 0) + fx;
                nodeB.vy = (nodeB.vy || 0) + fy;
              }
            }
          });
        });
      })
      .alpha(1.5) // Much higher initial energy for maximum spreading
      .alphaDecay(0.006) // Even slower decay to allow much more time for separation
      .velocityDecay(0.25); // Lower velocity decay for more energetic movement

    simulationRef.current = simulation;

    // Create links with frequency-based visualization
    const routeSet = new Set<string>((pathState.currentPath?.nodes || []));
    const routeNodes = pathState.currentPath?.nodes || [];

    // Helper function to detect if an edge is a bridge connection
    const isBridgeEdge = (edge: any): boolean => {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source;
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target;

      // Find source and target nodes
      const sourceNode = simpleNodes.find(n => n.id === sourceId);
      const targetNode = simpleNodes.find(n => n.id === targetId);

      if (!sourceNode || !targetNode) return false;

      // Get neighbors for both nodes
      const sourceNeighbors = new Set<string>();
      const targetNeighbors = new Set<string>();

      simpleEdges.forEach(e => {
        const edgeSourceId = typeof e.source === 'object' ? e.source.id : e.source;
        const edgeTargetId = typeof e.target === 'object' ? e.target.id : e.target;

        if (edgeSourceId === sourceId) sourceNeighbors.add(edgeTargetId);
        if (edgeTargetId === sourceId) sourceNeighbors.add(edgeSourceId);
        if (edgeSourceId === targetId) targetNeighbors.add(edgeTargetId);
        if (edgeTargetId === targetId) targetNeighbors.add(edgeSourceId);
      });

      // Calculate shared neighbors (indicates same cluster)
      const sharedNeighbors = Array.from(sourceNeighbors).filter(n => targetNeighbors.has(n));
      const totalUniqueNeighbors = new Set([...sourceNeighbors, ...targetNeighbors]).size;
      const sharedRatio = sharedNeighbors.length / Math.max(1, totalUniqueNeighbors);

      // Bridge if they have strong connection but belong to different clusters
      const similarity = edge.similarity || edge.metadata?.similarity || 0;
      return similarity > 0.6 && sharedRatio < 0.3;
    };

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

        // Check if this is a bridge connection - use purple
        if (isBridgeEdge(d)) {
          return '#9333EA'; // Purple for bridge connections
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
      .attr('stroke-dasharray', (d: any) => {
        // Bridge connections get a dashed pattern for visual distinction
        return isBridgeEdge(d) ? '8,4' : 'none';
      })
      .attr('class', (d: any) => {
        // Add class for bridge edges for additional styling if needed
        return isBridgeEdge(d) ? 'bridge-edge' : 'normal-edge';
      });

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
          .attr('font-size', `${edgeLabelSize}px`)
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

    // Edge labels - only shown when heavily zoomed in (1 node visible)
    const edgeLabelGroup = container.append('g').attr('class', 'edge-labels');

    // Function to update edge label visibility based on zoom
    const updateEdgeLabels = () => {
      const visibleCount = getVisibleNodesCount();
      // Show edge labels when zoomed in enough (few nodes visible) rather than exactly 1
      const showEdgeLabels = visibleCount > 0 && visibleCount <= 3;

      // Debug logging
      console.log(`Updating edge labels: visibleCount=${visibleCount}, showEdgeLabels=${showEdgeLabels}, simpleEdges.length=${simpleEdges.length}`);

      edgeLabelGroup.selectAll('*').remove();

      if (showEdgeLabels && simpleEdges.length > 0) {
        // Get current viewport bounds in world coordinates
        const svg = d3.select(svgRef.current);
        const currentTransform = d3.zoomTransform(svg.node()!);

        // Calculate viewport bounds in world coordinates
        const viewportLeft = -currentTransform.x / currentTransform.k;
        const viewportTop = -currentTransform.y / currentTransform.k;
        const viewportRight = (width - currentTransform.x) / currentTransform.k;
        const viewportBottom = (height - currentTransform.y) / currentTransform.k;

        // Add some padding to keep labels comfortably within bounds
        const padding = 100 / currentTransform.k; // Adjust padding based on zoom level
        const boundsLeft = viewportLeft + padding;
        const boundsTop = viewportTop + padding;
        const boundsRight = viewportRight - padding;
        const boundsBottom = viewportBottom - padding;

        // Keep track of used label positions to avoid overlaps
        const usedPositions = [];
        const minDistance = 80 / currentTransform.k; // Minimum distance between labels

        simpleEdges.forEach(edge => {
          const sourceNode = typeof edge.source === 'object' ? edge.source : simpleNodes.find(n => n.id === edge.source);
          const targetNode = typeof edge.target === 'object' ? edge.target : simpleNodes.find(n => n.id === edge.target);

          if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined &&
              targetNode.x !== undefined && targetNode.y !== undefined) {

            // Calculate optimal label position within viewport bounds
            let labelX, labelY;

            // Check if either node is visible in viewport
            const sourceInView = sourceNode.x >= boundsLeft && sourceNode.x <= boundsRight &&
                                sourceNode.y >= boundsTop && sourceNode.y <= boundsBottom;
            const targetInView = targetNode.x >= boundsLeft && targetNode.x <= boundsRight &&
                                targetNode.y >= boundsTop && targetNode.y <= boundsBottom;

            // Skip edges where neither node is visible in the current viewport
            if (!sourceInView && !targetInView) {
              return; // Skip this edge
            }

            if (sourceInView && targetInView) {
              // Both nodes visible - use midpoint
              labelX = (sourceNode.x + targetNode.x) / 2;
              labelY = (sourceNode.y + targetNode.y) / 2;
            } else if (sourceInView) {
              // Only source visible - position label near source but towards target
              const dx = targetNode.x - sourceNode.x;
              const dy = targetNode.y - sourceNode.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const normalizedDx = dx / distance;
              const normalizedDy = dy / distance;

              // Position label 60 units away from source towards target
              const offset = 60 / currentTransform.k;
              labelX = Math.max(boundsLeft, Math.min(boundsRight, sourceNode.x + normalizedDx * offset));
              labelY = Math.max(boundsTop, Math.min(boundsBottom, sourceNode.y + normalizedDy * offset));
            } else if (targetInView) {
              // Only target visible - position label near target but towards source
              const dx = sourceNode.x - targetNode.x;
              const dy = sourceNode.y - targetNode.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const normalizedDx = dx / distance;
              const normalizedDy = dy / distance;

              // Position label 60 units away from target towards source
              const offset = 60 / currentTransform.k;
              labelX = Math.max(boundsLeft, Math.min(boundsRight, targetNode.x + normalizedDx * offset));
              labelY = Math.max(boundsTop, Math.min(boundsBottom, targetNode.y + normalizedDy * offset));
            }

            // Ensure label position is within bounds
            labelX = Math.max(boundsLeft, Math.min(boundsRight, labelX));
            labelY = Math.max(boundsTop, Math.min(boundsBottom, labelY));

            // Avoid overlapping with existing labels
            let attempts = 0;
            const maxAttempts = 20;
            while (attempts < maxAttempts) {
              let collision = false;
              for (const usedPos of usedPositions) {
                const distance = Math.sqrt((labelX - usedPos.x) ** 2 + (labelY - usedPos.y) ** 2);
                if (distance < minDistance) {
                  collision = true;
                  break;
                }
              }

              if (!collision) break;

              // Adjust position in a spiral pattern to avoid overlap
              const angle = (attempts / maxAttempts) * 2 * Math.PI;
              const radius = minDistance * (1 + attempts * 0.1);
              labelX = Math.max(boundsLeft, Math.min(boundsRight, labelX + Math.cos(angle) * radius));
              labelY = Math.max(boundsTop, Math.min(boundsBottom, labelY + Math.sin(angle) * radius));
              attempts++;
            }

            // Record this position
            usedPositions.push({ x: labelX, y: labelY });

            // Get target node info
            const targetNodeData = nodes.find(n => n.id === targetNode.id);
            if (targetNodeData) {
              const title = targetNodeData.title || targetNodeData.label || 'Unknown';
              const artist = targetNodeData.artist || '';

              // Calculate direction arrow towards target node
              const arrowDx = targetNode.x - labelX;
              const arrowDy = targetNode.y - labelY;
              const arrowDistance = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);
              const arrowNormX = arrowDx / arrowDistance;
              const arrowNormY = arrowDy / arrowDistance;

              // Create clickable edge label positioned within viewport
              const labelGroup = edgeLabelGroup.append('g')
                .attr('class', 'edge-label')
                .attr('transform', `translate(${labelX}, ${labelY})`)
                .style('cursor', 'pointer')
                .on('click', function(event) {
                  event.stopPropagation();
                  // Move camera to the target node and select it
                  centerNode(targetNode.id);
                  dispatch(setSelectedNodes([targetNode.id]));
                });

              // Background rectangle for readability
              const bbox = { width: Math.max(title.length, artist.length) * 7, height: artist ? 32 : 16 };
              labelGroup.append('rect')
                .attr('x', -bbox.width / 2)
                .attr('y', -bbox.height / 2)
                .attr('width', bbox.width)
                .attr('height', bbox.height)
                .attr('fill', '#000000')
                .attr('fill-opacity', 0.8)
                .attr('stroke', '#F59E0B')
                .attr('stroke-width', 1)
                .attr('rx', 4)
                .on('mouseenter', function() {
                  d3.select(this)
                    .attr('stroke', '#FCD34D')
                    .attr('stroke-width', 2);
                })
                .on('mouseleave', function() {
                  d3.select(this)
                    .attr('stroke', '#F59E0B')
                    .attr('stroke-width', 1);
                });

              // Track title
              labelGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', artist ? '-0.3em' : '0.3em')
                .attr('font-size', `${edgeLabelSize}px`)
                .attr('font-weight', 'bold')
                .attr('fill', '#FFFFFF')
                .text(title.length > 20 ? title.substring(0, 20) + '...' : title)
                .on('mouseenter', function() {
                  d3.select(this).attr('fill', '#FCD34D');
                })
                .on('mouseleave', function() {
                  d3.select(this).attr('fill', '#FFFFFF');
                });

              // Artist name (if available)
              if (artist) {
                labelGroup.append('text')
                  .attr('text-anchor', 'middle')
                  .attr('dy', '0.8em')
                  .attr('font-size', `${edgeLabelSize - 1}px`)
                  .attr('font-weight', 'normal')
                  .attr('fill', '#CCCCCC')
                  .text(artist.length > 20 ? artist.substring(0, 20) + '...' : artist)
                  .on('mouseenter', function() {
                    d3.select(this).attr('fill', '#FCD34D');
                  })
                  .on('mouseleave', function() {
                    d3.select(this).attr('fill', '#CCCCCC');
                  });
              }

              // Add directional arrow pointing towards target node
              if (arrowDistance > 10) { // Only show arrow if target is far enough away
                const arrowSize = 8;
                const arrowOffset = (bbox.width / 2) + 15; // Position arrow outside the label box

                // Calculate arrow position at the edge of the label
                labelGroup.append('path')
                  .attr('d', `M ${arrowNormX * arrowOffset} ${arrowNormY * arrowOffset}
                             L ${arrowNormX * arrowOffset + arrowNormX * arrowSize - arrowNormY * arrowSize/2} ${arrowNormY * arrowOffset + arrowNormY * arrowSize + arrowNormX * arrowSize/2}
                             L ${arrowNormX * arrowOffset + arrowNormX * arrowSize + arrowNormY * arrowSize/2} ${arrowNormY * arrowOffset + arrowNormY * arrowSize - arrowNormX * arrowSize/2}
                             Z`)
                  .attr('fill', '#F59E0B')
                  .attr('stroke', '#FCD34D')
                  .attr('stroke-width', 1)
                  .on('mouseenter', function() {
                    d3.select(this).attr('fill', '#FCD34D');
                  })
                  .on('mouseleave', function() {
                    d3.select(this).attr('fill', '#F59E0B');
                  });
              }
            }
          }
        });
      }
    };

    // Initial edge label update
    updateEdgeLabels();

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

      // Update edge labels on tick (they need to follow node positions)
      updateEdgeLabels();
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, width, height, getNodeColor, getNodeRadius, getNodeDisplayText, distancePower, relationshipPower]);

  // Add keyboard event listener for escape key
  useEffect(() => {
    const currentHandleKeyDown = (event: KeyboardEvent) => handleKeyDown(event);
    document.addEventListener('keydown', currentHandleKeyDown);
    return () => {
      document.removeEventListener('keydown', currentHandleKeyDown);
    };
  }, [handleKeyDown]);

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
                      setCenteredNodeId(track.id);
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
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="text-sm flex-shrink-0 mt-0.5">{strengthEmoji}</span>
                            <span className="text-white font-medium break-words leading-relaxed group-hover:text-amber-300 transition-colors">
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
                    setCenteredNodeId(connectedNode.id);
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
                      <div className="text-white font-medium break-words leading-relaxed">
                        {connectedNode.title || connectedNode.label}
                      </div>
                      {connectedNode.artist && (
                        <div className="text-gray-400 text-sm break-words leading-relaxed mt-1">
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
