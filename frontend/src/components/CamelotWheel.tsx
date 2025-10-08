import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { select } from 'd3-selection';
import { arc } from 'd3-shape';
import { useStore } from '../store/useStore';
import { GraphNode, Track, CamelotKey, TrackConnection } from '../types';
import { CAMELOT_KEYS } from '../utils/camelotData';
import { getTracksByKey, getTrackConnections, getTrackKey } from '../utils/camelotUtils';
import { Settings, RotateCcw, Zap, Music, TrendingUp } from 'lucide-react';

interface CamelotWheelProps {
  size?: number;
  showMoodLabels?: boolean;
  showEnergyGradient?: boolean;
  showHarmonicSuggestions?: boolean;
  onKeySelect?: (keys: string[]) => void;
  onTrackSelect?: (track: Track) => void;
  className?: string;
}

/**
 * Renders an interactive Camelot wheel visualization for harmonic mixing.
 * This component uses D3.js to draw the wheel and displays tracks, connections,
 * and harmonic compatibility based on the graph data.
 *
 * @param {CamelotWheelProps} props The component props.
 * @returns {React.ReactElement} The rendered Camelot wheel component.
 */
export const CamelotWheel: React.FC<CamelotWheelProps> = ({
  size = 300,
  showMoodLabels: showMoodLabelsProp = true,
  showEnergyGradient: showEnergyGradientProp = false,
  showHarmonicSuggestions = false,
  onKeySelect,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoodLabels, setShowMoodLabels] = useState(showMoodLabelsProp);
  const [showEnergyGradient, setShowEnergyGradient] = useState(showEnergyGradientProp);

  const graphData = useStore(state => state.graphData);
  const selectNode = useStore(state => state.graph.selectNode);

  const tracksByKey = useMemo(() => getTracksByKey(graphData.nodes || []), [graphData.nodes]);

  const trackConnections = useMemo(() => getTrackConnections(
    graphData.nodes || [],
    graphData.edges || [],
    showHarmonicSuggestions
  ), [graphData.nodes, graphData.edges, showHarmonicSuggestions]);

  const handleKeyClick = useCallback((key: string) => {
    const newSelection = selectedKeys.includes(key)
      ? selectedKeys.filter(k => k !== key)
      : [...selectedKeys, key];

    setSelectedKeys(newSelection);
    onKeySelect?.(newSelection);

    const nodeIdsToSelect = newSelection.flatMap(k => tracksByKey[k]?.map(t => t.id) || []);
    nodeIdsToSelect.forEach(id => selectNode(id));
  }, [selectedKeys, onKeySelect, tracksByKey, selectNode]);

  const getCompatibleKeys = useCallback((key: string): string[] => {
    return CAMELOT_KEYS.find(k => k.id === key)?.compatible || [];
  }, []);

  /**
   * This effect handles the D3.js rendering of the Camelot wheel.
   * It runs whenever the component's size, data, or state changes.
   * The logic within clears the SVG and redraws all elements:
   * - Connection lines between keys
   * - Major and minor key segments (arcs)
   * - Track count indicators on each key
   * - Text labels for keys
   */
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size * 0.4;
    const innerRadius = size * 0.25;
    const minorRadius = size * 0.15;

    const g = svg.append('g').attr('transform', `translate(${centerX}, ${centerY})`);

    // Draw connection lines
    trackConnections.forEach(conn => {
      const source = CAMELOT_KEYS.find(k => k.id === conn.sourceKey);
      const target = CAMELOT_KEYS.find(k => k.id === conn.targetKey);
      if (!source || !target) return;
      const angle = (pos: number) => (pos * 30) * (Math.PI / 180);
      const radius = (mode: 'major' | 'minor') => mode === 'major' ? (outerRadius + innerRadius) / 2 : minorRadius / 2;

      g.append('line')
        .attr('x1', Math.sin(angle(source.position)) * radius(source.mode))
        .attr('y1', -Math.cos(angle(source.position)) * radius(source.mode))
        .attr('x2', Math.sin(angle(target.position)) * radius(target.mode))
        .attr('y2', -Math.cos(angle(target.position)) * radius(target.mode))
        .attr('stroke', conn.isPlaylistEdge ? '#10b981' : '#6b7280')
        .attr('stroke-width', conn.isPlaylistEdge ? Math.min(conn.weight / 2, 4) : 1)
        .attr('stroke-opacity', conn.isPlaylistEdge ? 0.8 : 0.3);
    });

    const arcGenerator = (start: number, end: number) => arc<CamelotKey>()
      .innerRadius(start)
      .outerRadius(end)
      .startAngle(d => (d.position * 30 - 15) * Math.PI / 180)
      .endAngle(d => (d.position * 30 + 15) * Math.PI / 180);

    const majorArc = arcGenerator(innerRadius, outerRadius);
    const minorArc = arcGenerator(0, minorRadius);

    // Draw key segments
    CAMELOT_KEYS.forEach(keyData => {
      const isSelected = selectedKeys.includes(keyData.id);
      const isCompatible = hoveredKey ? getCompatibleKeys(hoveredKey).includes(keyData.id) : false;
      const trackCount = tracksByKey[keyData.id]?.length || 0;

      const segment = g.append('g')
        .datum(keyData)
        .on('click', (event, d) => handleKeyClick(d.id))
        .on('mouseover', (event, d) => setHoveredKey(d.id))
        .on('mouseout', () => setHoveredKey(null));

      segment.append('path')
        .attr('d', keyData.mode === 'major' ? majorArc : minorArc)
        .attr('fill', showEnergyGradient ? keyData.energyColor : keyData.color)
        .attr('stroke', '#1f2937')
        .attr('stroke-width', 2)
        .attr('opacity', isSelected ? 1 : isCompatible ? 0.8 : 0.6)
        .style('cursor', 'pointer');

      if (trackCount > 0) {
        const angle = keyData.position * 30 * Math.PI / 180;
        const r = keyData.mode === 'major' ? (outerRadius + innerRadius) / 2 : minorRadius / 2;
        const x = Math.sin(angle) * r;
        const y = -Math.cos(angle) * r;
        segment.append('circle').attr('cx', x).attr('cy', y).attr('r', 4).attr('fill', '#fff');
      }
    });

  }, [size, trackConnections, selectedKeys, hoveredKey, showEnergyGradient, handleKeyClick, getCompatibleKeys, tracksByKey]);

  return (
    <div className={`camelot-wheel ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Music size={20} />Camelot Wheel</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-white/70 hover:text-white" title="Settings"><Settings size={16} /></button>
          <button onClick={() => setSelectedKeys([])} className="p-2 text-white/70 hover:text-white" title="Clear selection"><RotateCcw size={16} /></button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
          <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={showEnergyGradient} onChange={e => setShowEnergyGradient(e.target.checked)} className="rounded" /><Zap size={14} />Energy colors</label>
          <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={showMoodLabels} onChange={e => setShowMoodLabels(e.target.checked)} className="rounded" /><TrendingUp size={14} />Mood labels</label>
        </div>
      )}

      <div className="relative"><svg ref={svgRef} width={size} height={size} /></div>

      {hoveredKey && (
        <div className="mt-4 p-3 bg-white/10 rounded-lg border border-white/10">
          {(() => {
            const keyData = CAMELOT_KEYS.find(k => k.id === hoveredKey);
            return keyData ? <div>{keyData.id} - {keyData.musical} ({tracksByKey[hoveredKey]?.length || 0} tracks)</div> : null;
          })()}
        </div>
      )}
    </div>
  );
};

export default CamelotWheel;