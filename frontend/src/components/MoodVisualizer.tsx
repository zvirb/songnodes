import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { line, curveCatmullRom } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { useStore } from '../store/useStore';
import { GraphNode, GraphEdge, Setlist, SetlistTrack } from '../types';
import { displayEnergy } from '../utils/trackMetadata';
import { SN } from '../lib/songnodes';
import { EmptyPanel } from './ds';
import { ChartLine } from 'lucide-react';
import './MoodVisualizer.css';

interface EnergyPoint {
  position: number;    // Position in setlist or sequence (0-1)
  energy: number;      // Energy 1–10 (design-system scale); tracks without energy are left out
  key: string | null;  // Musical key
  track: GraphNode;    // Track reference
  mood: string;        // Energy tier: Low 1–4, Building 5–7, High 8–10
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

  // Store data
  const graphData = useStore(state => state.graphData);
  const currentSetlist = useStore(state => state.currentSetlist);
  const selectedNodes = useStore(state => state.viewState.selectedNodes);

  // Energy tier word from the design system (never an invented mood)
  const classifyMood = useCallback((energy: number, _key: string | null, _genre?: string): string => {
    const tier = SN.tier(energy);
    return tier === 'low' ? 'Low' : tier === 'building' ? 'Building' : tier === 'high' ? 'High' : '–';
  }, []);

