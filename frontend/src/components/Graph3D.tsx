import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph3D, { ForceGraph3DInstance } from 'react-force-graph-3d';
import * as THREE from 'three';
import useStore from '../store/useStore';
import { GraphNode, GraphEdge } from '../types';
import { Eye, Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Graph3D Component
 *
 * 3D force-directed graph visualization using react-force-graph-3d and Three.js
 *
 * FEATURES:
 * - Cylindrical Camelot wheel positioning (X/Y based on key position)
 * - BPM-based vertical positioning (Z-axis)
 * - Energy-based node coloring
 * - Centrality-based node sizing
 * - Weight-based edge thickness
 * - Interactive rotation, zoom, and camera controls
 * - Node selection and highlighting
 * - Smooth animations and transitions
 *
 * COORDINATE SYSTEM:
 * - X/Y: Polar coordinates from Camelot wheel (converted to cartesian)
 * - Z: BPM (height) - normalized to reasonable range
 * - Major keys: Outer cylinder (larger radius)
 * - Minor keys: Inner cylinder (smaller radius)
 *
 * MEMORY MANAGEMENT:
 * - Proper cleanup of Three.js objects
 * - Material and geometry disposal
 * - Ref cleanup on unmount
 */

interface Graph3DProps {
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  className?: string;
}

// Camelot wheel mapping for 3D positioning
const CAMELOT_KEYS = [
  // Major keys (outer ring - 'B' suffix)
  { id: '8B', musical: 'C Major', position: 0, mode: 'major' },
  { id: '9B', musical: 'G Major', position: 1, mode: 'major' },
  { id: '10B', musical: 'D Major', position: 2, mode: 'major' },
  { id: '11B', musical: 'A Major', position: 3, mode: 'major' },
  { id: '12B', musical: 'E Major', position: 4, mode: 'major' },
  { id: '1B', musical: 'B Major', position: 5, mode: 'major' },
  { id: '2B', musical: 'F# Major', position: 6, mode: 'major' },
  { id: '3B', musical: 'C# Major', position: 7, mode: 'major' },
  { id: '4B', musical: 'G# Major', position: 8, mode: 'major' },
  { id: '5B', musical: 'D# Major', position: 9, mode: 'major' },
  { id: '6B', musical: 'A# Major', position: 10, mode: 'major' },
  { id: '7B', musical: 'F Major', position: 11, mode: 'major' },
  // Minor keys (inner ring - 'A' suffix)
  { id: '8A', musical: 'A Minor', position: 0, mode: 'minor' },
  { id: '9A', musical: 'E Minor', position: 1, mode: 'minor' },
  { id: '10A', musical: 'B Minor', position: 2, mode: 'minor' },
  { id: '11A', musical: 'F# Minor', position: 3, mode: 'minor' },
  { id: '12A', musical: 'C# Minor', position: 4, mode: 'minor' },
  { id: '1A', musical: 'G# Minor', position: 5, mode: 'minor' },
  { id: '2A', musical: 'D# Minor', position: 6, mode: 'minor' },
  { id: '3A', musical: 'A# Minor', position: 7, mode: 'minor' },
  { id: '4A', musical: 'F Minor', position: 8, mode: 'minor' },
  { id: '5A', musical: 'C Minor', position: 9, mode: 'minor' },
  { id: '6A', musical: 'G Minor', position: 10, mode: 'minor' },
  { id: '7A', musical: 'D Minor', position: 11, mode: 'minor' },
] as const;

// Energy to color mapping (0-1 normalized energy)
const getEnergyColor = (energy: number): string => {
  // Gradient from blue (low energy) -> green -> yellow -> red (high energy)
  if (energy < 0.25) return `rgb(${Math.round(energy * 4 * 100 + 100)}, ${Math.round(energy * 4 * 150)}, 255)`;
  if (energy < 0.5) return `rgb(100, ${Math.round(energy * 4 * 255)}, ${Math.round((1 - energy * 2) * 255)})`;
  if (energy < 0.75) return `rgb(${Math.round((energy - 0.5) * 4 * 255)}, 255, 0)`;
  return `rgb(255, ${Math.round((1 - energy) * 4 * 255)}, 0)`;
};

export const Graph3D: React.FC<Graph3DProps> = ({
  width = 800,
  height = 600,
  onNodeClick,
  onNodeHover,
  className = '',
}) => {
  const fgRef = useRef<ForceGraph3DInstance>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Store state
  const graphData = useStore(state => state.graphData);
  const selectedNodes = useStore(state => state.viewState.selectedNodes);
  const hoveredNode = useStore(state => state.viewState.hoveredNode);
  const selectNode = useStore(state => state.graph.selectNode);
  const setHoveredNode = useStore(state => state.graph.setHoveredNode);

  // Local state
  const [cameraDistance, setCameraDistance] = useState(300);
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());

  /**
   * Convert musical key to Camelot notation
   * Handles various formats: "C Major", "Am", "C#m", "Db", etc.
   */
  const musicalKeyToCamelot = useCallback((key: string): string | null => {
    if (!key || typeof key !== 'string') return null;

    const normalized = key.trim().toLowerCase();

    // Already in Camelot format
    if (normalized.match(/^\d+[ab]$/i)) return key.toUpperCase();

    // Extract note and mode
    let note = '';
    let mode: 'major' | 'minor' | null = null;

    const patterns = [
      /^([a-g][#b]?)\s*(major|minor|maj|min)/i,
      /^([a-g][#b]?)m$/i,
      /^([a-g][#b]?)$/i,
    ];

    let match = null;
    for (const pattern of patterns) {
      match = normalized.match(pattern);
      if (match) break;
    }

    if (!match) return null;

    note = match[1].toUpperCase();
    if (match[2]) {
      mode = match[2].toLowerCase().startsWith('maj') ? 'major' : 'minor';
    } else if (normalized.endsWith('m')) {
      mode = 'minor';
    } else {
      mode = 'major';
    }

    // Normalize enharmonic equivalents
    const noteMap: Record<string, string> = {
      'C': 'C', 'C#': 'C#', 'DB': 'C#',
      'D': 'D', 'D#': 'D#', 'EB': 'D#',
      'E': 'E', 'F': 'F',
      'F#': 'F#', 'GB': 'F#',
      'G': 'G', 'G#': 'G#', 'AB': 'G#',
      'A': 'A', 'A#': 'A#', 'BB': 'A#',
      'B': 'B', 'CB': 'B',
    };

    const canonicalNote = noteMap[note];
    if (!canonicalNote) return null;

    const majorMap: Record<string, string> = {
      'C': '8B', 'C#': '3B', 'D': '10B', 'D#': '5B', 'E': '12B', 'F': '7B',
      'F#': '2B', 'G': '9B', 'G#': '4B', 'A': '11B', 'A#': '6B', 'B': '1B',
    };

    const minorMap: Record<string, string> = {
      'A': '8A', 'A#': '3A', 'B': '10A', 'C': '5A', 'C#': '12A', 'D': '7A',
      'D#': '2A', 'E': '9A', 'F': '4A', 'F#': '11A', 'G': '6A', 'G#': '1A',
    };

    return mode === 'major' ? majorMap[canonicalNote] : minorMap[canonicalNote];
  }, []);

  /**
   * Get Camelot key from node
   */
  const getNodeKey = useCallback((node: GraphNode): string | null => {
    const key = node.key || node.metadata?.key || node.track?.key || node.track?.camelotKey;
    if (!key) return null;

    // Already Camelot
    if (key.match(/^\d+[AB]$/i)) return key.toUpperCase();

    return musicalKeyToCamelot(key);
  }, [musicalKeyToCamelot]);

  /**
   * Calculate 3D position based on Camelot key and BPM
   * Returns cylindrical coordinates converted to cartesian
   */
  const calculate3DPosition = useCallback((node: GraphNode) => {
    const camelotKey = getNodeKey(node);
    const bpm = node.bpm || node.track?.bpm || 120;

    // Find key data
    const keyData = CAMELOT_KEYS.find(k => k.id === camelotKey);

    if (keyData) {
      // Cylindrical coordinates
      const angle = (keyData.position / 12) * Math.PI * 2;
      const radius = keyData.mode === 'major' ? 100 : 60; // Outer/inner cylinder

      // Convert to cartesian
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Z = BPM (normalized to reasonable height range)
      // Typical BPM range: 60-180
      const minBpm = 60;
      const maxBpm = 180;
      const normalizedBpm = (bpm - minBpm) / (maxBpm - minBpm);
      const z = (normalizedBpm * 200) - 100; // -100 to +100 range

      return { x, y, z };
    }

    // Fallback: random position if no key
    const angle = Math.random() * Math.PI * 2;
    const radius = 80;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: ((bpm - 120) / 60) * 100, // Centered around 120 BPM
    };
  }, [getNodeKey]);

  /**
   * Enhanced graph data with 3D positions
   */
  const enhancedGraphData = useMemo(() => {
    const nodesWithPositions = graphData.nodes.map(node => {
      const pos3d = calculate3DPosition(node);
      return {
        ...node,
        ...pos3d,
        // Store original 2D position for reference
        x2d: node.x,
        y2d: node.y,
      };
    });

    return {
      nodes: nodesWithPositions,
      links: graphData.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
        color: edge.color,
      })),
    };
  }, [graphData, calculate3DPosition]);

  /**
   * Node color based on energy
   */
  const nodeColor = useCallback((node: any) => {
    if (selectedNodes.has(node.id)) return '#ff6b35'; // Selected
    if (hoveredNode === node.id) return '#7ed321'; // Hovered

    const energy = node.energy || node.track?.energy || 0.5;
    return getEnergyColor(energy);
  }, [selectedNodes, hoveredNode]);

  /**
   * Node size based on centrality/connections
   */
  const nodeSize = useCallback((node: any) => {
    const degree = node.degree || node.connections || 1;
    return Math.max(2, Math.min(8, Math.log(degree + 1) * 2));
  }, []);

  /**
   * Link width based on weight
   */
  const linkWidth = useCallback((link: any) => {
    return Math.max(0.5, Math.min(3, link.weight || 1));
  }, []);

  /**
   * Link color with transparency
   */
  const linkColor = useCallback((link: any) => {
    if (highlightLinks.has(`${link.source.id}-${link.target.id}`)) {
      return 'rgba(255, 107, 53, 0.8)'; // Highlighted
    }
    return link.color || 'rgba(142, 142, 147, 0.3)';
  }, [highlightLinks]);

  /**
   * Node label (shown on hover)
   */
  const nodeLabel = useCallback((node: any) => {
    const key = getNodeKey(node);
    const bpm = node.bpm || node.track?.bpm || 'N/A';
    const energy = node.energy || node.track?.energy || 'N/A';

    return `
      <div style="background: rgba(0,0,0,0.9); padding: 8px; border-radius: 4px; color: white;">
        <strong>${node.label || node.name || 'Unknown'}</strong><br/>
        ${node.artist || ''}<br/>
        Key: ${key || 'N/A'} | BPM: ${bpm}<br/>
        Energy: ${typeof energy === 'number' ? energy.toFixed(2) : energy}
      </div>
    `;
  }, [getNodeKey]);

  /**
   * Handle node click
   */
  const handleNodeClick = useCallback((node: any) => {
    selectNode(node.id);

    if (onNodeClick) {
      onNodeClick(node as GraphNode);
    }

    // Highlight connected nodes
    const connectedNodeIds = new Set<string>();
    const connectedLinks = new Set<string>();

    enhancedGraphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (sourceId === node.id) {
        connectedNodeIds.add(targetId);
        connectedLinks.add(`${sourceId}-${targetId}`);
      }
      if (targetId === node.id) {
        connectedNodeIds.add(sourceId);
        connectedLinks.add(`${sourceId}-${targetId}`);
      }
    });

    setHighlightNodes(connectedNodeIds);
    setHighlightLinks(connectedLinks);
  }, [selectNode, onNodeClick, enhancedGraphData.links]);

  /**
   * Handle node hover
   */
  const handleNodeHover = useCallback((node: any | null) => {
    setHoveredNode(node ? node.id : null);

    if (onNodeHover) {
      onNodeHover(node as GraphNode | null);
    }
  }, [setHoveredNode, onNodeHover]);

  /**
   * Camera controls
   */
  const handleZoomIn = useCallback(() => {
    setCameraDistance(prev => Math.max(100, prev - 50));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCameraDistance(prev => Math.min(1000, prev + 50));
  }, []);

  const handleResetCamera = useCallback(() => {
    setCameraDistance(300);
    if (fgRef.current) {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
    }
  }, []);

  const handleFitView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(1000, 50);
    }
  }, []);

  /**
   * Apply camera distance on change
   */
  useEffect(() => {
    if (fgRef.current) {
      const camera = fgRef.current.camera();
      camera.position.z = cameraDistance;
    }
  }, [cameraDistance]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Cleanup Three.js resources
      if (fgRef.current) {
        const scene = fgRef.current.scene();
        scene.traverse((object: any) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ width, height }}>
      {/* 3D Graph */}
      <ForceGraph3D
        ref={fgRef}
        graphData={enhancedGraphData}
        width={width}
        height={height}
        backgroundColor="#0a0a0f"
        nodeLabel={nodeLabel}
        nodeColor={nodeColor}
        nodeVal={nodeSize}
        nodeRelSize={4}
        linkWidth={linkWidth}
        linkColor={linkColor}
        linkOpacity={0.6}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        cooldownTicks={100}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      {/* Camera Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title="Zoom In"
        >
          <ZoomIn size={20} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title="Zoom Out"
        >
          <ZoomOut size={20} />
        </button>
        <button
          onClick={handleFitView}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title="Fit to View"
        >
          <Maximize2 size={20} />
        </button>
        <button
          onClick={handleResetCamera}
          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors"
          title="Reset Camera"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Info Overlay */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-xs">
        <div className="font-semibold mb-1">3D Graph Controls</div>
        <div>Left Click + Drag: Rotate</div>
        <div>Right Click + Drag: Pan</div>
        <div>Scroll: Zoom</div>
        <div>Click Node: Select</div>
        <div className="mt-2 text-white/60">
          Nodes: {enhancedGraphData.nodes.length} | Links: {enhancedGraphData.links.length}
        </div>
      </div>
    </div>
  );
};

export default Graph3D;
