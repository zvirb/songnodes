import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { findDJPath, validateWaypoints } from '../utils/pathfinding';
import { DEFAULT_CONSTRAINTS, AVAILABLE_ALGORITHMS } from '../types/pathfinding';
import { formatCamelotKey } from '../utils/harmonic';
import clsx from 'clsx';
import Fuse, { FuseResult } from 'fuse.js';

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
      .filter(node => node.track)
      .map(node => ({
        id: node.id,
        title: node.track!.name || node.label,
        artist: node.track!.artist || 'Unknown Artist',
        bpm: node.track!.bpm,
        key: node.track!.key,
        camelotKey: node.track!.camelotKey,
        energy: node.track!.energy,
        genre: node.track!.genre,
        duration: node.track!.duration,
      }));
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
      // Build path constraints
      const constraints = {
        ...DEFAULT_CONSTRAINTS.flexible,
        harmonicCompatibility: {
          ...DEFAULT_CONSTRAINTS.flexible.harmonicCompatibility,
          enabled: harmonicMixing,
          weight: harmonicMixing ? 0.8 : 0.1,
        },
        bpmCompatibility: {
          ...DEFAULT_CONSTRAINTS.flexible.bpmCompatibility,
          maxChange: maxBpmChange,
          preferredChange: Math.max(5, maxBpmChange / 2),
        },
        energyFlow: {
          ...DEFAULT_CONSTRAINTS.flexible.energyFlow,
          flowType: energyCurve === 'custom' ? 'any' : (energyCurve as 'ascending' | 'descending' | 'plateau' | 'wave'),
        },
        timing: {
          ...DEFAULT_CONSTRAINTS.flexible.timing,
          enabled: targetDuration > 0,
          targetDuration: targetDuration * 60, // Convert to seconds
        },
      };

      // Build path options
      const options = {
        startTrackId: pathfindingState.startTrackId,
        endTrackId: pathfindingState.endTrackId || pathfindingState.startTrackId,
        waypoints: pathfindingState.selectedWaypoints,
        maxBpmChange,
        energyFlow: energyCurve === 'custom' ? 'any' : (energyCurve as 'ascending' | 'descending' | 'plateau' | 'wave'),
        timeConstraints: {
          maxDuration: targetDuration * 60,
        },
      } as const;

      const result = await findDJPath(
        graphData,
        options,
        constraints as any,
        pathfindingState.algorithm
      );

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
          algorithmsUsed: [pathfindingState.algorithm.name],
          optimizationPasses: 0,
        },
      });
    }

    pathActions.setPathCalculating(false);
  }, [
    pathfindingState,
    targetDuration,
    maxBpmChange,
    harmonicMixing,
    energyCurve,
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
      <div className="absolute top-full left-0 right-0 z-50 bg-dj-dark border border-dj-light-gray rounded-b-lg shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
        {results.map(({ item, score }) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="w-full text-left p-3 hover:bg-dj-gray transition-colors border-b border-dj-gray last:border-b-0"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {item.title}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {item.artist}
                </div>
                <div className="flex gap-2 mt-1 text-xs text-gray-500">
                  {item.bpm && <span>{item.bpm} BPM</span>}
                  {item.camelotKey && <span>{formatCamelotKey(item.camelotKey as any)}</span>}
                  {item.energy !== undefined && <span>E:{(item.energy * 100).toFixed(0)}%</span>}
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {((1 - (score || 0)) * 100).toFixed(0)}%
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderTrackCard = (track: TrackSearchResult, onRemove?: () => void, validation?: { isReachable: boolean; score: number; reason?: string }) => (
    <div className={clsx(
      'p-3 rounded-lg bg-dj-gray border',
      validation?.isReachable === false ? 'border-dj-danger' : 'border-dj-light-gray'
    )}>
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{track.title}</div>
          <div className="text-xs text-gray-400 truncate">{track.artist}</div>
          <div className="flex gap-2 mt-1 text-xs text-gray-500">
            {track.bpm && <span>{track.bpm} BPM</span>}
            {track.camelotKey && <span>{formatCamelotKey(track.camelotKey as any)}</span>}
            {track.energy !== undefined && <span>E:{(track.energy * 100).toFixed(0)}%</span>}
            {track.duration && <span>{Math.round(track.duration / 60)}min</span>}
          </div>
          {validation && !validation.isReachable && (
            <div className="text-xs text-dj-danger mt-1">
              ⚠ {validation.reason || 'Not reachable'}
            </div>
          )}
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="ml-2 text-dj-danger hover:text-red-300 transition-colors"
            title="Remove waypoint"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-dj-dark text-white">
      {/* Header */}
      <div className="p-4 border-b border-dj-gray flex justify-between items-center">
        <h2 className="text-lg font-bold">Path Builder</h2>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-dj-gray rounded transition-colors"
        >
          {isExpanded ? '⬇' : '⬆'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-dj-gray">
            {[
              { id: 'basic', label: 'Basic' },
              { id: 'advanced', label: 'Advanced' },
              { id: 'results', label: 'Results' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={clsx(
                  'px-4 py-2 text-sm font-medium transition-colors relative',
                  activeTab === tab.id
                    ? 'text-dj-accent border-b-2 border-dj-accent'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {tab.label}
                {tab.id === 'results' && pathfindingState.currentPath && (
                  <span className={clsx(
                    'absolute -top-1 -right-1 w-2 h-2 rounded-full',
                    pathfindingState.currentPath.success ? 'bg-dj-accent' : 'bg-dj-danger'
                  )} />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <div className="p-4 space-y-4">
                {/* Start Track */}
                <div>
                  <label className="block text-sm font-medium mb-2">Start Track *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for start track..."
                      value={startTrackSearch}
                      onChange={(e) => {
                        setStartTrackSearch(e.target.value);
                        setShowStartResults(true);
                      }}
                      onFocus={() => setShowStartResults(true)}
                      onBlur={() => setTimeout(() => setShowStartResults(false), 200)}
                      className="w-full bg-dj-gray text-white px-3 py-2 rounded border border-dj-light-gray focus:border-dj-accent focus:outline-none"
                    />
                    {renderSearchResults(startTrackResults, handleSelectStartTrack, showStartResults)}
                  </div>
                  {startTrack && (
                    <div className="mt-2">
                      {renderTrackCard(startTrack)}
                    </div>
                  )}
                </div>

                {/* End Track */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    End Track (optional - creates loop if empty)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search for end track..."
                      value={endTrackSearch}
                      onChange={(e) => {
                        setEndTrackSearch(e.target.value);
                        setShowEndResults(true);
                      }}
                      onFocus={() => setShowEndResults(true)}
                      onBlur={() => setTimeout(() => setShowEndResults(false), 200)}
                      className="w-full bg-dj-gray text-white px-3 py-2 rounded border border-dj-light-gray focus:border-dj-accent focus:outline-none"
                    />
                    {endTrackSearch && (
                      <button
                        onClick={handleClearEndTrack}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                    {renderSearchResults(endTrackResults, handleSelectEndTrack, showEndResults)}
                  </div>
                  {endTrack && (
                    <div className="mt-2">
                      {renderTrackCard(endTrack)}
                    </div>
                  )}
                </div>

                {/* Waypoints */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Waypoints ({waypointTracks.length}) - Required tracks (unordered)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search to add waypoint tracks..."
                      value={waypointSearch}
                      onChange={(e) => {
                        setWaypointSearch(e.target.value);
                        setShowWaypointResults(true);
                      }}
                      onFocus={() => setShowWaypointResults(true)}
                      onBlur={() => setTimeout(() => setShowWaypointResults(false), 200)}
                      className="w-full bg-dj-gray text-white px-3 py-2 rounded border border-dj-light-gray focus:border-dj-accent focus:outline-none"
                    />
                    {renderSearchResults(waypointResults, handleAddWaypoint, showWaypointResults)}
                  </div>

                  {waypointTracks.length > 0 && (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
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
                      className="mt-2 text-xs text-gray-400 hover:text-dj-danger transition-colors"
                    >
                      Clear all waypoints
                    </button>
                  )}
                </div>

                {/* Generate Path Button */}
                <button
                  onClick={handleGeneratePath}
                  disabled={!pathfindingState.startTrackId || pathfindingState.isCalculating}
                  className={clsx(
                    'w-full py-3 px-4 rounded-lg font-medium transition-all',
                    pathfindingState.startTrackId && !pathfindingState.isCalculating
                      ? 'bg-dj-accent text-black hover:bg-green-400 active:scale-95'
                      : 'bg-dj-gray text-gray-500 cursor-not-allowed'
                  )}
                >
                  {pathfindingState.isCalculating ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-gray-500 border-t-black rounded-full animate-spin" />
                      Calculating Path...
                    </span>
                  ) : (
                    'Generate Path'
                  )}
                </button>
              </div>
            )}

            {/* Advanced Tab */}
            {activeTab === 'advanced' && (
              <div className="p-4 space-y-4">
                {/* Target Duration */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Target Duration: {targetDuration} minutes
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="180"
                    step="5"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Number(e.target.value))}
                    className="w-full accent-dj-accent"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>10min</span>
                    <span>3hrs</span>
                  </div>
                </div>

                {/* Max BPM Change */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Max BPM Change: ±{maxBpmChange} BPM
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="1"
                    value={maxBpmChange}
                    onChange={(e) => setMaxBpmChange(Number(e.target.value))}
                    className="w-full accent-dj-accent"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>±5 BPM</span>
                    <span>±50 BPM</span>
                  </div>
                </div>

                {/* Harmonic Mixing */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={harmonicMixing}
                      onChange={(e) => setHarmonicMixing(e.target.checked)}
                      className="accent-dj-accent"
                    />
                    <span className="text-sm font-medium">Enable Harmonic Mixing</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Prioritize key-compatible transitions using the Camelot Wheel
                  </p>
                </div>

                {/* Energy Curve */}
                <div>
                  <label className="block text-sm font-medium mb-2">Energy Curve</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'ascending', label: '📈 Ascending', desc: 'Build energy up' },
                      { value: 'descending', label: '📉 Descending', desc: 'Wind energy down' },
                      { value: 'plateau', label: '⛰️ Plateau', desc: 'Steady energy' },
                      { value: 'wave', label: '🌊 Wave', desc: 'Multiple peaks' },
                      { value: 'custom', label: '🎛️ Custom', desc: 'Define your own' },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setEnergyCurve(option.value as EnergyFlowType)}
                        className={clsx(
                          'p-2 rounded text-left transition-colors text-xs',
                          energyCurve === option.value
                            ? 'bg-dj-accent text-black'
                            : 'bg-dj-gray text-white hover:bg-dj-light-gray'
                        )}
                      >
                        <div className="font-medium">{option.label}</div>
                        <div className="text-gray-500">{option.desc}</div>
                      </button>
                    ))}
                  </div>

                  {energyCurve === 'custom' && (
                    <div className="mt-3 p-3 bg-dj-gray rounded">
                      <div className="text-xs font-medium mb-2">Custom Energy Points</div>
                      <div className="space-y-2">
                        {customEnergyPoints.map((point, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-xs w-12">#{index + 1}:</span>
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
                              className="flex-1 accent-dj-accent"
                            />
                            <span className="text-xs w-8">{(point * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Algorithm Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Pathfinding Algorithm</label>
                  <select
                    value={pathfindingState.algorithm.name}
                    onChange={(e) => {
                      const algo = AVAILABLE_ALGORITHMS.find(a => a.name === e.target.value);
                      if (algo) pathActions.setPathAlgorithm(algo);
                    }}
                    className="w-full bg-dj-gray text-white px-3 py-2 rounded border border-dj-light-gray focus:border-dj-accent focus:outline-none"
                  >
                    {AVAILABLE_ALGORITHMS.map(algo => (
                      <option key={algo.name} value={algo.name}>
                        {algo.name.charAt(0).toUpperCase() + algo.name.slice(1)} - {algo.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Best for: {pathfindingState.algorithm.bestFor.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Results Tab */}
            {activeTab === 'results' && (
              <div className="p-4">
                {pathfindingState.currentPath ? (
                  <div className="space-y-4">
                    {/* Path Summary */}
                    <div className={clsx(
                      'p-4 rounded-lg border',
                      pathfindingState.currentPath.success
                        ? 'bg-green-900/20 border-dj-accent text-green-100'
                        : 'bg-red-900/20 border-dj-danger text-red-100'
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium">
                          {pathfindingState.currentPath.success ? '✅ Path Found' : '❌ No Path Found'}
                        </h3>
                        <span className="text-sm">
                          {pathfindingState.currentPath.metadata.searchTime}ms
                        </span>
                      </div>

                      {pathfindingState.currentPath.success && (
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-400">Tracks</div>
                            <div className="font-mono">{pathfindingState.currentPath.path.length}</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Duration</div>
                            <div className="font-mono">{Math.round(pathfindingState.currentPath.totalDuration / 60)}min</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Harmony Score</div>
                            <div className="font-mono">{(pathfindingState.currentPath.averageTransitionScore * 100).toFixed(0)}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Waypoints</div>
                            <div className="font-mono">{pathfindingState.currentPath.waypointsIncluded.length}/{pathfindingState.selectedWaypoints.size}</div>
                          </div>
                        </div>
                      )}

                      {pathfindingState.currentPath.waypointsSkipped.length > 0 && (
                        <div className="mt-2 text-sm text-yellow-300">
                          ⚠ Skipped waypoints: {pathfindingState.currentPath.waypointsSkipped.length}
                        </div>
                      )}
                    </div>

                    {/* Path Tracks */}
                    {pathfindingState.currentPath.success && pathfindingState.currentPath.path.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Path Tracks</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                          {pathfindingState.currentPath.path.map((pathNode, index) => {
                            const track = trackSearchData.find(t => t.id === pathNode.id);
                            if (!track) return null;

                            return (
                              <div key={pathNode.id} className="flex items-center gap-3 p-2 bg-dj-gray rounded">
                                <div className={clsx(
                                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                                  pathNode.isWaypoint ? 'bg-dj-accent text-black' : 'bg-dj-light-gray text-white'
                                )}>
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white truncate">{track.title}</div>
                                  <div className="text-xs text-gray-400 truncate">{track.artist}</div>
                                  <div className="flex gap-2 mt-1 text-xs text-gray-500">
                                    {track.bpm && <span>{track.bpm} BPM</span>}
                                    {track.camelotKey && <span>{formatCamelotKey(track.camelotKey as any)}</span>}
                                    {track.energy !== undefined && <span>E:{(track.energy * 100).toFixed(0)}%</span>}
                                  </div>
                                </div>
                                {pathNode.isWaypoint && (
                                  <div className="text-xs text-dj-accent font-medium">WAYPOINT</div>
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
                        <h4 className="font-medium mb-2">Key Transitions</h4>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                          {pathfindingState.currentPath.keyTransitions.map((transition, index) => (
                            <div key={index} className="flex items-center justify-between text-xs p-2 bg-dj-gray rounded">
                              <span>
                                {formatCamelotKey(transition.fromKey as any)} → {formatCamelotKey(transition.toKey as any)}
                              </span>
                              <span className={clsx(
                                'font-medium',
                                transition.compatibility > 0.7 ? 'text-dj-accent' :
                                transition.compatibility > 0.4 ? 'text-dj-warning' : 'text-dj-danger'
                              )}>
                                {(transition.compatibility * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Add path tracks to setlist
                          if (pathfindingState.currentPath?.path) {
                            pathfindingState.currentPath.path.forEach(pathNode => {
                              const track = graphData.nodes.find(n => n.id === pathNode.id)?.track;
                              if (track) {
                                // This would integrate with setlist functionality
                                console.log('Add to setlist:', track);
                              }
                            });
                          }
                        }}
                        disabled={!pathfindingState.currentPath?.success}
                        className={clsx(
                          'flex-1 py-2 px-4 rounded text-sm font-medium transition-colors',
                          pathfindingState.currentPath?.success
                            ? 'bg-dj-accent text-black hover:bg-green-400'
                            : 'bg-dj-gray text-gray-500 cursor-not-allowed'
                        )}
                      >
                        Add to Setlist
                      </button>
                      <button
                        onClick={() => pathActions.clearPath()}
                        className="px-4 py-2 rounded text-sm font-medium bg-dj-gray text-white hover:bg-dj-light-gray transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <div className="text-4xl mb-2">🎯</div>
                    <div>No path calculated yet</div>
                    <div className="text-xs mt-2">Configure settings and generate a path</div>
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