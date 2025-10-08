import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { CamelotWheel } from './CamelotWheel';
import { MoodVisualizer } from './MoodVisualizer';
import { Track } from '../types';
import { Music, TrendingUp, BarChart3, Settings, Zap, Target, RotateCw, ChevronDown, ChevronUp, Shuffle, Heart } from 'lucide-react';

interface KeyMoodPanelProps {
  /** Additional CSS classes to apply to the panel. */
  className?: string;
  /** Whether the panel should be expanded by default. */
  defaultExpanded?: boolean;
  /** A flag to adjust styles for display within a side panel. */
  showInSidePanel?: boolean;
}

/**
 * A comprehensive panel that combines the CamelotWheel and MoodVisualizer
 * to provide an integrated view of a track library's harmonic and energy characteristics.
 */
export const KeyMoodPanel: React.FC<KeyMoodPanelProps> = ({
  className = '',
  defaultExpanded = true,
  showInSidePanel = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'wheel' | 'flow' | 'both'>('both');
  const [showHarmonicSuggestions, setShowHarmonicSuggestions] = useState(false);
  const [usePlaylistData, setUsePlaylistData] = useState(true);

  const { graphData, selectNode, applyFilters } = useStore(state => ({
    graphData: state.graphData,
    selectNode: state.graph.selectNode,
    applyFilters: state.search.applyFilters,
  }));

  const handleKeySelect = useCallback((keys: string[]) => {
    const matchingNodes = (graphData.nodes || []).filter(node => {
      const nodeKey = node.key || node.metadata?.key;
      return nodeKey && keys.includes(nodeKey);
    });
    matchingNodes.forEach(node => selectNode(node.id));
  }, [graphData.nodes, selectNode]);

  const handleTrackSelect = useCallback((track: Track) => {
    const node = (graphData.nodes || []).find(n => n.id === track.id || n.track?.id === track.id);
    if (node) {
      selectNode(node.id);
    }
  }, [graphData.nodes, selectNode]);

  return (
    <div className={`key-mood-panel ${className}`}>
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3 text-white hover:text-blue-400 transition-colors">
          <div className="flex items-center gap-2"><Music /><TrendingUp /></div>
          <span className="font-semibold">Key & Mood Analysis</span>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </button>
        {isExpanded && (
          <div className="flex bg-white/10 rounded-lg p-1">
            {(['wheel', 'flow', 'both'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${activeTab === tab ? 'bg-blue-500 text-white' : 'text-white/70 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </header>

      {isExpanded && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={usePlaylistData} onChange={e => setUsePlaylistData(e.target.checked)} className="rounded accent-blue-500" /><Target size={16} /> Prioritize playlist data</label>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={showHarmonicSuggestions} onChange={e => setShowHarmonicSuggestions(e.target.checked)} className="rounded accent-blue-500" /><Zap size={16} /> Show harmonic suggestions</label>
          </div>

          {(activeTab === 'wheel' || activeTab === 'both') && (
            <div className={activeTab === 'both' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
              <div className="bg-white/5 rounded-lg border border-white/10 p-4"><CamelotWheel size={showInSidePanel ? 250 : 300} showHarmonicSuggestions={showHarmonicSuggestions} onKeySelect={handleKeySelect} onTrackSelect={handleTrackSelect} /></div>
              {activeTab === 'both' && <div className="bg-white/5 rounded-lg border border-white/10 p-4"><MoodVisualizer width={showInSidePanel ? 300 : 400} height={200} usePlaylistData={usePlaylistData} onPointSelect={p => p.track && selectNode(p.track.id)} /></div>}
            </div>
          )}

          {activeTab === 'flow' && <div className="bg-white/5 rounded-lg border border-white/10 p-4"><MoodVisualizer width={showInSidePanel ? 350 : 500} height={250} usePlaylistData={usePlaylistData} onPointSelect={p => p.track && selectNode(p.track.id)} /></div>}

          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2"><BarChart3 size={18} /> Quick Stats</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-white/60">Total Tracks</div><div className="text-white font-semibold">{graphData.nodes.length}</div></div>
              <div><div className="text-white/60">Connections</div><div className="text-white font-semibold">{graphData.edges.length}</div></div>
              <div><div className="text-white/60">Keys Found</div><div className="text-white font-semibold">{new Set(graphData.nodes.map(n => n.key || n.metadata?.key).filter(Boolean)).size}</div></div>
              <div><div className="text-white/60">Playlist Edges</div><div className="text-white font-semibold text-green-400">{graphData.edges.filter(e => e.type === 'adjacency').length}</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyMoodPanel;