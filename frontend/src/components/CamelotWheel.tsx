import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { arc } from 'd3-shape';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, Track, CamelotKey } from '../types';
import { CAMELOT_KEYS } from '../utils/camelotData';
import { colors } from '../lib/tokens';
import {
  Settings,
  Play,
  Shuffle,
  Target,
  Eye,
  EyeOff,
  Zap,
  Music,
  TrendingUp,
  Filter,
  RotateCcw
} from 'lucide-react';

interface TrackConnection {
  sourceKey: string;
  targetKey: string;
  weight: number;
  isPlaylistEdge: boolean; // True if from existing graph edges
  isHarmonicSuggestion: boolean; // True if harmonic compatibility
  trackPairs: Array<{
    source: GraphNode;
    target: GraphNode;
    edge?: GraphEdge;
  }>;
}

interface CamelotWheelProps {
  size?: number;
  showMoodLabels?: boolean;
  showEnergyGradient?: boolean;
  showHarmonicSuggestions?: boolean;
  onKeySelect?: (keys: string[]) => void;
  onTrackSelect?: (track: Track) => void;
  onPlanTransition?: (fromKey: string, toKey: string) => void;
  className?: string;
}

export const CamelotWheel: React.FC<CamelotWheelProps> = ({
  size = 300,
  showMoodLabels: showMoodLabelsProp = true,
  showEnergyGradient: showEnergyGradientProp = false,
  showHarmonicSuggestions = false,
  onKeySelect,
  onTrackSelect,
  onPlanTransition,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoodLabels, setShowMoodLabels] = useState(showMoodLabelsProp);
  const [showEnergyGradient, setShowEnergyGradient] = useState(showEnergyGradientProp);

  // Store data
  const graphData = useStore(state => state.graphData);
  const selectedNodes = useStore(state => state.viewState.selectedNodes);
  const selectNode = useStore(state => state.graph.selectNode);
  const applyFilters = useStore(state => state.search.applyFilters);

  // Camelot wheel data from official design system harmonic mapping
  const camelotKeys: CamelotKey[] = useMemo(() => CAMELOT_KEYS, []);

  /**
   * Converts musical key notation to Camelot notation
   *
   * @param key - Musical key string (e.g., "C Major", "A Minor", "C# Maj", "Db", etc.)
   * @returns Camelot notation (e.g., "8B", "8A") or null if invalid
   *
   * Standard Camelot Wheel Mapping (Industry Standard):
   * Major keys (B suffix): 8B=C, 3B=C#/Db, 10B=D, 5B=D#/Eb, 12B=E, 7B=F, 2B=F#/Gb, 9B=G, 4B=G#/Ab, 11B=A, 6B=A#/Bb, 1B=B
   * Minor keys (A suffix): 8A=Am, 3A=A#m/Bbm, 10A=Bm, 5A=Cm, 12A=C#m, 7A=Dm, 2A=D#m/Ebm, 9A=Em, 4A=Fm, 11A=F#m, 6A=Gm, 1A=G#m
   *
   * Supports multiple input formats:
   * - Full notation: "C Major", "A Minor", "Db major"
   * - Abbreviated: "C Maj", "A min"
   * - Short form: "Cm", "Am", "C#m" (note + 'm' for minor)
   * - Note only: "C", "Db" (assumes major if mode not specified)
   * - Case insensitive, handles extra whitespace
   * - Normalizes enharmonic equivalents (Db = C#, Eb = D#, etc.)
   */
  const musicalKeyToCamelot = useCallback((key: string): string | null => {
    if (!key || typeof key !== 'string') return null;

    // Normalize: trim, lowercase for pattern matching
    const normalized = key.trim().toLowerCase();

    // Extract note and mode
    let note = '';
    let mode: 'major' | 'minor' | null = null;

    // Match patterns like "C Major", "C# Minor", "Db Maj", "C", "Am", "C#m"
    const patterns = [
      // Full notation: "C Major", "C# Minor", "Db major"
      /^([a-g][#b]?)\s*(major|minor|maj|min)/i,
      // Short notation with mode suffix: "Cm", "C#m", "Dbm" (minor)
      /^([a-g][#b]?)m$/i,
      // Just note: "C", "C#", "Db" (assume major)
      /^([a-g][#b]?)$/i
    ];

    let match = null;
    for (const pattern of patterns) {
      match = normalized.match(pattern);
      if (match) break;
    }

    if (!match) return null;

    // Extract note (first capture group)
    note = match[1].toUpperCase();

    // Determine mode
    if (match[2]) {
      // Full notation with explicit mode
      mode = match[2].toLowerCase().startsWith('maj') ? 'major' : 'minor';
    } else if (normalized.endsWith('m')) {
      // Short notation with 'm' suffix (e.g., "Cm", "Am")
      mode = 'minor';
    } else {
      // No mode specified, assume major
      mode = 'major';
    }

    // Normalize sharp/flat equivalents to sharp for consistency
    const noteMap: Record<string, string> = {
      'C': 'C',
      'C#': 'C#', 'DB': 'C#',
      'D': 'D',
      'D#': 'D#', 'EB': 'D#',
      'E': 'E',
      'F': 'F',
      'F#': 'F#', 'GB': 'F#',
      'G': 'G',
      'G#': 'G#', 'AB': 'G#',
      'A': 'A',
      'A#': 'A#', 'BB': 'A#',
      'B': 'B', 'CB': 'B'
    };

    const canonicalNote = noteMap[note];
    if (!canonicalNote) return null;

    // Camelot wheel mapping (industry standard)
    // Major keys use 'B' suffix (8B = C Major)
    // Minor keys use 'A' suffix (8A = A Minor)
    const majorMap: Record<string, string> = {
      'C': '8B',
      'C#': '3B',
      'D': '10B',
      'D#': '5B',
      'E': '12B',
      'F': '7B',
      'F#': '2B',
      'G': '9B',
      'G#': '4B',
      'A': '11B',
      'A#': '6B',
      'B': '1B'
    };

    const minorMap: Record<string, string> = {
      'A': '8A',
      'A#': '3A',
      'B': '10A',
      'C': '5A',
      'C#': '12A',
      'D': '7A',
      'D#': '2A',
      'E': '9A',
      'F': '4A',
      'F#': '11A',
      'G': '6A',
      'G#': '1A'
    };

    if (mode === 'major') {
      return majorMap[canonicalNote] || null;
    } else {
      return minorMap[canonicalNote] || null;
    }
  }, []);

  // Get track key from various sources
  const getTrackKey = useCallback((node: GraphNode): string | null => {
    // Try multiple key sources
    const key = node.key ||
                node.metadata?.key ||
                node.metadata?.camelot_key ||
                node.metadata?.musical_key ||
                node.track?.key ||
                node.track?.camelotKey;

    if (!key) return null;

    // Convert various key formats to Camelot
    if (key.match(/^\d+[AB]$/)) return key; // Already Camelot format
    if (key.match(/^\d+[dm]$/)) {
      // Convert Open Key to Camelot
      const num = parseInt(key);
      const mode = key.slice(-1);
      return mode === 'd' ? `${((num + 7) % 12) + 1}A` : `${((num + 7) % 12) + 1}B`;
    }

    // Convert musical key to Camelot (C Major -> 8B, A Minor -> 8A, etc.)
    return musicalKeyToCamelot(key);
  }, [musicalKeyToCamelot]);

  // Analyze tracks by key
  const tracksByKey = useMemo(() => {
    const result: Record<string, GraphNode[]> = {};

    (graphData.nodes || []).forEach(node => {
      const key = getTrackKey(node);
      if (key) {
        if (!result[key]) result[key] = [];
        result[key].push(node);
      }
    });

    return result;
  }, [graphData.nodes, getTrackKey]);

  // Analyze track connections - prioritize playlist edges over harmonic suggestions
  const trackConnections = useMemo(() => {
    const connections: TrackConnection[] = [];
    const connectionMap = new Map<string, TrackConnection>();

    // PRIORITY 1: Existing playlist edges (proven DJ transitions)
    (graphData.edges || []).forEach(edge => {
      const sourceNode = (graphData.nodes || []).find(n => n.id === edge.source);
      const targetNode = (graphData.nodes || []).find(n => n.id === edge.target);

      if (sourceNode && targetNode) {
        const sourceKey = getTrackKey(sourceNode);
        const targetKey = getTrackKey(targetNode);

        if (sourceKey && targetKey) {
          const connectionId = `${sourceKey}-${targetKey}`;

          if (!connectionMap.has(connectionId)) {
            connectionMap.set(connectionId, {
              sourceKey,
              targetKey,
              weight: 0,
              isPlaylistEdge: true,
              isHarmonicSuggestion: false,
              trackPairs: []
            });
          }

          const connection = connectionMap.get(connectionId)!;
          connection.weight += edge.weight || 1;
          connection.trackPairs.push({
            source: sourceNode,
            target: targetNode,
            edge
          });
        }
      }
    });

    // PRIORITY 2: Harmonic suggestions (only if enabled and no playlist connection exists)
    if (showHarmonicSuggestions) {
      Object.entries(tracksByKey).forEach(([sourceKey, sourceTracks]) => {
        const keyData = camelotKeys.find(k => k.id === sourceKey);
        if (keyData) {
          keyData.compatible.forEach(targetKey => {
            const connectionId = `${sourceKey}-${targetKey}`;

            // Only add harmonic suggestion if no playlist edge exists
            if (!connectionMap.has(connectionId) && tracksByKey[targetKey]) {
              connectionMap.set(connectionId, {
                sourceKey,
                targetKey,
                weight: sourceTracks.length * tracksByKey[targetKey].length,
                isPlaylistEdge: false,
                isHarmonicSuggestion: true,
                trackPairs: []
              });
            }
          });
        }
      });
    }

    return Array.from(connectionMap.values());
  }, [graphData.edges, graphData.nodes, tracksByKey, camelotKeys, getTrackKey, showHarmonicSuggestions]);

  // Handle key selection
  const handleKeyClick = useCallback((key: string) => {
    setSelectedKeys(prev => {
      const newSelection = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];

      if (onKeySelect) {
        onKeySelect(newSelection);
      }

      // Filter graph nodes by selected keys
      if (newSelection.length > 0) {
        const selectedTracks = newSelection.flatMap(k => tracksByKey[k] || []);
        const nodeIds = selectedTracks.map(t => t.id);

        // Update graph selection
        nodeIds.forEach(id => selectNode(id));
      }

      return newSelection;
    });
  }, [onKeySelect, tracksByKey, selectNode]);

  // Handle key hover for compatibility highlighting
  const handleKeyHover = useCallback((key: string | null) => {
    setHoveredKey(key);
  }, []);

  // Get compatible keys for highlighting
  const getCompatibleKeys = useCallback((key: string): string[] => {
    const keyData = camelotKeys.find(k => k.id === key);
    return keyData ? keyData.compatible : [];
  }, [camelotKeys]);

  // Render the wheel using D3
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size * 0.4;
    const innerRadius = size * 0.25;
    const minorRadius = size * 0.15;

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // Create arcs for each key
    const majorArc = arc<CamelotKey>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(d => (d.position * 30 - 15) * Math.PI / 180)
      .endAngle(d => (d.position * 30 + 15) * Math.PI / 180);

    const minorArc = arc<CamelotKey>()
      .innerRadius(0)
      .outerRadius(minorRadius)
      .startAngle(d => (d.position * 30 - 15) * Math.PI / 180)
      .endAngle(d => (d.position * 30 + 15) * Math.PI / 180);

    // Draw connection lines (playlist edges vs harmonic suggestions)
    const connectionsGroup = g.append('g').attr('class', 'connections');

    trackConnections.forEach(connection => {
      const sourceKey = camelotKeys.find(k => k.id === connection.sourceKey);
      const targetKey = camelotKeys.find(k => k.id === connection.targetKey);

      if (sourceKey && targetKey) {
        const sourceAngle = sourceKey.position * 30 * Math.PI / 180;
        const targetAngle = targetKey.position * 30 * Math.PI / 180;

        const sourceRadius = sourceKey.mode === 'major' ? (outerRadius + innerRadius) / 2 : minorRadius / 2;
        const targetRadius = targetKey.mode === 'major' ? (outerRadius + innerRadius) / 2 : minorRadius / 2;

        const x1 = Math.sin(sourceAngle) * sourceRadius;
        const y1 = -Math.cos(sourceAngle) * sourceRadius;
        const x2 = Math.sin(targetAngle) * targetRadius;
        const y2 = -Math.cos(targetAngle) * targetRadius;

        connectionsGroup.append('line')
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke', connection.isPlaylistEdge ? colors['brand-primary'] : colors['border-strong'])
          .attr('stroke-width', connection.isPlaylistEdge ? Math.min(connection.weight / 2, 4) : 1)
          .attr('stroke-opacity', connection.isPlaylistEdge ? 0.8 : 0.3)
          .attr('stroke-dasharray', connection.isPlaylistEdge ? '0' : '3,3')
          .style('pointer-events', 'none');
      }
    });

    // Draw major keys (outer ring)
    const majorKeys = camelotKeys.filter(k => k.mode === 'major');
    const majorGroup = g.append('g').attr('class', 'major-keys');

    majorGroup.selectAll('.major-segment')
      .data(majorKeys)
      .join('g')
      .attr('class', 'major-segment')
      .each(function(d) {
        const group = select(this);
        const isSelected = selectedKeys.includes(d.id);
        const isCompatible = hoveredKey && getCompatibleKeys(hoveredKey).includes(d.id);
        const trackCount = tracksByKey[d.id]?.length || 0;

        // Arc background
        group.append('path')
          .attr('d', majorArc(d))
          .attr('fill', showEnergyGradient ? d.energyColor : d.color)
          .attr('stroke', '#1f2937')
          .attr('stroke-width', 2)
          .attr('opacity', isSelected ? 1 : isCompatible ? 0.8 : 0.6)
          .style('cursor', 'pointer');

        // Track count indicator
        if (trackCount > 0) {
          const angle = d.position * 30 * Math.PI / 180;
          const radius = (outerRadius + innerRadius) / 2;
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;

          group.append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', Math.min(4 + Math.log(trackCount) * 2, 12))
            .attr('fill', '#fff')
            .attr('opacity', 0.9);

          group.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .attr('fill', '#1f2937')
            .text(trackCount);
        }

        // Key label
        const labelAngle = d.position * 30 * Math.PI / 180;
        const labelRadius = outerRadius + 20;
        const labelX = Math.sin(labelAngle) * labelRadius;
        const labelY = -Math.cos(labelAngle) * labelRadius;

        group.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .attr('fill', '#fff')
          .text(d.id);
      })
      .on('click', (event, d) => handleKeyClick(d.id))
      .on('mouseover', (event, d) => handleKeyHover(d.id))
      .on('mouseout', () => handleKeyHover(null));

    // Draw minor keys (inner ring)
    const minorKeys = camelotKeys.filter(k => k.mode === 'minor');
    const minorGroup = g.append('g').attr('class', 'minor-keys');

    minorGroup.selectAll('.minor-segment')
      .data(minorKeys)
      .join('g')
      .attr('class', 'minor-segment')
      .each(function(d) {
        const group = select(this);
        const isSelected = selectedKeys.includes(d.id);
        const isCompatible = hoveredKey && getCompatibleKeys(hoveredKey).includes(d.id);
        const trackCount = tracksByKey[d.id]?.length || 0;

        // Arc background
        group.append('path')
          .attr('d', minorArc(d))
          .attr('fill', showEnergyGradient ? d.energyColor : d.color)
          .attr('stroke', '#1f2937')
          .attr('stroke-width', 2)
          .attr('opacity', isSelected ? 1 : isCompatible ? 0.8 : 0.6)
          .style('cursor', 'pointer');

        // Track count indicator
        if (trackCount > 0) {
          const angle = d.position * 30 * Math.PI / 180;
          const radius = minorRadius / 2;
          const x = Math.sin(angle) * radius;
          const y = -Math.cos(angle) * radius;

          group.append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', Math.min(3 + Math.log(trackCount), 8))
            .attr('fill', '#fff')
            .attr('opacity', 0.9);

          group.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', '8px')
            .attr('font-weight', 'bold')
            .attr('fill', '#1f2937')
            .text(trackCount);
        }

        // Key label
        const labelAngle = d.position * 30 * Math.PI / 180;
        const labelRadius = minorRadius + 15;
        const labelX = Math.sin(labelAngle) * labelRadius;
        const labelY = -Math.cos(labelAngle) * labelRadius;

        group.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', '10px')
          .attr('font-weight', '600')
          .attr('fill', '#fff')
          .text(d.id);
      })
      .on('click', (event, d) => handleKeyClick(d.id))
      .on('mouseover', (event, d) => handleKeyHover(d.id))
      .on('mouseout', () => handleKeyHover(null));

    // Center text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', '#fff')
      .text('KEYS');

  }, [
    size,
    camelotKeys,
    tracksByKey,
    trackConnections,
    selectedKeys,
    hoveredKey,
    showEnergyGradient,
    handleKeyClick,
    handleKeyHover,
    getCompatibleKeys
  ]);

  return (
    <div className={`camelot-wheel ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Music size={20} />
          Camelot Wheel
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Wheel settings"
          >
            <Settings size={16} />
          </button>

          <button
            onClick={() => setSelectedKeys([])}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Clear selection"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={showEnergyGradient}
                onChange={(e) => setShowEnergyGradient(e.target.checked)}
                className="rounded"
              />
              <Zap size={14} />
              Energy colors
            </label>

            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={showMoodLabels}
                onChange={(e) => setShowMoodLabels(e.target.checked)}
                className="rounded"
              />
              <TrendingUp size={14} />
              Mood labels
            </label>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="text-xs text-white/80 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500"></div>
            <span>Playlist connections (proven transitions)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-gray-500 border-dashed border-t"></div>
            <span>Harmonic suggestions</span>
          </div>
        </div>
      </div>

      {/* Main wheel */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={size}
          height={size}
          className="overflow-visible"
        />
      </div>

      {/* Key info panel */}
      {hoveredKey && (
        <div className="mt-4 p-3 bg-white/10 rounded-lg border border-white/10">
          {(() => {
            const keyData = camelotKeys.find(k => k.id === hoveredKey);
            const tracks = tracksByKey[hoveredKey] || [];

            return keyData ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-white">{keyData.id}</span>
                  <span className="text-white/70">{keyData.musical}</span>
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{ backgroundColor: keyData.color + '40', color: keyData.color }}
                  >
                    {keyData.mood}
                  </span>
                </div>

                <div className="text-sm text-white/80">
                  <div>Energy: {keyData.energy}/10</div>
                  <div>Tracks: {tracks.length}</div>
                  <div>Compatible: {keyData.compatible.join(', ')}</div>
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Selected keys summary */}
      {selectedKeys.length > 0 && (
        <div className="mt-4 p-3 bg-blue-500/20 rounded-lg border border-blue-500/30">
          <div className="text-sm text-white">
            <div className="font-semibold mb-1">Selected Keys</div>
            <div className="flex flex-wrap gap-2">
              {selectedKeys.map(key => {
                const keyData = camelotKeys.find(k => k.id === key);
                const trackCount = tracksByKey[key]?.length || 0;

                return (
                  <span
                    key={key}
                    className="px-2 py-1 bg-white/20 rounded text-xs flex items-center gap-1"
                  >
                    {key} ({trackCount})
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};