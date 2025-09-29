import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { arc } from 'd3-shape';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, Track } from '../types';
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

interface CamelotKey {
  id: string;           // '1A', '2B', etc.
  musical: string;      // 'C Major', 'A Minor', etc.
  openKey: string;      // '1d', '2m', etc. (alternative notation)
  position: number;     // 0-11 around circle
  mode: 'major' | 'minor';
  energy: number;       // 1-10 energy level
  mood: string;         // 'uplifting', 'melancholic', etc.
  color: string;        // Base color
  energyColor: string;  // Energy-based color
  compatible: string[]; // Adjacent and opposite keys for harmonic mixing
}

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
  showMoodLabels = true,
  showEnergyGradient = false,
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

  // Store data
  const graphData = useStore(state => state.graphData);
  const selectedNodes = useStore(state => state.viewState.selectedNodes);
  const selectNode = useStore(state => state.graph.selectNode);
  const applyFilters = useStore(state => state.search.applyFilters);

  // Camelot wheel data - industry standard mapping
  const camelotKeys: CamelotKey[] = useMemo(() => [
    // Major keys (outer ring)
    { id: '1A', musical: 'C Major', openKey: '8d', position: 0, mode: 'major', energy: 6, mood: 'uplifting', color: '#3b82f6', energyColor: '#60a5fa', compatible: ['12A', '2A', '1B'] },
    { id: '2A', musical: 'G Major', openKey: '9d', position: 1, mode: 'major', energy: 8, mood: 'bright', color: '#10b981', energyColor: '#34d399', compatible: ['1A', '3A', '2B'] },
    { id: '3A', musical: 'D Major', openKey: '10d', position: 2, mode: 'major', energy: 9, mood: 'energetic', color: '#f59e0b', energyColor: '#fbbf24', compatible: ['2A', '4A', '3B'] },
    { id: '4A', musical: 'A Major', openKey: '11d', position: 3, mode: 'major', energy: 8, mood: 'triumphant', color: '#f97316', energyColor: '#fb923c', compatible: ['3A', '5A', '4B'] },
    { id: '5A', musical: 'E Major', openKey: '12d', position: 4, mode: 'major', energy: 9, mood: 'powerful', color: '#ef4444', energyColor: '#f87171', compatible: ['4A', '6A', '5B'] },
    { id: '6A', musical: 'B Major', openKey: '1d', position: 5, mode: 'major', energy: 7, mood: 'intense', color: '#ec4899', energyColor: '#f472b6', compatible: ['5A', '7A', '6B'] },
    { id: '7A', musical: 'F# Major', openKey: '2d', position: 6, mode: 'major', energy: 8, mood: 'driving', color: '#a855f7', energyColor: '#c084fc', compatible: ['6A', '8A', '7B'] },
    { id: '8A', musical: 'C# Major', openKey: '3d', position: 7, mode: 'major', energy: 6, mood: 'ethereal', color: '#8b5cf6', energyColor: '#a78bfa', compatible: ['7A', '9A', '8B'] },
    { id: '9A', musical: 'G# Major', openKey: '4d', position: 8, mode: 'major', energy: 7, mood: 'mysterious', color: '#6366f1', energyColor: '#818cf8', compatible: ['8A', '10A', '9B'] },
    { id: '10A', musical: 'D# Major', openKey: '5d', position: 9, mode: 'major', energy: 8, mood: 'exotic', color: '#06b6d4', energyColor: '#22d3ee', compatible: ['9A', '11A', '10B'] },
    { id: '11A', musical: 'A# Major', openKey: '6d', position: 10, mode: 'major', energy: 9, mood: 'bold', color: '#0891b2', energyColor: '#0ea5e9', compatible: ['10A', '12A', '11B'] },
    { id: '12A', musical: 'F Major', openKey: '7d', position: 11, mode: 'major', energy: 5, mood: 'warm', color: '#059669', energyColor: '#10b981', compatible: ['11A', '1A', '12B'] },

    // Minor keys (inner ring)
    { id: '1B', musical: 'A Minor', openKey: '8m', position: 0, mode: 'minor', energy: 4, mood: 'melancholic', color: '#374151', energyColor: '#6b7280', compatible: ['12B', '2B', '1A'] },
    { id: '2B', musical: 'E Minor', openKey: '9m', position: 1, mode: 'minor', energy: 6, mood: 'contemplative', color: '#475569', energyColor: '#64748b', compatible: ['1B', '3B', '2A'] },
    { id: '3B', musical: 'B Minor', openKey: '10m', position: 2, mode: 'minor', energy: 7, mood: 'dramatic', color: '#581c87', energyColor: '#7c3aed', compatible: ['2B', '4B', '3A'] },
    { id: '4B', musical: 'F# Minor', openKey: '11m', position: 3, mode: 'minor', energy: 6, mood: 'introspective', color: '#7c2d12', energyColor: '#dc2626', compatible: ['3B', '5B', '4A'] },
    { id: '5B', musical: 'C# Minor', openKey: '12m', position: 4, mode: 'minor', energy: 7, mood: 'passionate', color: '#92400e', energyColor: '#ea580c', compatible: ['4B', '6B', '5A'] },
    { id: '6B', musical: 'G# Minor', openKey: '1m', position: 5, mode: 'minor', energy: 5, mood: 'haunting', color: '#991b1b', energyColor: '#dc2626', compatible: ['5B', '7B', '6A'] },
    { id: '7B', musical: 'D# Minor', openKey: '2m', position: 6, mode: 'minor', energy: 6, mood: 'dark', color: '#be185d', energyColor: '#ec4899', compatible: ['6B', '8B', '7A'] },
    { id: '8B', musical: 'A# Minor', openKey: '3m', position: 7, mode: 'minor', energy: 4, mood: 'mysterious', color: '#7c3aed', energyColor: '#a855f7', compatible: ['7B', '9B', '8A'] },
    { id: '9B', musical: 'E# Minor', openKey: '4m', position: 8, mode: 'minor', energy: 5, mood: 'ethereal', color: '#4338ca', energyColor: '#6366f1', compatible: ['8B', '10B', '9A'] },
    { id: '10B', musical: 'B# Minor', openKey: '5m', position: 9, mode: 'minor', energy: 6, mood: 'sad', color: '#0e7490', energyColor: '#06b6d4', compatible: ['9B', '11B', '10A'] },
    { id: '11B', musical: 'F## Minor', openKey: '6m', position: 10, mode: 'minor', energy: 7, mood: 'somber', color: '#047857', energyColor: '#059669', compatible: ['10B', '12B', '11A'] },
    { id: '12B', musical: 'D Minor', openKey: '7m', position: 11, mode: 'minor', energy: 3, mood: 'gentle', color: '#365314', energyColor: '#65a30d', compatible: ['11B', '1B', '12A'] }
  ], []);

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

    // TODO: Add musical key to Camelot conversion (C Major -> 1A, etc.)
    return null;
  }, []);

  // Analyze tracks by key
  const tracksByKey = useMemo(() => {
    const result: Record<string, GraphNode[]> = {};

    graphData.nodes.forEach(node => {
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
    graphData.edges.forEach(edge => {
      const sourceNode = graphData.nodes.find(n => n.id === edge.source);
      const targetNode = graphData.nodes.find(n => n.id === edge.target);

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
          .attr('stroke', connection.isPlaylistEdge ? '#10b981' : '#6b7280')
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