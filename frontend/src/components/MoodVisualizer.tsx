import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { line, curveCatmullRom } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, Setlist, SetlistTrack } from '../types';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  Heart,
  Volume2,
  Play,
  SkipForward,
  Settings,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface EnergyPoint {
  position: number;    // Position in setlist or sequence (0-1)
  energy: number;      // Energy level (0-1)
  key: string | null;  // Musical key
  track: GraphNode;    // Track reference
  mood: string;        // Mood classification
  transition: 'boost' | 'maintain' | 'drop' | 'unknown';
}

interface MoodTransition {
  from: EnergyPoint;
  to: EnergyPoint;
  type: 'energy_boost' | 'energy_drop' | 'key_change' | 'mood_shift';
  strength: number; // 0-1, how dramatic the change is
  isPlaylistEdge: boolean; // Based on existing edges vs calculated
}

interface MoodVisualizerProps {
  width?: number;
  height?: number;
  showEnergyFlow?: boolean;
  showMoodLabels?: boolean;
  showTransitions?: boolean;
  usePlaylistData?: boolean; // Prioritize existing edges
  onPointSelect?: (point: EnergyPoint) => void;
  onTransitionSelect?: (transition: MoodTransition) => void;
  className?: string;
}

export const MoodVisualizer: React.FC<MoodVisualizerProps> = ({
  width = 400,
  height = 200,
  showEnergyFlow = true,
  showMoodLabels = true,
  showTransitions = true,
  usePlaylistData = true,
  onPointSelect,
  onTransitionSelect,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPoints, setSelectedPoints] = useState<number[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'energy' | 'mood' | 'flow'>('energy');

  // Store data
  const graphData = useStore(state => state.graphData);
  const currentSetlist = useStore(state => state.currentSetlist);
  const selectedNodes = useStore(state => state.viewState.selectedNodes);

  // Mood classification based on energy + key + genre
  const classifyMood = useCallback((energy: number, key: string | null, genre?: string): string => {
    const e = energy || 0.5;

    if (e >= 0.8) return 'euphoric';
    if (e >= 0.7) return 'energetic';
    if (e >= 0.6) return 'uplifting';
    if (e >= 0.5) return 'balanced';
    if (e >= 0.4) return 'mellow';
    if (e >= 0.3) return 'contemplative';
    if (e >= 0.2) return 'melancholic';
    return 'ambient';
  }, []);

  // Get energy from track data
  const getTrackEnergy = useCallback((node: GraphNode): number => {
    return node.energy ||
           node.metadata?.energy ||
           node.track?.energy ||
           (node.bpm ? Math.min(node.bpm / 140, 1) : 0.5); // BPM-based fallback
  }, []);

  // Get track key
  const getTrackKey = useCallback((node: GraphNode): string | null => {
    return node.key ||
           node.metadata?.key ||
           node.metadata?.camelot_key ||
           node.track?.key ||
           null;
  }, []);

  // Order nodes by edge connections (playlist adjacency)
  const orderNodesByEdges = useCallback((nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] => {
    // Handle empty array case
    if (nodes.length === 0) return [];

    const nodeSet = new Set(nodes.map(n => n.id));
    const adjacencyMap = new Map<string, string[]>();

    // Build adjacency map from edges
    edges.forEach(edge => {
      if (nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
        if (!adjacencyMap.has(edge.source)) adjacencyMap.set(edge.source, []);
        adjacencyMap.get(edge.source)!.push(edge.target);
      }
    });

    // Try to find a connected path
    const ordered: GraphNode[] = [];
    const visited = new Set<string>();

    // Start with node with highest degree (most connections)
    const startNode = nodes.reduce((best, node) => {
      const degree = (adjacencyMap.get(node.id) || []).length;
      const bestDegree = (adjacencyMap.get(best.id) || []).length;
      return degree > bestDegree ? node : best;
    });

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.find(n => n.id === nodeId);
      if (node) ordered.push(node);

      // Continue to connected nodes
      const connections = adjacencyMap.get(nodeId) || [];
      connections.forEach(nextId => {
        if (!visited.has(nextId)) traverse(nextId);
      });
    };

    traverse(startNode.id);

    // Add any remaining nodes
    nodes.forEach(node => {
      if (!visited.has(node.id)) ordered.push(node);
    });

    return ordered;
  }, []);

  // Create energy sequence from current data
  const energySequence = useMemo((): EnergyPoint[] => {
    let sequence: EnergyPoint[] = [];

    if (usePlaylistData && currentSetlist?.tracks?.length) {
      // Use setlist order for sequence
      sequence = currentSetlist.tracks.map((setlistTrack: SetlistTrack, index: number): EnergyPoint => {
        const node = graphData.nodes.find(n => n.id === setlistTrack.track.id) ||
                     { id: setlistTrack.track.id, label: setlistTrack.track.name } as GraphNode;

        const energy = getTrackEnergy(node);
        const key = getTrackKey(node);

        return {
          position: index / (currentSetlist.tracks.length - 1),
          energy,
          key,
          track: node,
          mood: classifyMood(energy, key),
          transition: index === 0 ? 'unknown' : 'unknown' // Will be calculated
        };
      });
    } else {
      // Use selected nodes or all nodes with adjacency-based ordering
      const nodes = selectedNodes.size > 0
        ? Array.from(selectedNodes).map(id => graphData.nodes.find(n => n.id === id)).filter(Boolean) as GraphNode[]
        : graphData.nodes.slice(0, 20); // Limit for performance

      // Try to order by existing edge connections
      const orderedNodes = orderNodesByEdges(nodes, graphData.edges);

      sequence = orderedNodes.map((node, index): EnergyPoint => {
        const energy = getTrackEnergy(node);
        const key = getTrackKey(node);

        return {
          position: index / (orderedNodes.length - 1),
          energy,
          key,
          track: node,
          mood: classifyMood(energy, key),
          transition: index === 0 ? 'unknown' : 'unknown'
        };
      });
    }

    // Calculate transitions
    for (let i = 1; i < sequence.length; i++) {
      const prev = sequence[i - 1];
      const curr = sequence[i];
      const energyDiff = curr.energy - prev.energy;

      if (energyDiff > 0.15) curr.transition = 'boost';
      else if (energyDiff < -0.15) curr.transition = 'drop';
      else curr.transition = 'maintain';
    }

    return sequence;
  }, [
    graphData.nodes,
    graphData.edges,
    currentSetlist,
    selectedNodes,
    usePlaylistData,
    getTrackEnergy,
    getTrackKey,
    classifyMood,
    orderNodesByEdges
  ]);

  // Calculate mood transitions
  const moodTransitions = useMemo((): MoodTransition[] => {
    const transitions: MoodTransition[] = [];

    for (let i = 1; i < energySequence.length; i++) {
      const from = energySequence[i - 1];
      const to = energySequence[i];

      const energyDiff = Math.abs(to.energy - from.energy);
      const keyChange = from.key !== to.key;

      // Check if this transition exists as a playlist edge
      const hasPlaylistEdge = graphData.edges.some(edge =>
        (edge.source === from.track.id && edge.target === to.track.id) ||
        (edge.target === from.track.id && edge.source === to.track.id)
      );

      let transitionType: MoodTransition['type'] = 'mood_shift';
      if (energyDiff > 0.2) transitionType = to.energy > from.energy ? 'energy_boost' : 'energy_drop';
      else if (keyChange) transitionType = 'key_change';

      transitions.push({
        from,
        to,
        type: transitionType,
        strength: Math.max(energyDiff, keyChange ? 0.3 : 0),
        isPlaylistEdge: hasPlaylistEdge
      });
    }

    return transitions;
  }, [energySequence, graphData.edges]);

  // Color schemes for different moods
  const moodColors = {
    euphoric: '#ef4444',    // Red
    energetic: '#f97316',   // Orange
    uplifting: '#f59e0b',   // Amber
    balanced: '#10b981',    // Green
    mellow: '#06b6d4',      // Cyan
    contemplative: '#3b82f6', // Blue
    melancholic: '#8b5cf6', // Purple
    ambient: '#6b7280'      // Gray
  };

  // Handle point selection
  const handlePointClick = useCallback((index: number) => {
    const point = energySequence[index];
    if (point && onPointSelect) {
      onPointSelect(point);
    }

    setSelectedPoints(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  }, [energySequence, onPointSelect]);

  // Render visualization
  useEffect(() => {
    if (!svgRef.current || energySequence.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = scaleLinear()
      .domain([0, 1])
      .range([0, chartWidth]);

    const yScale = scaleLinear()
      .domain([0, 1])
      .range([chartHeight, 0]);

    // Energy flow line
    if (showEnergyFlow && energySequence.length > 1) {
      const energyLine = line<EnergyPoint>()
        .x(d => xScale(d.position))
        .y(d => yScale(d.energy))
        .curve(curveCatmullRom);

      g.append('path')
        .datum(energySequence)
        .attr('d', energyLine)
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2)
        .attr('fill', 'none')
        .attr('opacity', 0.8);
    }

    // Transition lines (playlist edges vs suggestions)
    if (showTransitions) {
      moodTransitions.forEach(transition => {
        const line = g.append('line')
          .attr('x1', xScale(transition.from.position))
          .attr('y1', yScale(transition.from.energy))
          .attr('x2', xScale(transition.to.position))
          .attr('y2', yScale(transition.to.energy))
          .attr('stroke', transition.isPlaylistEdge ? '#10b981' : '#6b7280')
          .attr('stroke-width', transition.isPlaylistEdge ? Math.max(2, transition.strength * 4) : 1)
          .attr('stroke-opacity', transition.isPlaylistEdge ? 0.8 : 0.4)
          .attr('stroke-dasharray', transition.isPlaylistEdge ? '0' : '3,3')
          .style('cursor', 'pointer');

        line.on('click', () => {
          if (onTransitionSelect) onTransitionSelect(transition);
        });
      });
    }

    // Energy points
    const pointsGroup = g.append('g').attr('class', 'energy-points');

    pointsGroup.selectAll('.energy-point')
      .data(energySequence)
      .join('g')
      .attr('class', 'energy-point')
      .attr('transform', d => `translate(${xScale(d.position)}, ${yScale(d.energy)})`)
      .each(function(d, i) {
        const group = select(this);
        const isSelected = selectedPoints.includes(i);
        const isHovered = hoveredPoint === i;

        // Point circle
        group.append('circle')
          .attr('r', isSelected ? 8 : isHovered ? 6 : 4)
          .attr('fill', viewMode === 'mood' ? moodColors[d.mood as keyof typeof moodColors] : '#3b82f6')
          .attr('stroke', '#fff')
          .attr('stroke-width', isSelected ? 2 : 1)
          .attr('opacity', 0.8)
          .style('cursor', 'pointer');

        // Transition indicator
        if (i > 0 && d.transition !== 'maintain') {
          const icon = d.transition === 'boost' ? '↑' : d.transition === 'drop' ? '↓' : '−';
          group.append('text')
            .attr('x', 0)
            .attr('y', -12)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', d.transition === 'boost' ? '#10b981' : d.transition === 'drop' ? '#ef4444' : '#6b7280')
            .text(icon);
        }

        // Mood label
        if (showMoodLabels) {
          group.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '8px')
            .attr('fill', '#fff')
            .attr('opacity', 0.7)
            .text(d.mood.slice(0, 4));
        }
      })
      .on('click', (event, d) => handlePointClick(energySequence.indexOf(d)))
      .on('mouseover', (event, d) => setHoveredPoint(energySequence.indexOf(d)))
      .on('mouseout', () => setHoveredPoint(null));

    // Axes
    const xAxis = axisBottom(xScale)
      .tickFormat((d) => `${Math.round((d as number) * 100)}%`);

    const yAxis = axisLeft(yScale)
      .tickFormat((d) => `${Math.round((d as number) * 100)}%`);

    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis)
      .attr('color', '#9ca3af');

    g.append('g')
      .call(yAxis)
      .attr('color', '#9ca3af');

    // Axis labels
    g.append('text')
      .attr('transform', `translate(${chartWidth / 2}, ${chartHeight + 35})`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#9ca3af')
      .text('Track Progression');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -25)
      .attr('x', -chartHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#9ca3af')
      .text('Energy Level');

  }, [
    width,
    height,
    energySequence,
    moodTransitions,
    selectedPoints,
    hoveredPoint,
    viewMode,
    showEnergyFlow,
    showMoodLabels,
    showTransitions,
    handlePointClick,
    onTransitionSelect
  ]);

  return (
    <div className={`mood-visualizer ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp size={20} />
          Energy Flow
        </h3>

        <div className="flex items-center gap-2">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as any)}
            className="bg-white/10 text-white text-sm px-2 py-1 rounded border border-white/20"
          >
            <option value="energy">Energy</option>
            <option value="mood">Mood</option>
            <option value="flow">Flow</option>
          </select>

          <button
            onClick={() => setSelectedPoints([])}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Clear selection"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="grid grid-cols-2 gap-2 text-xs text-white/80">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500"></div>
            <span>Playlist transitions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-gray-500 border-dashed border-t"></div>
            <span>Energy connections</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowUp size={12} className="text-green-500" />
            <span>Energy boost</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowDown size={12} className="text-red-500" />
            <span>Energy drop</span>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="relative bg-black/20 rounded-lg p-4">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="overflow-visible"
        />
      </div>

      {/* Stats */}
      <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="grid grid-cols-3 gap-4 text-sm text-white">
          <div>
            <div className="text-white/60">Tracks</div>
            <div className="font-semibold">{energySequence.length}</div>
          </div>
          <div>
            <div className="text-white/60">Energy Range</div>
            <div className="font-semibold">
              {energySequence.length > 0 ?
                `${Math.round(Math.min(...energySequence.map(p => p.energy)) * 100)}% - ${Math.round(Math.max(...energySequence.map(p => p.energy)) * 100)}%`
                : 'N/A'
              }
            </div>
          </div>
          <div>
            <div className="text-white/60">Playlist Edges</div>
            <div className="font-semibold">
              {moodTransitions.filter(t => t.isPlaylistEdge).length}/{moodTransitions.length}
            </div>
          </div>
        </div>
      </div>

      {/* Hovered point info */}
      {hoveredPoint !== null && energySequence[hoveredPoint] && (
        <div className="mt-4 p-3 bg-white/10 rounded-lg border border-white/10">
          {(() => {
            const point = energySequence[hoveredPoint];
            return (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-white">{point.track.label}</span>
                  <span
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: moodColors[point.mood as keyof typeof moodColors] + '40',
                      color: moodColors[point.mood as keyof typeof moodColors]
                    }}
                  >
                    {point.mood}
                  </span>
                </div>

                <div className="text-sm text-white/80 grid grid-cols-2 gap-2">
                  <div>Energy: {Math.round(point.energy * 100)}%</div>
                  <div>Key: {point.key || 'Unknown'}</div>
                  <div>Position: {Math.round(point.position * 100)}%</div>
                  <div>Transition: {point.transition}</div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};