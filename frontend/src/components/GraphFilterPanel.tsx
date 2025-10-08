import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { GraphData } from '../types';
import { extractFilterValues, applyGraphFilters, GraphFilters, GraphFilterValues } from '../utils/graphFilterUtils';
import { X } from 'lucide-react';

interface GraphFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A modal panel for applying advanced filters to the graph data.
 * Allows users to control the complexity of the graph by filtering nodes and edges
 * based on various attributes like genre, year, and connection strength.
 *
 * @param {GraphFilterPanelProps} props The component props.
 * @returns {React.ReactElement | null} The rendered component or null if not open.
 */
export const GraphFilterPanel: React.FC<GraphFilterPanelProps> = ({ isOpen, onClose }) => {
  const { graphData, originalGraphData, setGraphData, resetGraphData } = useStore(state => ({
    graphData: state.graphData,
    originalGraphData: state.originalGraphData,
    setGraphData: state.graph.setGraphData,
    resetGraphData: state.graph.resetGraphData,
  }));

  const filterableValues = useMemo(
    () => extractFilterValues(originalGraphData || graphData),
    [originalGraphData, graphData]
  );

  const [filters, setFilters] = useState<GraphFilters>(() => ({
    selectedGenres: [],
    yearRange: [filterableValues.years[0] || 1990, filterableValues.years.slice(-1)[0] || new Date().getFullYear()],
    minConnectionStrength: 1,
    maxNodes: filterableValues.totalNodes,
    maxEdges: filterableValues.totalEdges,
  }));

  const filteredData = useMemo(
    () => applyGraphFilters(originalGraphData || graphData, filters),
    [originalGraphData, graphData, filters]
  );

  const handleApplyFilters = useCallback(() => {
    setGraphData(filteredData);
    onClose();
  }, [filteredData, setGraphData, onClose]);

  const handleResetFilters = useCallback(() => {
    resetGraphData();
    onClose();
  }, [resetGraphData, onClose]);

  const toggleGenre = (genre: string) => {
    setFilters(f => ({
      ...f,
      selectedGenres: f.selectedGenres.includes(genre)
        ? f.selectedGenres.filter(g => g !== genre)
        : [...f.selectedGenres, genre]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-white/10 w-[90%] max-w-2xl max-h-[85vh] overflow-hidden text-white flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex justify-between items-center p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold">Graph Filters</h2>
            <p className="text-sm text-gray-400">Showing {filteredData.nodes.length} nodes, {filteredData.edges.length} edges</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X size={24} /></button>
        </header>

        <main className="p-6 space-y-6 overflow-y-auto">
          {/* Node and Edge Limiters */}
          <div>
            <label className="text-sm font-semibold">Max Nodes: <span className="font-mono text-green-400">{filters.maxNodes}</span></label>
            <input type="range" min="10" max={filterableValues.totalNodes} value={filters.maxNodes} onChange={e => setFilters(f => ({ ...f, maxNodes: +e.target.value }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
          </div>
          <div>
            <label className="text-sm font-semibold">Max Edges: <span className="font-mono text-blue-400">{filters.maxEdges}</span></label>
            <input type="range" min="10" max={filterableValues.totalEdges} value={filters.maxEdges} onChange={e => setFilters(f => ({ ...f, maxEdges: +e.target.value }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <label className="text-sm font-semibold">Min Connection Strength: <span className="font-mono text-amber-400">{filters.minConnectionStrength}</span></label>
            <input type="range" min="1" max={filterableValues.connectionStrengths.slice(-1)[0] || 10} value={filters.minConnectionStrength} onChange={e => setFilters(f => ({...f, minConnectionStrength: +e.target.value}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500" />
          </div>

          {/* Genre Filter */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Genres ({filters.selectedGenres.length} selected)</h3>
            <div className="max-h-48 overflow-y-auto space-y-1 p-2 border border-gray-700 rounded-lg">
              {filterableValues.genres.map(({ genre, count }) => (
                <label key={genre} className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${filters.selectedGenres.includes(genre) ? 'bg-blue-500/20' : 'hover:bg-white/5'}`}>
                  <span className="flex items-center gap-3">
                    <input type="checkbox" checked={filters.selectedGenres.includes(genre)} onChange={() => toggleGenre(genre)} className="w-4 h-4 rounded bg-gray-600 border-gray-500 text-blue-500 focus:ring-blue-500" />
                    {genre}
                  </span>
                  <span className="text-xs text-gray-400">{count}</span>
                </label>
              ))}
            </div>
          </div>
        </main>

        <footer className="flex justify-between items-center p-6 border-t border-white/10 bg-black/30">
          <button onClick={handleResetFilters} className="px-5 py-2 text-sm font-semibold text-red-400 border border-red-400 rounded-lg hover:bg-red-400/10 transition-colors">Reset Filters</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2 text-sm font-semibold text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
            <button onClick={handleApplyFilters} className="px-5 py-2 text-sm font-bold text-black bg-green-500 rounded-lg hover:bg-green-400 transition-colors">Apply Filters</button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default GraphFilterPanel;