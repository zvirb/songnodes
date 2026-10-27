import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { CamelotWheel } from './CamelotWheel';
import { MoodVisualizer } from './MoodVisualizer';
import { GraphNode, Track } from '../types';
import { Disc3, ChartLine, LayoutGrid, RotateCcw, Zap, Moon } from 'lucide-react';
import { SegmentedControl } from './ds';
import { SN } from '../lib/songnodes';
import './KeyMoodPanel.css';

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

  const keysFound = new Set(
    graphData.nodes
      .map(n => SN.camelot(n.key || n.metadata?.key))
      .filter(Boolean)
  ).size;
  const playlistEdges = graphData.edges.filter(e => e.type === 'adjacency').length;

  return (
    <div className={`key-mood-panel km ${className}`}>
      {/* Panel header: the tab names the panel; the view switch sits here */}
      <div className="km__head">
        {!showInSidePanel && (
          <button
            type="button"
            className="sn-btn sn-btn--quiet sn-btn--sm"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide key and mood' : 'Show key and mood'}
          </button>
        )}
        {isExpanded && (
          <SegmentedControl<'wheel' | 'flow' | 'both'>
            label="View"
            size="sm"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'wheel', label: 'Wheel', icon: Disc3 },
              { value: 'flow', label: 'Flow', icon: ChartLine },
              { value: 'both', label: 'Both', icon: LayoutGrid },
            ]}
          />
        )}
      </div>

      {isExpanded && (
        <div className="km__body">
          <fieldset className="sn-checkbox-group km__settings">
            <legend className="sn-checkbox-group__legend">Connections</legend>
            <label className="sn-checkbox">
              <input
                type="checkbox"
                checked={usePlaylistData}
                onChange={(e) => setUsePlaylistData(e.target.checked)}
              />
              <span className="sn-checkbox__text">
                <span>Put playlist connections first</span>
                <span className="sn-checkbox__hint">
                  {usePlaylistData ? 'Using transitions DJs have played.' : 'Using all connections.'}
                </span>
              </span>
            </label>
            <label className="sn-checkbox">
              <input
                type="checkbox"
                checked={showHarmonicSuggestions}
                onChange={(e) => setShowHarmonicSuggestions(e.target.checked)}
              />
              <span className="sn-checkbox__text"><span>Show compatible keys</span></span>
            </label>
          </fieldset>

          {(activeTab === 'wheel' || activeTab === 'both') && (
            <div className="km__card">
              <CamelotWheel
                size={showInSidePanel ? 280 : 320}
                showHarmonicSuggestions={showHarmonicSuggestions}
                onKeySelect={handleKeySelect}
                onTrackSelect={handleTrackSelect}
                onPlanTransition={handlePlanTransition}
              />
            </div>
          )}

          {(activeTab === 'flow' || activeTab === 'both') && (
            <div className="km__card">
              <MoodVisualizer
                width={showInSidePanel ? 300 : 500}
                height={activeTab === 'flow' ? 250 : 200}
                usePlaylistData={usePlaylistData}
                showTransitions={true}
                showEnergyFlow={activeTab === 'flow' ? true : undefined}
                showMoodLabels={activeTab === 'flow' ? true : undefined}
                onPointSelect={handleEnergyPointSelect}
              />
            </div>
          )}

          <section className="km__card" aria-labelledby="km-stats">
            <h4 className="km__label label" id="km-stats">In the graph</h4>
            <dl className="km__stats">
              <div><dt className="body-s">Tracks</dt><dd className="data-strong">{SN.format.count(graphData.nodes.length)}</dd></div>
              <div><dt className="body-s">Connections</dt><dd className="data-strong">{SN.format.count(graphData.edges.length)}</dd></div>
              <div><dt className="body-s">Keys found</dt><dd className="data-strong">{SN.format.count(keysFound)}</dd></div>
              <div><dt className="body-s">Playlist links</dt><dd className="data-strong">{SN.format.count(playlistEdges)}</dd></div>
            </dl>

            <div className="km__actions">
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => applyFilters({ energyRange: [0.7, 1.0] })}>
                <Zap size={16} strokeWidth={2} aria-hidden="true" />
                Show high energy
              </button>
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => applyFilters({ energyRange: [0.0, 0.4] })}>
                <Moon size={16} strokeWidth={2} aria-hidden="true" />
                Show low energy
              </button>
              <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => applyFilters({})}>
                <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
                Clear filters
              </button>
            </div>
          </section>

          <details className="km__help body-s">
            <summary>How to use Key and mood</summary>
            <ul>
              <li><strong>Camelot wheel:</strong> select key segments to pick the tracks in those keys.</li>
              <li><strong>Energy flow:</strong> shows how energy moves from track to track. Solid lines are transitions DJs have played.</li>
              <li><strong>Playlist connections first:</strong> played transitions win over key matches.</li>
              <li><strong>Compatible keys:</strong> outlines the keys that mix cleanly with the selected one.</li>
            </ul>
          </details>
        </div>
      )}
    </div>
  );
};
