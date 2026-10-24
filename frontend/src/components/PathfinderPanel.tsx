import { routeTracksFromNodes } from '../utils/trackMetadata';
import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';

import type { ServerPathResult as PathfinderResult } from '../types/pathfinding';
import { adaptServerPath } from '../utils/serverPath';

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
      const tracksData = routeTracksFromNodes(tracks);

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
      pathfinding.setCurrentPath(adaptServerPath(resultData));

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
    <div className="h-full flex flex-col overflow-hidden text-[var(--color-text-primary)]">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-semibold mb-[var(--space-4)]">DJ Set Pathfinder</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-[var(--space-4)]">
          Create intelligent DJ sets using graph connections and harmonic mixing
        </p>
        {tracks.length === 0 && (
          <div className="p-[var(--space-3)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[var(--radius-panel)] mb-[var(--space-4)]">
            <p className="text-sm text-[var(--color-warning)]">
              Loading tracks... Please wait for the graph visualization to load data.
            </p>
          </div>
        )}
      </div>

      {/* Currently Selected Track Info */}
      {currentlySelectedTrack && (
        <div className="flex-shrink-0 p-[var(--space-3)] mb-[var(--space-4)] bg-[var(--color-bg-elevated-2)] border border-[var(--color-brand-secondary)] rounded-[var(--radius-panel)]">
          <div className="text-xs font-semibold text-[var(--color-brand-secondary)] mb-[var(--space-1)]">
            Currently Selected Track:
          </div>
          <div className="font-medium text-sm text-[var(--color-text-primary)]">
            {currentlySelectedTrack.name || currentlySelectedTrack.title}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">{currentlySelectedTrack.artist}</div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-[var(--space-4)] pr-[var(--space-2)]">
        {/* Track Selection */}
        <div className="space-y-[var(--space-3)]">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-1)]">
              Start Track *
            </label>
            {startTrack ? (
              <div className="flex items-center justify-between p-[var(--space-3)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[var(--radius-panel)]">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-[var(--color-text-primary)]">
                    {startTrack.name || startTrack.title}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] truncate">{startTrack.artist}</div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => pathfinding.setStartTrack(null as any)}
                  className="ml-[var(--space-2)] text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                fullWidth
                onClick={useSelectedTrackAsStart}
                disabled={!currentlySelectedTrack || tracks.length === 0}
                className="border-dashed text-sm flex items-center justify-center gap-[var(--space-2)]"
                aria-label={
                  currentlySelectedTrack
                    ? `Use ${currentlySelectedTrack.name} as start track`
                    : 'Select a track on the graph first'
                }
              >
                {currentlySelectedTrack && <Check size={16} strokeWidth={2} aria-hidden="true" />}
                {currentlySelectedTrack ? 'Use Selected Track as Start' : 'Select a track on the graph first'}
              </Button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-1)]">
              End Track (Optional)
            </label>
            {endTrack ? (
              <div className="flex items-center justify-between p-[var(--space-3)] bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-[var(--radius-panel)]">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-[var(--color-text-primary)]">
                    {endTrack.name || endTrack.title}
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)] truncate">{endTrack.artist}</div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => pathfinding.setEndTrack(null as any)}
                  className="ml-[var(--space-2)] text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]"
                >
                  Remove
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                fullWidth
                onClick={useSelectedTrackAsEnd}
                disabled={!currentlySelectedTrack || tracks.length === 0}
                className="border-dashed text-sm flex items-center justify-center gap-[var(--space-2)]"
                aria-label={
                  currentlySelectedTrack
                    ? `Use ${currentlySelectedTrack.name} as end track`
                    : 'Select a track on the graph first'
                }
              >
                {currentlySelectedTrack && <Check size={16} strokeWidth={2} aria-hidden="true" />}
                {currentlySelectedTrack ? 'Use Selected Track as End' : 'Select a track on the graph first'}
              </Button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-1)]">
              Waypoints (Optional) - Tracks that must be included
            </label>
            <div className="space-y-[var(--space-2)] mb-[var(--space-2)]">
              {waypoints.map(waypoint => (
                <div
                  key={waypoint.id}
                  className="flex items-center justify-between p-[var(--space-2)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[var(--radius-panel)]"
                >
                  <div className="text-sm flex-1 min-w-0">
                    <div className="font-medium truncate text-[var(--color-text-primary)]">
                      {waypoint.name || waypoint.title}
                    </div>
                    <div className="text-[var(--color-text-secondary)] truncate">{waypoint.artist}</div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => removeWaypoint(waypoint.id)}
                    className="ml-[var(--space-2)] text-[var(--color-error)] border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)]"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              fullWidth
              onClick={useSelectedTrackAsWaypoint}
              disabled={!currentlySelectedTrack || tracks.length === 0}
              className="border-dashed text-sm flex items-center justify-center gap-[var(--space-2)]"
              aria-label={
                currentlySelectedTrack
                  ? `Add ${currentlySelectedTrack.name} as waypoint`
                  : 'Select a track on the graph first'
              }
            >
              {currentlySelectedTrack && <Check size={16} strokeWidth={2} aria-hidden="true" />}
              {currentlySelectedTrack ? 'Use Selected Track as Waypoint' : 'Select a track on the graph first'}
            </Button>
          </div>
        </div>

        {/* Duration Settings */}
        <div className="space-y-[var(--space-3)]">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-1)]">
              Target Duration: {Math.floor(targetDuration / 60)}h {targetDuration % 60}m
            </label>
            <input
              type="range"
              min="15"
              max="240"
              step="5"
              value={targetDuration}
              onChange={(e) => setTargetDuration(Number(e.target.value))}
              className="w-full accent-[var(--color-brand-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>15 min</span>
              <span>4 hours</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-[var(--space-1)]">
              Duration Tolerance: ±{tolerance} min
            </label>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={tolerance}
              onChange={(e) => setTolerance(Number(e.target.value))}
              className="w-full accent-[var(--color-brand-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
              <span>±1 min</span>
              <span>±30 min</span>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-[var(--space-2)]">
          <input
            type="checkbox"
            id="key-matching"
            checked={preferKeyMatching}
            onChange={(e) => setPreferKeyMatching(e.target.checked)}
            className="w-4 h-4 accent-[var(--color-brand-primary)] border-[var(--color-border-default)] rounded-[var(--radius-sm)]"
          />
          <label htmlFor="key-matching" className="text-sm text-[var(--color-text-primary)]">
            Use Camelot key matching as tiebreaker
          </label>
        </div>

        {/* Find Path Button */}
        <Button
          onClick={findPath}
          disabled={!startTrack || isSearching || tracks.length === 0}
          loading={isSearching}
          fullWidth
          variant="primary"
          size="lg"
        >
          {isSearching ? 'Finding Path...' : 'Find Path'}
        </Button>

        {/* Error State */}
        {error && (
          <div className="p-[var(--space-3)] bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-[var(--radius-panel)]">
            <p className="text-[var(--color-error)] text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && result.success && (
          <div className="space-y-[var(--space-4)]">
            <div className="p-[var(--space-4)] bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-[var(--radius-panel)]">
              <h3 className="font-semibold text-[var(--color-success)] mb-[var(--space-2)]">Path Found!</h3>
              <div className="text-sm text-[var(--color-text-primary)] space-y-[var(--space-1)]">
                <p>Tracks: {result.path.length}</p>
                <p>Duration: {formatDuration(result.total_duration_ms)} (target: {formatDuration(result.target_duration_ms)})</p>
                <p>Difference: {formatDuration(result.duration_difference_ms)}</p>
                <p>Waypoints: {result.waypoints_visited.length}/{result.waypoints_visited.length + result.waypoints_missed.length}</p>
                <p>Avg Connection Strength: {result.average_connection_strength.toFixed(2)}</p>
                <p>Key Compatibility: {(result.key_compatibility_score * 100).toFixed(0)}%</p>
              </div>

              {/* Show info if synthetic edges were used */}
              {result.path.some((segment: any) => segment.is_synthetic_edge) && (
                <div className="mt-[var(--space-3)] p-[var(--space-3)] bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[var(--radius-panel)]">
                  <div className="flex items-center gap-[var(--space-2)] text-sm text-[var(--color-warning)]">
                    <span className="font-bold">⚡</span>
                    <div>
                      <span className="font-semibold">Harmonic Links Used:</span> Some tracks weren't directly connected in playlists, so we used harmonic key compatibility to bridge the gap.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Path Display */}
            <div>
              <h3 className="font-semibold mb-[var(--space-2)] text-[var(--color-text-primary)]">Generated Path</h3>
              <div className="space-y-[var(--space-1)]">
                {(() => {
                  const waypointsVisitedSet = new Set(result.waypoints_visited);
                  return result.path.map((segment, index) => {
                    const isWaypoint = waypointsVisitedSet.has(segment.track.id);
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-panel)] border ${
                          isWaypoint
                            ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]'
                            : 'bg-[var(--color-bg-elevated-1)] border-[var(--color-border-subtle)]'
                        }`}
                      >
                        <Badge
                          variant={isWaypoint ? 'warning' : 'default'}
                          size="sm"
                          className="w-7 h-7 rounded-full flex items-center justify-center p-0 shrink-0 font-bold"
                        >
                          {index + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-[var(--color-text-primary)]">
                            {segment.track.name}
                          </div>
                          <div className="text-sm text-[var(--color-text-secondary)] truncate">
                            {segment.track.artist}
                          </div>
                          <div className="text-xs text-[var(--color-text-tertiary)] mt-[var(--space-1)] flex items-center gap-[var(--space-2)]">
                            {isWaypoint && (
                              <Badge variant="warning" size="sm">Waypoint</Badge>
                            )}
                            <span>{segment.track.camelot_key}</span>
                            {segment.key_compatible && index > 0 && (
                              <span className="text-[var(--color-success)]">✓ Compatible</span>
                            )}
                            {segment.is_synthetic_edge && index > 0 && (
                              <span className="text-[var(--color-warning)] font-semibold">⚡ Harmonic Link</span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
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
