import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { CamelotWheel } from './CamelotWheel';
import { MoodVisualizer } from './MoodVisualizer';
import { GraphNode, Track } from '../types';
// Temporarily removing lucide icons to fix build
const Music = () => '🎵';
const TrendingUp = () => '📈';
const BarChart3 = () => '📊';
const Settings = () => '⚙️';
const Eye = () => '👁️';
const EyeOff = () => '🙈';
const Shuffle = () => '🔀';
const Target = () => '🎯';
const Filter = () => '🔧';
const RotateCw = () => '🔄';
const ChevronDown = () => '▼';
const ChevronUp = () => '▲';
const Zap = () => '⚡';
const Heart = () => '❤️';

interface KeyMoodPanelProps {
  className?: string;
  defaultExpanded?: boolean;
  showInSidePanel?: boolean;
}

export const KeyMoodPanel: React.FC<KeyMoodPanelProps> = ({
  className = '',
  defaultExpanded = true,
  showInSidePanel = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<'wheel' | 'flow' | 'both'>('both');
  const [showHarmonicSuggestions, setShowHarmonicSuggestions] = useState(false);
  const [usePlaylistData, setUsePlaylistData] = useState(true);

  // Store state and actions
  const graphData = useStore(state => state.graphData);
  const selectNode = useStore(state => state.graph.selectNode);
  const addToSetlist = useStore(state => state.setlist.addTrack);
  const applyFilters = useStore(state => state.search.applyFilters);

  // Handle key selection from wheel
  const handleKeySelect = useCallback((keys: string[]) => {
    console.log('Selected keys:', keys);

    // Apply key-based filters to the graph
    if (keys.length > 0) {
      // This would need to be implemented in the store
      // For now, we'll select nodes that match these keys
      const matchingNodes = (graphData.nodes || []).filter(node => {
        const nodeKey = node.key || node.metadata?.key;
        return nodeKey && keys.includes(nodeKey);
      });

      matchingNodes.forEach(node => selectNode(node.id));
    }
  }, [graphData.nodes, selectNode]);

  // Handle track selection
  const handleTrackSelect = useCallback((track: Track) => {
    console.log('Selected track:', track);
    // Find the node and select it
    const node = (graphData.nodes || []).find(n =>
      n.id === track.id ||
      n.label === track.name ||
      n.track?.id === track.id
    );

    if (node) {
      selectNode(node.id);
    }
  }, [graphData.nodes, selectNode]);

  // Handle transition planning
  const handlePlanTransition = useCallback((fromKey: string, toKey: string) => {
    console.log('Planning transition:', fromKey, '→', toKey);

    // Find tracks in these keys and suggest transitions
    const fromTracks = (graphData.nodes || []).filter(node => {
      const nodeKey = node.key || node.metadata?.key;
      return nodeKey === fromKey;
    });

    const toTracks = (graphData.nodes || []).filter(node => {
      const nodeKey = node.key || node.metadata?.key;
      return nodeKey === toKey;
    });

    if (fromTracks.length > 0 && toTracks.length > 0) {
      // Select some example tracks from each key
      const selectedFrom = fromTracks[0];
      const selectedTo = toTracks[0];

      selectNode(selectedFrom.id);
      setTimeout(() => selectNode(selectedTo.id), 500);
    }
  }, [graphData.nodes, selectNode]);

  // Handle energy point selection from mood visualizer
  const handleEnergyPointSelect = useCallback((point: any) => {
    console.log('Selected energy point:', point);

    if (point.track) {
      selectNode(point.track.id);
    }
  }, [selectNode]);

  return (
    <div className={`key-mood-panel ${className}`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Music size={20} />
              <TrendingUp size={16} />
            </div>
            <span className="font-semibold">Key & Mood Analysis</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {isExpanded && (
          <div className="flex items-center gap-2">
            {/* Tab selector */}
            <div className="flex bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('wheel')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'wheel'
                    ? 'bg-blue-500 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Wheel
              </button>
              <button
                onClick={() => setActiveTab('flow')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'flow'
                    ? 'bg-blue-500 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Flow
              </button>
              <button
                onClick={() => setActiveTab('both')}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTab === 'both'
                    ? 'bg-blue-500 text-white'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Both
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Panel Content */}
      {isExpanded && (
        <div className="space-y-6">
          {/* Settings Row */}
          <div className="flex flex-wrap items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={usePlaylistData}
                onChange={(e) => setUsePlaylistData(e.target.checked)}
                className="rounded"
              />
              <Target size={14} />
              <span>Prioritize playlist connections</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={showHarmonicSuggestions}
                onChange={(e) => setShowHarmonicSuggestions(e.target.checked)}
                className="rounded"
              />
              <Zap size={14} />
              <span>Show harmonic suggestions</span>
            </label>

            <div className="text-xs text-white/60 ml-auto">
              {usePlaylistData ? 'Using proven DJ transitions' : 'Using all connections'}
            </div>
          </div>

          {/* Camelot Wheel */}
          {(activeTab === 'wheel' || activeTab === 'both') && (
            <div className={activeTab === 'both' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
              <div className="bg-white/5 rounded-lg border border-white/10 p-4">
                <CamelotWheel
                  size={showInSidePanel ? 250 : 300}
                  showHarmonicSuggestions={showHarmonicSuggestions}
                  onKeySelect={handleKeySelect}
                  onTrackSelect={handleTrackSelect}
                  onPlanTransition={handlePlanTransition}
                />
              </div>

              {activeTab === 'both' && (
                <div className="bg-white/5 rounded-lg border border-white/10 p-4">
                  <MoodVisualizer
                    width={showInSidePanel ? 300 : 400}
                    height={200}
                    usePlaylistData={usePlaylistData}
                    showTransitions={true}
                    onPointSelect={handleEnergyPointSelect}
                  />
                </div>
              )}
            </div>
          )}

          {/* Mood Visualizer (solo) */}
          {activeTab === 'flow' && (
            <div className="bg-white/5 rounded-lg border border-white/10 p-4">
              <MoodVisualizer
                width={showInSidePanel ? 350 : 500}
                height={250}
                usePlaylistData={usePlaylistData}
                showTransitions={true}
                showEnergyFlow={true}
                showMoodLabels={true}
                onPointSelect={handleEnergyPointSelect}
              />
            </div>
          )}

          {/* Analysis Summary */}
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={16} />
              Quick Stats
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-white/60">Total Tracks</div>
                <div className="text-white font-semibold">{graphData.nodes.length}</div>
              </div>

              <div>
                <div className="text-white/60">Connections</div>
                <div className="text-white font-semibold">{graphData.edges.length}</div>
              </div>

              <div>
                <div className="text-white/60">Keys Found</div>
                <div className="text-white font-semibold">
                  {new Set(
                    graphData.nodes
                      .map(n => n.key || n.metadata?.key)
                      .filter(Boolean)
                  ).size}
                </div>
              </div>

              <div>
                <div className="text-white/60">Playlist Edges</div>
                <div className="text-white font-semibold text-green-400">
                  {graphData.edges.filter(e => e.type === 'adjacency').length}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  // Shuffle the visualization
                  console.log('Shuffling view...');
                }}
                className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors flex items-center gap-1"
              >
                <Shuffle size={12} />
                Shuffle View
              </button>

              <button
                onClick={() => {
                  // Reset filters
                  applyFilters({});
                }}
                className="px-3 py-1 bg-gray-500/20 border border-gray-500/30 rounded text-gray-400 text-sm font-medium hover:bg-gray-500/30 transition-colors flex items-center gap-1"
              >
                <RotateCw size={12} />
                Reset Filters
              </button>

              <button
                onClick={() => {
                  // Focus on high energy tracks
                  applyFilters({
                    energyRange: [0.7, 1.0]
                  });
                }}
                className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center gap-1"
              >
                <Zap size={12} />
                High Energy
              </button>

              <button
                onClick={() => {
                  // Focus on mellow tracks
                  applyFilters({
                    energyRange: [0.0, 0.4]
                  });
                }}
                className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors flex items-center gap-1"
              >
                <Heart size={12} />
                Mellow
              </button>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-xs text-white/60 p-3 bg-white/5 rounded border border-white/10">
            <div className="mb-2 font-semibold text-white/80">How to use:</div>
            <ul className="space-y-1">
              <li>• <strong>Camelot Wheel:</strong> Click key segments to filter tracks. Green lines show playlist connections.</li>
              <li>• <strong>Energy Flow:</strong> Visualize energy progression. Solid lines are proven DJ transitions.</li>
              <li>• <strong>Playlist Priority:</strong> When enabled, existing playlist edges take precedence over harmonic suggestions.</li>
              <li>• <strong>Harmonic Suggestions:</strong> Toggle to see compatible keys for creative mixing (shown as dotted lines).</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};