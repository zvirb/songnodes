import React, { useEffect, useRef, useMemo } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { line, curveCatmullRom } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { useStore } from '../store/useStore';
import { EnergyPoint, MOOD_COLORS, calculateEnergySequence } from '../utils/moodVisualizerUtils';
import { TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';

interface MoodVisualizerProps {
  /** The width of the SVG container. */
  width?: number;
  /** The height of the SVG container. */
  height?: number;
  /** If true, displays the energy flow line. */
  showEnergyFlow?: boolean;
  /** If true, displays mood labels on the points. */
  showMoodLabels?: boolean;
  /** If true, prioritizes setlist data over graph selection. */
  usePlaylistData?: boolean;
  /** Callback for when a data point is selected. */
  onPointSelect?: (point: EnergyPoint) => void;
  /** Additional CSS classes for the container. */
  className?: string;
}

/**
 * A D3-based visualization that plots the energy and mood of a sequence of tracks over time.
 * It helps DJs understand the overall flow and energy contour of their setlist or track selection.
 */
export const MoodVisualizer: React.FC<MoodVisualizerProps> = ({
  width = 400,
  height = 200,
  showEnergyFlow = true,
  showMoodLabels = true,
  usePlaylistData = true,
  onPointSelect,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { graphData, currentSetlist, selectedNodes } = useStore();

  const energySequence = useMemo(() => calculateEnergySequence({
    nodes: graphData.nodes,
    edges: graphData.edges,
    setlist: currentSetlist,
    selectedNodeIds: selectedNodes,
    usePlaylistData,
  }), [graphData, currentSetlist, selectedNodes, usePlaylistData]);

  useEffect(() => {
    if (!svgRef.current || energySequence.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const xScale = scaleLinear().domain([0, 1]).range([0, chartWidth]);
    const yScale = scaleLinear().domain([0, 1]).range([chartHeight, 0]);

    // Energy flow line
    if (showEnergyFlow && energySequence.length > 1) {
      g.append('path')
        .datum(energySequence)
        .attr('class', 'stroke-green-500/80 stroke-2 fill-none')
        .attr('d', line<EnergyPoint>().x(d => xScale(d.position)).y(d => yScale(d.energy)).curve(curveCatmullRom));
    }

    // Data points
    g.selectAll('.energy-point')
      .data(energySequence)
      .join('g')
      .attr('class', 'energy-point cursor-pointer')
      .attr('transform', d => `translate(${xScale(d.position)}, ${yScale(d.energy)})`)
      .on('click', (event, d) => onPointSelect?.(d))
      .each(function (d) {
        const group = select(this);
        group.append('circle')
          .attr('r', 6)
          .attr('class', 'stroke-white stroke-2')
          .style('fill', MOOD_COLORS[d.mood] || '#888');
        if (showMoodLabels) {
          group.append('text')
            .attr('class', 'text-xs fill-gray-300 text-center')
            .attr('y', 20)
            .text(d.mood.slice(0, 4));
        }
      });

    // Axes
    g.append('g').attr('transform', `translate(0, ${chartHeight})`).call(axisBottom(xScale).ticks(5).tickFormat(d => `${d as number * 100}%`)).attr('class', 'text-gray-400');
    g.append('g').call(axisLeft(yScale).ticks(5).tickFormat(d => `${d as number * 100}%`)).attr('class', 'text-gray-400');

  }, [width, height, energySequence, showEnergyFlow, showMoodLabels, onPointSelect]);

  return (
    <div className={`mood-visualizer ${className}`}>
      <header className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp size={20} />
          Energy & Mood Flow
        </h3>
      </header>
      <div className="relative bg-black/20 rounded-lg p-4">
        <svg ref={svgRef} width={width} height={height} className="overflow-visible" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm text-center">
        <div className="p-2 bg-white/5 rounded-lg">
          <div className="text-xs text-gray-400">Tracks</div>
          <div className="font-semibold">{energySequence.length}</div>
        </div>
        <div className="p-2 bg-white/5 rounded-lg">
          <div className="text-xs text-gray-400">Energy Range</div>
          <div className="font-semibold">
            {energySequence.length > 0 ? `${Math.round(Math.min(...energySequence.map(p => p.energy)) * 100)}% - ${Math.round(Math.max(...energySequence.map(p => p.energy)) * 100)}%` : 'N/A'}
          </div>
        </div>
        <div className="p-2 bg-white/5 rounded-lg">
          <div className="text-xs text-gray-400">Transitions</div>
          <div className="font-semibold flex items-center justify-center gap-2">
            <span className="flex items-center text-green-400"><ArrowUp size={14} /> {energySequence.filter(p => p.transition === 'boost').length}</span>
            <span className="flex items-center text-red-400"><ArrowDown size={14} /> {energySequence.filter(p => p.transition === 'drop').length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoodVisualizer;