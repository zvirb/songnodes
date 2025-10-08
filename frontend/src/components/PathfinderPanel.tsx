import React, { useState, useEffect } from 'react';
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
  const { graphData, pathfindingState, pathfinding } = useStore();

  // Get tracks from store selections
  const tracks = graphData?.nodes || [];
  const startTrack = tracks.find(t => t.id === pathfindingState.startTrackId) || null;
  const endTrack = tracks.find(t => t.id === pathfindingState.endTrackId) || null;
  const waypoints = tracks.filter(t => pathfindingState.selectedWaypoints.has(t.id));

  const [targetDuration, setTargetDuration] = useState<number>(120); // minutes
  const [tolerance, setTolerance] = useState<number>(5); // minutes
  const [preferKeyMatching, setPreferKeyMatching] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<PathfinderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTrackSelector, setShowTrackSelector] = useState<'start' | 'end' | 'waypoint' | null>(null);

  // Filter tracks for selector
  const filteredTracks = tracks.filter(track => {
    const query = searchQuery.toLowerCase();
    const name = track.name?.toLowerCase() || '';
    const artist = track.artist?.toLowerCase() || '';
    return name.includes(query) || artist.includes(query);
  });

  const addWaypoint = (track: Track) => {
    pathfinding.addWaypoint(track.id);
    setShowTrackSelector(null);
    setSearchQuery('');
  };

  const removeWaypoint = (trackId: string) => {
    pathfinding.removeWaypoint(trackId);
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

    if (!graphData?.nodes || !graphData?.edges) {
      setError('No graph data available');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      // Prepare tracks data - handle both nested track format and flat node format
      const tracksData = graphData.nodes.map(node => {
        const track = node.track || node;
        return {
          id: node.id,
          name: track.name || node.name || node.title || node.label || 'Unknown',
          artist: track.artist || node.artist || 'Unknown',
          duration_ms: ((track.duration || node.duration || 180) * 1000), // Convert seconds to ms, default 3min
          camelot_key: track.camelotKey || node.camelot_key || node.metadata?.camelot_key,
          bpm: track.bpm || node.bpm || node.metadata?.bpm,
          energy: track.energy || node.energy || node.metadata?.energy
        };
      });

      // Prepare edges data
      const edgesData = graphData.edges.map(edge => ({
        from_id: edge.source,
        to_id: edge.target,
        weight: edge.weight || 1.0,
        connection_type: edge.type
      }));

      const requestBody = {
        start_track_id: startTrack.id,
        end_track_id: endTrack?.id || null,
        target_duration_ms: targetDuration * 60 * 1000, // Convert minutes to ms
        waypoint_track_ids: waypoints.map(w => w.id),
        tracks: tracksData,
        edges: edgesData,
        tolerance_ms: tolerance * 60 * 1000, // Convert minutes to ms
        prefer_key_matching: preferKeyMatching
      };

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

  // Track Selector Modal
  const TrackSelector = ({ onSelect, onClose }: { onSelect: (track: Track) => void; onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Select Track</h3>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tracks..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
          autoFocus
        />

        <div className="flex-1 overflow-y-auto">
          {filteredTracks.map(track => (
            <div
              key={track.id}
              onClick={() => onSelect(track as any)}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
            >
              <div className="font-medium">{track.name || track.title}</div>
              <div className="text-sm text-gray-600">{track.artist}</div>
              {track.camelot_key && (
                <div className="text-xs text-gray-500 mt-1">
                  Key: {track.camelot_key} {track.bpm && `• ${track.bpm} BPM`}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-semibold mb-4">DJ Set Pathfinder</h2>
        <p className="text-sm text-gray-600 mb-4">
          Create intelligent DJ sets using graph connections and harmonic mixing
        </p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {/* Track Selection */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Track *
            </label>
            {startTrack ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                <div>
                  <div className="font-medium">{startTrack.name || startTrack.title}</div>
                  <div className="text-sm text-gray-600">{startTrack.artist}</div>
                </div>
                <button
                  onClick={() => pathfinding.setStartTrack(null as any)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTrackSelector('start')}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-800"
              >
                + Select Start Track
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Track (Optional)
            </label>
            {endTrack ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div>
                  <div className="font-medium">{endTrack.name || endTrack.title}</div>
                  <div className="text-sm text-gray-600">{endTrack.artist}</div>
                </div>
                <button
                  onClick={() => pathfinding.setEndTrack(null as any)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowTrackSelector('end')}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-800"
              >
                + Select End Track
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
                  <div className="text-sm">
                    <div className="font-medium">{waypoint.name || waypoint.title}</div>
                    <div className="text-gray-600">{waypoint.artist}</div>
                  </div>
                  <button
                    onClick={() => removeWaypoint(waypoint.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowTrackSelector('waypoint')}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-gray-400 hover:text-gray-800 text-sm"
            >
              + Add Waypoint Track
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
          disabled={!startTrack || isSearching}
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
            </div>

            {/* Path Display */}
            <div>
              <h3 className="font-semibold mb-2">Generated Path</h3>
              <div className="space-y-1">
                {result.path.map((segment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{segment.track.name}</div>
                      <div className="text-sm text-gray-600 truncate">{segment.track.artist}</div>
                      {segment.track.camelot_key && (
                        <div className="text-xs text-gray-500">
                          {segment.track.camelot_key}
                          {segment.key_compatible && index > 0 && (
                            <span className="ml-2 text-green-600">✓ Compatible</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDuration(segment.track.duration_ms)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Track Selector Modal */}
      {showTrackSelector && (
        <TrackSelector
          onSelect={(track) => {
            if (showTrackSelector === 'start') {
              pathfinding.setStartTrack(track.id);
            } else if (showTrackSelector === 'end') {
              pathfinding.setEndTrack(track.id);
            } else if (showTrackSelector === 'waypoint') {
              addWaypoint(track);
            }
            setShowTrackSelector(null);
            setSearchQuery('');
          }}
          onClose={() => {
            setShowTrackSelector(null);
            setSearchQuery('');
          }}
        />
      )}
    </div>
  );
};

export default PathfinderPanel;
