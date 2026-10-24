import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { CamelotWheel } from './CamelotWheel';
import { MoodVisualizer } from './MoodVisualizer';
import { GraphNode, Track } from '../types';
import {
  Music,
  TrendingUp,
  BarChart3,
  Shuffle,
  Target,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Heart
} from 'lucide-react';

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
  const addToSetlist = useStore(state => state.setlist.addTrackToSetlist);
  const applyFilters = useStore(state => state.search.applyFilters);

  // Handle key selection from wheel
  const handleKeySelect = useCallback((keys: string[]) => {

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

    if (point.track) {
      selectNode(point.track.id);
    }
  }, [selectNode]);

  return (
    <div className={`key-mood-panel bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ${className}`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-[var(--color-text-primary)] hover:text-[var(--color-brand-primary)] transition-colors"
          >
            <div className="flex items-center gap-2 text-[var(--color-brand-primary)]">
              <Music size={18} />
              <TrendingUp size={18} />
            </div>
            <span className="font-semibold text-[var(--font-size-base)]">Key & Mood Analysis</span>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {isExpanded && (
          <div className="flex items-center gap-2">
            {/* Tab selector */}
            <div className="flex bg-[var(--color-bg-elevated-2)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] p-1">
              <button
                onClick={() => setActiveTab('wheel')}
                className={`px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors ${
                  activeTab === 'wheel'
                    ? 'bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Wheel
              </button>
              <button
                onClick={() => setActiveTab('flow')}
                className={`px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors ${
                  activeTab === 'flow'
                    ? 'bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Flow
              </button>
              <button
                onClick={() => setActiveTab('both')}
                className={`px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors ${
                  activeTab === 'both'
                    ? 'bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
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
          <div className="flex flex-wrap items-center gap-4 p-3 bg-[var(--color-bg-elevated-2)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={usePlaylistData}
                onChange={(e) => setUsePlaylistData(e.target.checked)}
                className="rounded accent-[var(--color-brand-primary)]"
              />
              <Target size={14} className="text-[var(--color-brand-secondary)]" />
              <span>Prioritize playlist connections</span>
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={showHarmonicSuggestions}
                onChange={(e) => setShowHarmonicSuggestions(e.target.checked)}
                className="rounded accent-[var(--color-brand-primary)]"
              />
              <Zap size={14} className="text-[var(--color-warning)]" />
              <span>Show harmonic suggestions</span>
            </label>

            <div className="text-xs text-[var(--color-text-tertiary)] ml-auto">
              {usePlaylistData ? 'Using proven DJ transitions' : 'Using all connections'}
            </div>
          </div>

          {/* Camelot Wheel */}
          {(activeTab === 'wheel' || activeTab === 'both') && (
            <div className={activeTab === 'both' ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : ''}>
              <div className="bg-[var(--color-bg-elevated-2)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] p-4 shadow-[var(--shadow-sm)]">
                <CamelotWheel
                  size={showInSidePanel ? 250 : 300}
                  showHarmonicSuggestions={showHarmonicSuggestions}
                  onKeySelect={handleKeySelect}
                  onTrackSelect={handleTrackSelect}
                  onPlanTransition={handlePlanTransition}
                />
              </div>

              {activeTab === 'both' && (
                <div className="bg-[var(--color-bg-elevated-2)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] p-4 shadow-[var(--shadow-sm)]">
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
            <div className="bg-[var(--color-bg-elevated-2)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] p-4 shadow-[var(--shadow-sm)]">
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
          <div className="bg-[var(--color-bg-elevated-2)] rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] p-4 shadow-[var(--shadow-sm)]">
            <h4 className="text-[var(--color-text-primary)] font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={18} className="text-[var(--color-brand-primary)]" />
              Quick Stats
            </h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-[var(--color-text-tertiary)]">Total Tracks</div>
                <div className="text-[var(--color-text-primary)] font-semibold">{graphData.nodes.length}</div>
              </div>

              <div>
                <div className="text-[var(--color-text-tertiary)]">Connections</div>
                <div className="text-[var(--color-text-primary)] font-semibold">{graphData.edges.length}</div>
              </div>

              <div>
                <div className="text-[var(--color-text-tertiary)]">Keys Found</div>
                <div className="text-[var(--color-text-primary)] font-semibold">
                  {new Set(
                    graphData.nodes
                      .map(n => n.key || n.metadata?.key)
                      .filter(Boolean)
                  ).size}
                </div>
              </div>

              <div>
                <div className="text-[var(--color-text-tertiary)]">Playlist Edges</div>
                <div className="text-[var(--color-success)] font-semibold">
                  {graphData.edges.filter(e => e.type === 'adjacency').length}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  // Shuffle the visualization
                }}
                className="px-3 py-1 bg-[var(--color-brand-secondary-muted)] border border-[var(--color-brand-secondary)]/30 rounded-[var(--radius-button)] text-[var(--color-brand-secondary)] text-sm font-medium hover:bg-[var(--color-brand-secondary-muted)]/80 transition-colors flex items-center gap-1"
              >
                <Shuffle size={14} />
                Shuffle View
              </button>

              <button
                onClick={() => {
                  // Reset filters
                  applyFilters({});
                }}
                className="px-3 py-1 bg-[var(--color-bg-elevated-3)] border border-[var(--color-border-default)] rounded-[var(--radius-button)] text-[var(--color-text-secondary)] text-sm font-medium hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
              >
                <RotateCw size={14} />
                Reset Filters
              </button>

              <button
                onClick={() => {
                  // Focus on high energy tracks
                  applyFilters({
                    energyRange: [0.7, 1.0]
                  });
                }}
                className="px-3 py-1 bg-[var(--color-brand-tertiary-muted)] border border-[var(--color-brand-tertiary)]/30 rounded-[var(--radius-button)] text-[var(--color-brand-tertiary)] text-sm font-medium hover:bg-[var(--color-brand-tertiary-muted)]/80 transition-colors flex items-center gap-1"
              >
                <Zap size={14} />
                High Energy
              </button>

              <button
                onClick={() => {
                  // Focus on mellow tracks
                  applyFilters({
                    energyRange: [0.0, 0.4]
                  });
                }}
                className="px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-[var(--radius-button)] text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-colors flex items-center gap-1"
              >
                <Heart size={14} />
                Mellow
              </button>
            </div>
          </div>

          {/* Help Text */}
          <div className="text-xs text-[var(--color-text-tertiary)] p-3 bg-[var(--color-bg-elevated-2)] rounded-[var(--radius-md)] border border-[var(--color-border-subtle)]">
            <div className="mb-2 font-semibold text-[var(--color-text-secondary)]">How to use:</div>
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