  // Energy 1–10 from the stored value and its scale; null when not analysed (never a default)
  const getTrackEnergy = useCallback((node: GraphNode): number | null => {
    const raw = node.energy ?? node.metadata?.energy ?? node.track?.energy;
    const scale = (node as { energy_scale?: string }).energy_scale ?? node.track?.energy_scale ?? node.metadata?.energy_scale;
    return displayEnergy(raw, scale).value;
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
      const withEnergy = currentSetlist.tracks
        .map((setlistTrack: SetlistTrack) => graphData.nodes.find(n => n.id === setlistTrack.track.id) ||
          ({ id: setlistTrack.track.id, label: setlistTrack.track.name, energy: setlistTrack.track.energy } as GraphNode))
        .map((node) => ({ node, energy: getTrackEnergy(node) }))
        .filter((x): x is { node: GraphNode; energy: number } => x.energy != null);
      sequence = withEnergy.map(({ node, energy }, index): EnergyPoint => {
        const key = getTrackKey(node);
        return {
          position: withEnergy.length > 1 ? index / (withEnergy.length - 1) : 0,
          energy,
          key,
          track: node,
          mood: classifyMood(energy, key),
          transition: 'unknown' // Calculated below
        };
      });
    } else {
      // Use selected nodes or all nodes with adjacency-based ordering
      const nodes = selectedNodes.size > 0
        ? Array.from(selectedNodes).map(id => graphData.nodes.find(n => n.id === id)).filter(Boolean) as GraphNode[]
        : graphData.nodes.slice(0, 20); // Limit for performance

      // Try to order by existing edge connections
      const orderedNodes = orderNodesByEdges(nodes, graphData.edges);

      const withEnergy = orderedNodes
        .map((node) => ({ node, energy: getTrackEnergy(node) }))
        .filter((x): x is { node: GraphNode; energy: number } => x.energy != null);
      sequence = withEnergy.map(({ node, energy }, index): EnergyPoint => {
        const key = getTrackKey(node);
        return {
          position: withEnergy.length > 1 ? index / (withEnergy.length - 1) : 0,
          energy,
          key,
          track: node,
          mood: classifyMood(energy, key),
          transition: 'unknown'
        };
      });
    }

    // Calculate transitions
    for (let i = 1; i < sequence.length; i++) {
      const prev = sequence[i - 1];
      const curr = sequence[i];
      const energyDiff = curr.energy - prev.energy;

      // 1–10 scale: a step of 2 or more is a boost or drop
      if (energyDiff >= 2) curr.transition = 'boost';
      else if (energyDiff <= -2) curr.transition = 'drop';
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
      if (energyDiff >= 2) transitionType = to.energy > from.energy ? 'energy_boost' : 'energy_drop';
      else if (keyChange) transitionType = 'key_change';

      transitions.push({
        from,
        to,
        type: transitionType,
        strength: Math.max(energyDiff / 10, keyChange ? 0.3 : 0),
        isPlaylistEdge: hasPlaylistEdge
      });
    }

    return transitions;
  }, [energySequence, graphData.edges]);

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

    // Scales: position 0–1 across the sequence, energy 1–10
    const xScale = scaleLinear()
      .domain([0, 1])
      .range([0, chartWidth]);

    const yScale = scaleLinear()
      .domain([1, 10])
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
        .attr('class', 'mv__flow');
    }

    // Transition lines: played transitions solid, others dashed (pattern carries type, not colour)
    if (showTransitions) {
      moodTransitions.forEach(transition => {
        const seg = g.append('line')
          .attr('x1', xScale(transition.from.position))
          .attr('y1', yScale(transition.from.energy))
          .attr('x2', xScale(transition.to.position))
          .attr('y2', yScale(transition.to.energy))
          .attr('class', transition.isPlaylistEdge ? 'mv__link mv__link--played' : 'mv__link mv__link--other')
          .attr('stroke-width', transition.isPlaylistEdge ? Math.max(2, transition.strength * 4) : 1)
          .style('cursor', 'pointer');

        seg.on('click', () => {
          if (onTransitionSelect) onTransitionSelect(transition);
        });
      });
    }

    // Energy points, filled with the energy token for their value
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

        group.append('circle')
          .attr('r', isSelected ? 8 : isHovered ? 6 : 4)
          .attr('class', isSelected ? 'mv__point mv__point--selected' : 'mv__point')
          .style('fill', `var(--energy-${d.energy})`)
          .style('cursor', 'pointer');

        if (i > 0 && (d.transition === 'boost' || d.transition === 'drop')) {
          group.append('text')
            .attr('x', 0)
            .attr('y', -12)
            .attr('class', 'mv__mark')
            .text(d.transition === 'boost' ? '↑' : '↓');
        }

        if (showMoodLabels) {
          group.append('text')
            .attr('x', 0)
            .attr('y', 20)
            .attr('class', 'mv__tier')
            .text(String(d.energy));
        }
      })
      .on('click', (event, d) => handlePointClick(energySequence.indexOf(d)))
      .on('mouseover', (event, d) => setHoveredPoint(energySequence.indexOf(d)))
      .on('mouseout', () => setHoveredPoint(null));

    // Axes (energy as integers, never percentages)
    const xAxis = axisBottom(xScale).ticks(0).tickSize(0);
    const yAxis = axisLeft(yScale).tickValues([1, 4, 7, 10]).tickFormat((d) => String(d));

    g.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .attr('class', 'mv__axis')
      .call(xAxis);

    g.append('g')
      .attr('class', 'mv__axis')
      .call(yAxis);

    g.append('text')
      .attr('transform', `translate(${chartWidth / 2}, ${chartHeight + 24})`)
      .attr('class', 'mv__axis-label')
      .text('Track order');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -28)
      .attr('x', -chartHeight / 2)
      .attr('class', 'mv__axis-label')
      .text('Energy');

  }, [
    width,
    height,
    energySequence,
    moodTransitions,
    selectedPoints,
    hoveredPoint,
    showEnergyFlow,
    showMoodLabels,
    showTransitions,
    handlePointClick,
    onTransitionSelect
  ]);

  const energies = energySequence.map(p => p.energy);
  const played = moodTransitions.filter(t => t.isPlaylistEdge).length;
  const hp = hoveredPoint !== null ? energySequence[hoveredPoint] : undefined;

  return (
    <div className={`mood-visualizer mv ${className}`}>
      <div className="mv__head">
        <h4 className="mv__title">Energy flow</h4>
        {selectedPoints.length > 0 && (
          <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => setSelectedPoints([])}>
            Clear selection
          </button>
        )}
      </div>

      {energySequence.length === 0 ? (
        <EmptyPanel compact icon={ChartLine} title="No energy to plot">
          None of these tracks has an energy value yet. Energy appears once tracks are analysed.
        </EmptyPanel>
      ) : (
        <>
          <ul className="mv__legend" aria-label="Legend">
            <li><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" className="mv__link mv__link--played" strokeWidth="2" /></svg>Played transition</li>
            <li><svg width="18" height="6" aria-hidden="true"><line x1="0" y1="3" x2="18" y2="3" className="mv__link mv__link--other" strokeWidth="1" /></svg>Other neighbour</li>
            <li><span aria-hidden="true">↑</span>Energy up 2 or more</li>
            <li><span aria-hidden="true">↓</span>Energy down 2 or more</li>
          </ul>

          <div className="mv__plot">
            <svg
              ref={svgRef}
              width={width}
              height={height}
              role="img"
              aria-label={`Energy of ${energySequence.length} tracks in order, from ${Math.min(...energies)} to ${Math.max(...energies)}`}
            />
          </div>

          <dl className="mv__stats">
            <div><dt>Tracks</dt><dd>{SN.format.count(energySequence.length)}</dd></div>
            <div><dt>Energy range</dt><dd>{Math.min(...energies)}–{Math.max(...energies)}</dd></div>
            <div><dt>Played links</dt><dd>{played} of {moodTransitions.length}</dd></div>
          </dl>

          {hp && (
            <div className="mv__detail" role="status">
              <strong>{hp.track.label}</strong>
              <span>Energy {hp.energy} · {hp.mood}</span>
              <span>Key {hp.key ? (SN.camelot(hp.key) ?? hp.key) : '–'}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};