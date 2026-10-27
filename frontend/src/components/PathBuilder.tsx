import { routeTracksFromNodes } from '../utils/trackMetadata';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { validateWaypoints } from '../utils/pathfinding';
import { DEFAULT_CONSTRAINTS, AVAILABLE_ALGORITHMS } from '../types/pathfinding';
import { formatCamelotKey } from '../utils/harmonic';
import { SN, KeyBadge, Bpm, EnergyBar } from '../lib/songnodes';
import { CompatibilityBadge, showToast } from './ds';
import clsx from 'clsx';
import Fuse, { FuseResult } from 'fuse.js';
import { API_BASE_URL } from '../lib/apiBase';

const REST_API_BASE = API_BASE_URL;

type EnergyFlowType = 'ascending' | 'descending' | 'plateau' | 'wave' | 'custom';

interface TrackSearchResult {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  key?: string;
  camelotKey?: string;
  energy?: number;
  genre?: string;
  duration?: number;
}

export const PathBuilder: React.FC = () => {
  const {
    graphData,
    pathfindingState,
    pathfinding: pathActions,
    graph: graphActions,
  } = useStore();

  // UI State
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'results'>('basic');

  // Search States
  const [startTrackSearch, setStartTrackSearch] = useState('');
  const [endTrackSearch, setEndTrackSearch] = useState('');
  const [waypointSearch, setWaypointSearch] = useState('');
  const [showStartResults, setShowStartResults] = useState(false);
  const [showEndResults, setShowEndResults] = useState(false);
  const [showWaypointResults, setShowWaypointResults] = useState(false);

  // Path Configuration
  const [targetDuration, setTargetDuration] = useState<number>(60); // minutes
  const [maxBpmChange, setMaxBpmChange] = useState<number>(20);
  const [harmonicMixing, setHarmonicMixing] = useState<boolean>(true);
  const [energyCurve, setEnergyCurve] = useState<EnergyFlowType>('ascending');
  const [customEnergyPoints, setCustomEnergyPoints] = useState<number[]>([0.3, 0.7, 0.9, 0.6]);

  // Validation State
  const [waypointValidation, setWaypointValidation] = useState<{
    [waypointId: string]: {
      isReachable: boolean;
      score: number;
      reason?: string;
    };
  }>({});

  // Create searchable track data from graph nodes
  const trackSearchData: TrackSearchResult[] = useMemo(() => {
    return (graphData.nodes || [])
      .map(node => {
        // Handle both nested track format and flat node format
        const track = node.track || node;
        return {
          id: node.id,
          title: track.name || node.name || node.title || node.label,
          artist: track.artist || node.artist || 'Unknown Artist',
          bpm: track.bpm || node.bpm,
          key: track.key || node.key,
          camelotKey: track.camelotKey || node.camelot_key,
          energy: track.energy || node.energy,
          genre: track.genre || node.genre,
          duration: track.duration || node.duration,
        };
      })
      .filter(track => track.title); // Filter out invalid entries
  }, [graphData.nodes]);

  // Fuse.js search instances
  const trackFuse = useMemo(() => {
    return new Fuse(trackSearchData, {
      keys: ['title', 'artist', 'genre'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [trackSearchData]);

  // Search results
  const startTrackResults = useMemo(() => {
    if (!startTrackSearch) return [];
    return trackFuse.search(startTrackSearch).slice(0, 10);
  }, [startTrackSearch, trackFuse]);

  const endTrackResults = useMemo(() => {
    if (!endTrackSearch) return [];
    return trackFuse.search(endTrackSearch).slice(0, 10);
  }, [endTrackSearch, trackFuse]);

  const waypointResults = useMemo(() => {
    if (!waypointSearch) return [];
    return trackFuse.search(waypointSearch)
      .filter(result => !pathfindingState.selectedWaypoints.has(result.item.id))
      .slice(0, 10);
  }, [waypointSearch, trackFuse, pathfindingState.selectedWaypoints]);

  // Get selected track details
  const startTrack = useMemo(() => {
    if (!pathfindingState.startTrackId) return null;
    return trackSearchData.find(t => t.id === pathfindingState.startTrackId);
  }, [pathfindingState.startTrackId, trackSearchData]);

  const endTrack = useMemo(() => {
    if (!pathfindingState.endTrackId) return null;
    return trackSearchData.find(t => t.id === pathfindingState.endTrackId);
  }, [pathfindingState.endTrackId, trackSearchData]);

  const waypointTracks = useMemo(() => {
    return Array.from(pathfindingState.selectedWaypoints)
      .map(id => trackSearchData.find(t => t.id === id))
      .filter(Boolean) as TrackSearchResult[];
  }, [pathfindingState.selectedWaypoints, trackSearchData]);

  // Validate waypoints when they change
  useEffect(() => {
    if (pathfindingState.startTrackId && pathfindingState.selectedWaypoints.size > 0) {
      const waypointsArray = Array.from(pathfindingState.selectedWaypoints);
      const validation = validateWaypoints(
        graphData,
        pathfindingState.startTrackId,
        pathfindingState.endTrackId || pathfindingState.startTrackId,
        waypointsArray
      );

      const validationMap: typeof waypointValidation = {};
      validation.forEach(v => {
        validationMap[v.waypointId] = {
          isReachable: v.isReachable,
          score: v.reachabilityScore,
          reason: v.reason,
        };
      });
      setWaypointValidation(validationMap);
    }
  }, [pathfindingState.startTrackId, pathfindingState.endTrackId, pathfindingState.selectedWaypoints, graphData]);

  // Event handlers
  const handleSelectStartTrack = useCallback((track: TrackSearchResult) => {
    pathActions.setStartTrack(track.id);
    setStartTrackSearch(track.title);
    setShowStartResults(false);
    graphActions.selectNode(track.id);
  }, [pathActions, graphActions]);

  const handleSelectEndTrack = useCallback((track: TrackSearchResult) => {
    pathActions.setEndTrack(track.id);
    setEndTrackSearch(track.title);
    setShowEndResults(false);
    graphActions.selectNode(track.id);
  }, [pathActions, graphActions]);

  const handleAddWaypoint = useCallback((track: TrackSearchResult) => {
    pathActions.addWaypoint(track.id);
    setWaypointSearch('');
    setShowWaypointResults(false);
    graphActions.selectNode(track.id);
  }, [pathActions, graphActions]);

  const handleRemoveWaypoint = useCallback((trackId: string) => {
    pathActions.removeWaypoint(trackId);
  }, [pathActions]);

  const handleClearEndTrack = useCallback(() => {
    pathActions.setEndTrack('');
    setEndTrackSearch('');
  }, [pathActions]);

  const handleGeneratePath = useCallback(async () => {
    if (!pathfindingState.startTrackId) return;

    pathActions.setPathCalculating(true);
    pathActions.clearPath();

    try {
      // Prepare tracks data - handle both nested track format and flat node format
      const tracksData = routeTracksFromNodes(graphData.nodes);

      // Prepare edges data
      const edgesData = graphData.edges.map(edge => ({
        from_id: edge.source,
        to_id: edge.target,
        weight: edge.weight || 1.0,
        connection_type: edge.type
      }));

      // Build request for backend API
      const requestBody = {
        start_track_id: pathfindingState.startTrackId,
        end_track_id: pathfindingState.endTrackId || null,
        target_duration_ms: targetDuration * 60 * 1000, // Convert minutes to ms
        waypoint_track_ids: Array.from(pathfindingState.selectedWaypoints),
        tracks: tracksData,
        edges: edgesData,
        tolerance_ms: 5 * 60 * 1000, // 5 minutes tolerance
        prefer_key_matching: harmonicMixing
      };

      // Call backend pathfinding API
      const response = await fetch(`${REST_API_BASE}/api/v1/pathfinder/find-path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Pathfinding failed' }));
        throw new Error(errorData.detail || 'Pathfinding failed');
      }

      const backendResult = await response.json();

      // Transform backend response to frontend PathResult format
      const result = {
        success: backendResult.success,
        path: backendResult.path.map((segment: any, index: number) => ({
          id: segment.track.id,
          track: {
            id: segment.track.id,
            name: segment.track.name,
            artist: segment.track.artist,
            duration: segment.track.duration_ms / 1000, // Convert ms to seconds
            bpm: segment.track.bpm,
            camelotKey: segment.track.camelot_key,
            energy: segment.track.energy,
          },
          position: index,
          isWaypoint: backendResult.waypoints_visited.includes(segment.track.id),
          transitionScore: segment.key_compatible ? 1.0 : 0.5,
          cumulativeWeight: segment.cumulative_duration_ms / 1000,
          parentId: index > 0 ? backendResult.path[index - 1].track.id : null,
          distanceFromStart: segment.cumulative_duration_ms / 1000,
        })),
        totalWeight: backendResult.total_duration_ms / 1000,
        totalDuration: backendResult.total_duration_ms / 1000,
        averageTransitionScore: backendResult.key_compatibility_score,
        keyTransitions: [], // Backend doesn't provide this, but not critical for UI
        bpmTransitions: [],
        energyProfile: [],
        genreTransitions: [],
        waypointsIncluded: backendResult.waypoints_visited,
        waypointsSkipped: backendResult.waypoints_missed,
        metadata: {
          searchTime: 0,
          nodesExplored: 0,
          algorithmsUsed: ['backend-astar'],
          optimizationPasses: 1,
        },
      };

      pathActions.setCurrentPath(result);

      // Switch to results tab if path was found
      if (result.success) {
        setActiveTab('results');
      }

      // Highlight path nodes in graph
      if (result.path.length > 0) {
        graphActions.clearSelection();
        result.path.forEach(pathNode => {
          graphActions.selectNode(pathNode.id);
        });
      }

    } catch (error) {
      console.error('Path generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Pathfinding failed';

      pathActions.setCurrentPath({
        success: false,
        path: [],
        totalWeight: Infinity,
        totalDuration: 0,
        averageTransitionScore: 0,
        keyTransitions: [],
        bpmTransitions: [],
        energyProfile: [],
        genreTransitions: [],
        waypointsIncluded: [],
        waypointsSkipped: Array.from(pathfindingState.selectedWaypoints),
        metadata: {
          searchTime: 0,
          nodesExplored: 0,
          algorithmsUsed: ['backend-astar'],
          optimizationPasses: 0,
        },
      });

      // Show error message to user
      showToast(`Pathfinding Error: ${errorMessage}`);
    }

    pathActions.setPathCalculating(false);
  }, [
    pathfindingState,
    targetDuration,
    maxBpmChange,
    harmonicMixing,
    graphData,
    pathActions,
    graphActions,
  ]);

  const renderSearchResults = (
    results: Array<FuseResult<TrackSearchResult>>,
    onSelect: (track: TrackSearchResult) => void,
    show: boolean
  ) => {
    if (!show || results.length === 0) return null;

    return (
      <div
        className="absolute top-full left-0 right-0 z-50 overflow-y-auto"
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--line)',
          borderRadius: '0 0 var(--radius-card) var(--radius-card)',
          boxShadow: 'var(--shadow-2)',
          maxHeight: '240px',
        }}
      >
        {results.map(({ item, score }) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left sn-btn sn-btn--quiet"
            style={{
              display: 'block',
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 0,
              borderBottom: '1px solid var(--line)',
              height: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <div style={{ font: '600 0.8125rem/1.3 var(--font-body)', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.artist}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                  {item.bpm && <Bpm value={item.bpm} />}
                  {item.camelotKey && <KeyBadge value={item.camelotKey} />}
                  {item.energy !== undefined && <EnergyBar value={item.energy} />}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-3)', fontFamily: 'var(--font-data)' }}>
                {((1 - (score || 0)) * 100).toFixed(0)}%
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderTrackCard = (track: TrackSearchResult, onRemove?: () => void, validation?: { isReachable: boolean; score: number; reason?: string }) => (
    <div
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-control)',
        background: 'var(--surface-2)',
        border: validation?.isReachable === false ? '1px solid var(--status-bad)' : '1px solid var(--line)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ font: '600 0.8125rem/1.3 var(--font-body)', color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', fontSize: '0.75rem', color: 'var(--fg-3)', alignItems: 'center' }}>
            {track.bpm && <Bpm value={track.bpm} />}
            {track.camelotKey && <KeyBadge value={track.camelotKey} />}
            {track.energy !== undefined && <EnergyBar value={track.energy} />}
            {track.duration && <span>{SN.format.duration(track.duration)}</span>}
          </div>
          {validation && !validation.isReachable && (
            <div style={{ fontSize: '0.75rem', color: 'var(--status-bad)', marginTop: 'var(--space-1)' }}>
              ▲ {validation.reason || 'Not reachable'}
            </div>
          )}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            type="button"
            className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
            title="Remove waypoint"
            aria-label={`Remove waypoint ${track.title}`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="sn-title title-s" style={{ margin: 0 }}>Path Builder</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
          aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
        >
          {isExpanded ? '⬇' : '⬆'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
            {[
              { id: 'basic', label: 'Basic' },
              { id: 'advanced', label: 'Advanced' },
              { id: 'results', label: 'Results' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="sn-tab"
                aria-selected={activeTab === tab.id}
                style={{
                  position: 'relative',
                  padding: 'var(--space-2) var(--space-4)',
                  fontSize: '0.8125rem',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? 'var(--brand)' : 'var(--fg-2)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--brand)' : 'none',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
                {tab.id === 'results' && pathfindingState.currentPath && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 'var(--space-1)',
                      right: 'var(--space-1)',
                      width: 'var(--space-2)',
                      height: 'var(--space-2)',
                      borderRadius: 'var(--radius-pill)',
                      background: pathfindingState.currentPath.success ? 'var(--status-ok)' : 'var(--status-bad)',
                    }}
                  />
                )}
              </button>
            ))}
          </div>

          <div style={{ flex: '1 1 auto', overflowY: 'auto' }}>
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Start Track */}
                <div className="sn-field">
                  <label htmlFor="pb-start-search">Start Track *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="pb-start-search"
                      type="text"
                      placeholder="Search for start track..."
                      value={startTrackSearch}
                      onChange={(e) => {
                        setStartTrackSearch(e.target.value);
                        setShowStartResults(true);
                      }}
                      onFocus={() => setShowStartResults(true)}
                      onBlur={() => setTimeout(() => setShowStartResults(false), 200)}
                      className="sn-input"
                    />
                    {renderSearchResults(startTrackResults, handleSelectStartTrack, showStartResults)}
                  </div>
                  {startTrack && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      {renderTrackCard(startTrack)}
                    </div>
                  )}
                </div>

                {/* End Track */}
                <div className="sn-field">
                  <label htmlFor="pb-end-search">
                    End Track (optional - creates loop if empty)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="pb-end-search"
                      type="text"
                      placeholder="Search for end track..."
                      value={endTrackSearch}
                      onChange={(e) => {
                        setEndTrackSearch(e.target.value);
                        setShowEndResults(true);
                      }}
                      onFocus={() => setShowEndResults(true)}
                      onBlur={() => setTimeout(() => setShowEndResults(false), 200)}
                      className="sn-input"
                    />
                    {endTrackSearch && (
                      <button
                        onClick={handleClearEndTrack}
                        type="button"
                        className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                        style={{ position: 'absolute', right: 'var(--space-2)', top: '50%', transform: 'translateY(-50%)' }}
                        aria-label="Clear end track search"
                      >
                        ✕
                      </button>
                    )}
                    {renderSearchResults(endTrackResults, handleSelectEndTrack, showEndResults)}
                  </div>
                  {endTrack && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      {renderTrackCard(endTrack)}
                    </div>
                  )}
                </div>

                {/* Waypoints */}
                <div className="sn-field">
                  <label htmlFor="pb-waypoint-search">
                    Waypoints ({waypointTracks.length}) - Required tracks (unordered)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="pb-waypoint-search"
                      type="text"
                      placeholder="Search to add waypoint tracks..."
                      value={waypointSearch}
                      onChange={(e) => {
                        setWaypointSearch(e.target.value);
                        setShowWaypointResults(true);
                      }}
                      onFocus={() => setShowWaypointResults(true)}
                      onBlur={() => setTimeout(() => setShowWaypointResults(false), 200)}
                      className="sn-input"
                    />
                    {renderSearchResults(waypointResults, handleAddWaypoint, showWaypointResults)}
                  </div>

                  {waypointTracks.length > 0 && (
                    <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '160px', overflowY: 'auto' }}>
                      {waypointTracks.map(track => (
                        <div key={track.id}>
                          {renderTrackCard(
                            track,
                            () => handleRemoveWaypoint(track.id),
                            waypointValidation[track.id]
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {waypointTracks.length > 0 && (
                    <button
                      onClick={() => pathActions.clearWaypoints()}
                      type="button"
                      className="sn-btn sn-btn--quiet sn-btn--sm"
                      style={{ marginTop: 'var(--space-2)', color: 'var(--status-bad)', alignSelf: 'flex-start' }}
                    >
                      Clear all waypoints
                    </button>
                  )}
                </div>

                {/* Generate Path Button */}
                <button
                  type="button"
                  onClick={handleGeneratePath}
                  disabled={!pathfindingState.startTrackId || pathfindingState.isCalculating}
                  className="sn-btn sn-btn--primary"
                  aria-busy={pathfindingState.isCalculating || undefined}
                >
                  {pathfindingState.isCalculating ? <span className="sn-spinner" aria-hidden="true" /> : null}
                  {pathfindingState.isCalculating ? 'Calculating Path…' : 'Generate Path'}
                </button>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
              <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Target Duration */}
                <div className="sn-field">
                  <label htmlFor="pb-target-duration">
                    Target Duration: <span className="data">{targetDuration} minutes</span>
                  </label>
                  <input
                    id="pb-target-duration"
                    type="range"
                    min="10"
                    max="180"
                    step="5"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--brand)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                    <span>10m</span>
                    <span>3h</span>
                  </div>
                </div>

                {/* Max BPM Change */}
                <div className="sn-field">
                  <label htmlFor="pb-max-bpm">
                    Max BPM Change: <span className="data">±{maxBpmChange} BPM</span>
                  </label>
                  <input
                    id="pb-max-bpm"
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={maxBpmChange}
                    onChange={(e) => setMaxBpmChange(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--brand)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                    <span>±5 BPM</span>
                    <span>±50 BPM</span>
                  </div>
                </div>

                {/* Harmonic Mixing */}
                <label className="sn-checkbox">
                  <input
                    type="checkbox"
                    checked={harmonicMixing}
                    onChange={(e) => setHarmonicMixing(e.target.checked)}
                  />
                  <span className="sn-checkbox__text">
                    <span>Enable Harmonic Mixing</span>
                  </span>
                </label>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                  Prioritize key-compatible transitions using the Camelot Wheel
                </p>

                {/* Energy Curve */}
                <div className="sn-field">
                  <label>Energy Curve</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
                    {[
                      { value: 'ascending', label: '📈 Ascending', desc: 'Build energy up' },
                      { value: 'descending', label: '📉 Descending', desc: 'Wind energy down' },
                      { value: 'plateau', label: '⛰️ Plateau', desc: 'Steady energy' },
                      { value: 'wave', label: '🌊 Wave', desc: 'Multiple peaks' },
                      { value: 'custom', label: '🎛️ Custom', desc: 'Define your own' },
                    ].filter(option => option.value !== 'wave' || import.meta.env.VITE_ENABLE_WAVE_ROUTING === 'true').map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setEnergyCurve(option.value as EnergyFlowType)}
                        className="sn-btn sn-btn--quiet"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: 'var(--space-2)',
                          height: 'auto',
                          background: energyCurve === option.value ? 'var(--brand-soft)' : 'var(--surface-2)',
                          border: energyCurve === option.value ? '1px solid var(--brand)' : '1px solid var(--line)',
                          borderRadius: 'var(--radius-control)',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--fg)' }}>{option.label}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)' }}>{option.desc}</span>
                      </button>
                    ))}
                  </div>

                  {energyCurve === 'custom' && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-control)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--fg-2)' }}>Custom Energy Points</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {customEnergyPoints.map((point, index) => (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '0.75rem', width: '32px', color: 'var(--fg-3)' }}>#{index + 1}:</span>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...customEnergyPoints];
                                newPoints[index] = Number(e.target.value);
                                setCustomEnergyPoints(newPoints);
                              }}
                              style={{ flex: '1 1 auto', accentColor: 'var(--brand)' }}
                            />
                            <span style={{ fontSize: '0.75rem', width: '32px', color: 'var(--fg-2)', fontFamily: 'var(--font-data)' }}>{(point * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Algorithm Selection */}
                <div className="sn-field">
                  <label htmlFor="pb-algorithm">Pathfinding Algorithm</label>
                  <select
                    id="pb-algorithm"
                    value={pathfindingState.algorithm.name}
                    onChange={(e) => {
                      const algo = AVAILABLE_ALGORITHMS.find(a => a.name === e.target.value);
                      if (algo) pathActions.setPathAlgorithm(algo);
                    }}
                    className="sn-select"
                  >
                    {AVAILABLE_ALGORITHMS.map(algo => (
                      <option key={algo.name} value={algo.name}>
                        {algo.name.charAt(0).toUpperCase() + algo.name.slice(1)} - {algo.description}
                      </option>
                    ))}
                  </select>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                    Best for: {pathfindingState.algorithm.bestFor.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Results Tab */}
            {activeTab === 'results' && (
              <div style={{ padding: 'var(--space-4)' }}>
                {pathfindingState.currentPath ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* Path Summary */}
                    <div
                      style={{
                        padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-card)',
                        border: '1px solid var(--line)',
                        background: pathfindingState.currentPath.success ? 'var(--surface-1)' : 'var(--status-bad-bg)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                        <h3 className="sn-title title-s" style={{ margin: 0, color: pathfindingState.currentPath.success ? 'var(--status-ok)' : 'var(--status-bad)' }}>
                          {pathfindingState.currentPath.success ? '● Path Found' : '✕ No Path Found'}
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-data)', color: 'var(--fg-3)' }}>
                          {pathfindingState.currentPath.metadata.searchTime == null ? 'Not reported' : `${pathfindingState.currentPath.metadata.searchTime}ms`}
                        </span>
                      </div>

                      {pathfindingState.currentPath.success && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', fontSize: '0.8125rem' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>Tracks</div>
                            <div className="data-strong">{pathfindingState.currentPath.path.length}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>Duration</div>
                            <div className="data-strong">{Math.round(pathfindingState.currentPath.totalDuration / 60)}m</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>Harmony Score</div>
                            <div className="data-strong">{(pathfindingState.currentPath.averageTransitionScore * 100).toFixed(0)}%</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)' }}>Waypoints</div>
                            <div className="data-strong">{pathfindingState.currentPath.waypointsIncluded.length}/{pathfindingState.selectedWaypoints.size}</div>
                          </div>
                        </div>
                      )}

                      {pathfindingState.currentPath.waypointsSkipped.length > 0 && (
                        <div style={{ marginTop: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--status-warn)' }}>
                          ▲ Skipped waypoints: {pathfindingState.currentPath.waypointsSkipped.length}
                        </div>
                      )}
                    </div>

                    {/* Path Tracks */}
                    {pathfindingState.currentPath.success && pathfindingState.currentPath.path.length > 0 && (
                      <div>
                        <h4 className="sn-title title-s" style={{ margin: '0 0 var(--space-2) 0' }}>Path Tracks</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: '384px', overflowY: 'auto' }}>
                          {pathfindingState.currentPath.path.map((pathNode, index) => {
                            const track = trackSearchData.find(t => t.id === pathNode.id);
                            if (!track) return null;

                            return (
                              <div
                                key={pathNode.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 'var(--space-3)',
                                  padding: 'var(--space-2) var(--space-3)',
                                  background: 'var(--surface-2)',
                                  borderRadius: 'var(--radius-control)',
                                }}
                              >
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: 'var(--radius-pill)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    fontFamily: 'var(--font-data)',
                                    background: pathNode.isWaypoint ? 'var(--mod-paths)' : 'var(--surface-3)',
                                    color: pathNode.isWaypoint ? 'var(--on-mod-paths)' : 'var(--fg)',
                                  }}
                                >
                                  {index + 1}
                                </div>
                                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)', fontSize: '0.75rem', color: 'var(--fg-3)', alignItems: 'center' }}>
                                    {track.bpm && <Bpm value={track.bpm} />}
                                    {track.camelotKey && <KeyBadge value={track.camelotKey} />}
                                    {track.energy !== undefined && <EnergyBar value={track.energy} />}
                                  </div>
                                </div>
                                {pathNode.isWaypoint && (
                                  <span className="sn-tag">WAYPOINT</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Transition Analysis */}
                    {pathfindingState.currentPath.success && pathfindingState.currentPath.keyTransitions.length > 0 && (
                      <div>
                        <h4 className="sn-title title-s" style={{ margin: '0 0 var(--space-2) 0' }}>Key Transitions</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', maxHeight: '128px', overflowY: 'auto' }}>
                          {pathfindingState.currentPath.keyTransitions.map((transition, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', padding: 'var(--space-2)', background: 'var(--surface-2)', borderRadius: 'var(--radius-chip)' }}>
                              <span>
                                {formatCamelotKey(transition.fromKey as any)} → {formatCamelotKey(transition.toKey as any)}
                              </span>
                              <CompatibilityBadge
                                level={
                                  transition.compatibility > 0.7 ? 'perfect' :
                                  transition.compatibility > 0.4 ? 'compatible' : 'clash'
                                }
                                label={`${(transition.compatibility * 100).toFixed(0)}%`}
                                outline
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          // Add path tracks to setlist
                          if (pathfindingState.currentPath?.path) {
                            pathfindingState.currentPath.path.forEach(pathNode => {
                              const track = graphData.nodes.find(n => n.id === pathNode.id)?.track;
                              if (track) {
                                // This would integrate with setlist functionality
                              }
                            });
                          }
                        }}
                        disabled={!pathfindingState.currentPath?.success}
                        className="sn-btn sn-btn--primary"
                        style={{ flex: '1 1 auto' }}
                      >
                        Add to Setlist
                      </button>
                      <button
                        type="button"
                        onClick={() => pathActions.clearPath()}
                        className="sn-btn"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--fg-3)', padding: 'var(--space-8) 0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🎯</div>
                    <div style={{ font: '600 0.9375rem/1.45 var(--font-body)', color: 'var(--fg-2)' }}>No path calculated yet</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 'var(--space-2)' }}>Configure settings and generate a path</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
