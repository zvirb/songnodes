import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Track } from '../types';

interface PathSegment {
  track: {
    id: string;
    name: string;
    artist: string;
    duration_ms: number;
    camelot_key?: string;
    bpm?: number;
  };
  connection_strength?: number;
  key_compatible: boolean;
  cumulative_duration_ms: number;
  is_synthetic_edge?: boolean;
}

interface PathfinderResult {
  success: boolean;
  path: PathSegment[];
  total_duration_ms: number;
  target_duration_ms: number;
  duration_difference_ms: number;
  waypoints_visited: string[];
  waypoints_missed: string[];
  average_connection_strength: number;
  key_compatibility_score: number;
  message: string;
}

const REST_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

export const PathfinderPanel: React.FC = () => {
  // Use store's graphData which includes any applied filters
  // This ensures pathfinder and visualization use the SAME filtered node set
  const { graphData, pathfindingState, pathfinding, viewState } = useStore();

  const tracks = graphData.nodes;
  const edges = graphData.edges;

  const startTrack = tracks.find(t => t.id === pathfindingState.startTrackId) || null;
  const endTrack = tracks.find(t => t.id === pathfindingState.endTrackId) || null;
  const waypoints = tracks.filter(t => pathfindingState.selectedWaypoints.has(t.id));

  // Get currently selected track from graph visualization
  const selectedNodeIds = Array.from(viewState.selectedNodes);
  const currentlySelectedTrack = selectedNodeIds.length > 0
    ? tracks.find(t => t.id === selectedNodeIds[0]) || null
    : null;

  const [targetDuration, setTargetDuration] = useState<number>(120); // minutes
  const [tolerance, setTolerance] = useState<number>(5); // minutes
  const [preferKeyMatching, setPreferKeyMatching] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<PathfinderResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removeWaypoint = (trackId: string) => {
    pathfinding.removeWaypoint(trackId);
  };

  const useSelectedTrackAsStart = () => {
    if (currentlySelectedTrack) {
      pathfinding.setStartTrack(currentlySelectedTrack.id);
    }
  };

  const useSelectedTrackAsEnd = () => {
    if (currentlySelectedTrack) {
      pathfinding.setEndTrack(currentlySelectedTrack.id);
    }
  };

  const useSelectedTrackAsWaypoint = () => {
    if (currentlySelectedTrack) {
      pathfinding.addWaypoint(currentlySelectedTrack.id);
    }
  };

  const formatDuration = (ms: number): string => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const findPath = async () => {
    if (!startTrack) {
      setError('Please select a start track');
      return;
    }

    if (tracks.length === 0) {
      setError('No tracks available. Please wait for data to load.');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      // Use the store's filtered tracks and edges directly
      // This ensures pathfinder uses the same data as the visualization
      const tracksData = tracks.map((track: any) => ({
        id: track.id,
        name: track.name || track.title || 'Unknown',
        artist: track.artist || 'Unknown',
        duration_ms: 180000, // Default 3 minutes
        camelot_key: track.track?.camelotKey || track.metadata?.musical_key,
        bpm: track.track?.bpm || track.metadata?.bpm,
        energy: track.track?.energy || track.metadata?.energy
      }));

      const edgesData = edges.map((edge: any) => ({
        from_id: edge.source,
        to_id: edge.target,
        weight: edge.weight || 1.0,
        connection_type: edge.type || 'sequential'
      }));

      const requestBody = {
        start_track_id: startTrack.id,
        end_track_id: endTrack?.id || null,
        target_duration_ms: targetDuration * 60 * 1000,
        waypoint_track_ids: waypoints.map(w => w.id),
        tracks: tracksData,
        edges: edgesData,
        tolerance_ms: tolerance * 60 * 1000,
        prefer_key_matching: preferKeyMatching
      };

      console.log(`🔍 Pathfinder request: ${tracksData.length} tracks, ${edgesData.length} edges`);

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

      const resultData: PathfinderResult = await response.json();
      setResult(resultData);
      pathfinding.setCurrentPath(resultData); // <-- ADD THIS LINE

      if (!resultData.success) {
        setError(resultData.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pathfinding failed';
      setError(message);
      console.error('Pathfinding error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-semibold mb-4">DJ Set Pathfinder</h2>
        <p className="text-sm text-gray-600 mb-4">
          Create intelligent DJ sets using graph connections and harmonic mixing
        </p>
        {tracks.length === 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              Loading tracks... Please wait for the graph visualization to load data.
            </p>
          </div>
        )}
      </div>

      {/* Currently Selected Track Info */}
      {currentlySelectedTrack && (
        <div className="flex-shrink-0 p-3 bg-purple-50 border border-purple-200 rounded-md">
          <div className="text-xs font-semibold text-purple-700 mb-1">Currently Selected Track:</div>
          <div className="font-medium text-sm">{currentlySelectedTrack.name || currentlySelectedTrack.title}</div>
          <div className="text-xs text-gray-600">{currentlySelectedTrack.artist}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {/* Track Selection */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Track *
            </label>
            {startTrack ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{startTrack.name || startTrack.title}</div>
                  <div className="text-sm text-gray-600 truncate">{startTrack.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={() => pathfinding.setStartTrack(null as any)}
                  className="ml-2 px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 rounded-md font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={useSelectedTrackAsStart}
                disabled={!currentlySelectedTrack || tracks.length === 0}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-green-400 hover:text-green-800 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                aria-label={currentlySelectedTrack ? `Use ${currentlySelectedTrack.name} as start track` : 'Select a track on the graph first'}
              >
                {currentlySelectedTrack && <Check size={16} strokeWidth={2} aria-hidden="true" />}
                {currentlySelectedTrack ? 'Use Selected Track as Start' : 'Select a track on the graph first'}
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Track (Optional)
            </label>
            {endTrack ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{endTrack.name || endTrack.title}</div>
                  <div className="text-sm text-gray-600 truncate">{endTrack.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={() => pathfinding.setEndTrack(null as any)}
                  className="ml-2 px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 rounded-md font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={useSelectedTrackAsEnd}
                disabled={!currentlySelectedTrack || tracks.length === 0}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-400 hover:text-blue-800 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                aria-label={currentlySelectedTrack ? `Use ${currentlySelectedTrack.name} as end track` : 'Select a track on the graph first'}
              >
                {currentlySelectedTrack && <Check size={16} strokeWidth={2} aria-hidden="true" />}
                {currentlySelectedTrack ? 'Use Selected Track as End' : 'Select a track on the graph first'}
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Waypoints (Optional) - Tracks that must be included
            </label>
            <div className="space-y-2 mb-2">
              {waypoints.map(waypoint => (
                <div key={waypoint.id} className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="text-sm flex-1 min-w-0">
                    <div className="font-medium truncate">{waypoint.name || waypoint.title}</div>
                    <div className="text-gray-600 truncate">{waypoint.artist}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeWaypoint(waypoint.id)}
                    className="ml-2 px-3 py-1.5 text-xs bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-900 rounded-md font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={useSelectedTrackAsWaypoint}
              disabled={!currentlySelectedTrack || tracks.length === 0}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-yellow-400 hover:text-yellow-800 hover:bg-yellow-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              aria-label={currentlySelectedTrack ? `Add ${currentlySelectedTrack.name} as waypoint` : 'Select a track on the graph first'}
            >
              {currentlySelectedTrack && <Check size={16} strokeWidth={2} aria-hidden="true" />}
              {currentlySelectedTrack ? 'Use Selected Track as Waypoint' : 'Select a track on the graph first'}
            </button>
          </div>
        </div>

        {/* Duration Settings */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Duration: {Math.floor(targetDuration / 60)}h {targetDuration % 60}m
            </label>
            <input
              type="range"
              min="15"
              max="240"
              step="5"
              value={targetDuration}
              onChange={(e) => setTargetDuration(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>15 min</span>
              <span>4 hours</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration Tolerance: ±{tolerance} min
            </label>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>±1 min</span>
              <span>±30 min</span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="key-matching"
            checked={preferKeyMatching}
            onChange={(e) => setPreferKeyMatching(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
          />
          <label htmlFor="key-matching" className="text-sm text-gray-700">
            Use Camelot key matching as tiebreaker
          </label>
        </div>

        {/* Find Path Button */}
        <button
          onClick={findPath}
          disabled={!startTrack || isSearching || tracks.length === 0}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSearching ? 'Finding Path...' : 'Find Path'}
        </button>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="font-semibold text-green-900 mb-2">Path Found!</h3>
              <div className="text-sm text-green-800 space-y-1">
                <p>Tracks: {result.path.length}</p>
                <p>Duration: {formatDuration(result.total_duration_ms)} (target: {formatDuration(result.target_duration_ms)})</p>
                <p>Difference: {formatDuration(result.duration_difference_ms)}</p>
                <p>Waypoints: {result.waypoints_visited.length}/{result.waypoints_visited.length + result.waypoints_missed.length}</p>
                <p>Avg Connection Strength: {result.average_connection_strength.toFixed(2)}</p>
                <p>Key Compatibility: {(result.key_compatibility_score * 100).toFixed(0)}%</p>
              </div>

              {/* Show info if synthetic edges were used */}
              {result.path.some((segment: any) => segment.is_synthetic_edge) && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-yellow-800">
                    <span className="text-yellow-600 font-bold">⚡</span>
                    <div>
                      <span className="font-semibold">Harmonic Links Used:</span> Some tracks weren't directly connected in playlists, so we used harmonic key compatibility to bridge the gap.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Path Display */}
            <div>
              <h3 className="font-semibold mb-2">Generated Path</h3>
              <div className="space-y-1">
                {(() => {
                  const waypointsVisitedSet = new Set(result.waypoints_visited);
                  return result.path.map((segment, index) => {
                    const isWaypoint = waypointsVisitedSet.has(segment.track.id);
                    return (
                      <div key={index} className={`flex items-center gap-2 p-2 rounded ${isWaypoint ? 'bg-yellow-100 border-l-4 border-yellow-400' : 'bg-gray-50'}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isWaypoint ? 'bg-yellow-500 text-white' : 'bg-blue-600 text-white'}`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{segment.track.name}</div>
                          <div className="text-sm text-gray-600 truncate">{segment.track.artist}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {isWaypoint && (
                              <span className="mr-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded-full text-xs font-semibold">Waypoint</span>
                            )}
                            {segment.track.camelot_key}
                            {segment.key_compatible && index > 0 && (
                              <span className="ml-2 text-green-600">✓ Compatible</span>
                            )}
                            {segment.is_synthetic_edge && index > 0 && (
                              <span className="ml-2 text-yellow-600 font-semibold">⚡ Harmonic Link</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatDuration(segment.track.duration_ms)}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PathfinderPanel;
