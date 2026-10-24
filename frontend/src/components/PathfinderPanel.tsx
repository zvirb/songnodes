import { routeTracksFromNodes } from '../utils/trackMetadata';
import React, { useState } from 'react';
import { Plus, X, Route } from 'lucide-react';
import { SN, KeyBadge } from '../lib/songnodes';
import { CompatibilityBadge } from './ds';
import './PathfinderPanel.css';
import { useStore } from '../store/useStore';
import { Track } from '../types';

import type { ServerPathResult as PathfinderResult } from '../types/pathfinding';
import { adaptServerPath } from '../utils/serverPath';
import { API_BASE_URL } from '../lib/apiBase';

const REST_API_BASE = API_BASE_URL;

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

  /** Set length in words via the design system ("2 h 5 min"); ms in. */
  const formatDuration = (ms: number): string => SN.format.span(Math.max(0, Math.round(ms / 1000)));

  const findPath = async () => {
    if (!startTrack) {
      setError('Pick a start track first.');
      return;
    }

    if (tracks.length === 0) {
      setError('No tracks yet. The graph has to load first.');
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

      console.log(`Pathfinder request: ${tracksData.length} tracks, ${edgesData.length} edges`);

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

  const slot = (
    label: string,
    track: typeof startTrack,
    onUse: () => void,
    onRemove: () => void,
    useLabel: string,
  ) => (
    <div className="pf__field">
      <span className="pf__label">{label}</span>
      {track ? (
        <div className="pf__slot">
          <div className="sn-track-cell pf__slot-main">
            <span className="sn-track-cell__title">
              <span className="sn-track-cell__name" title={`${track.artist} – ${track.name || track.title}`}>
                <span className="sn-track-cell__artist">{track.artist} –</span> {track.name || track.title}
              </span>
            </span>
          </div>
          <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm" onClick={onRemove} aria-label={`Remove ${track.name || track.title} as ${label.toLowerCase()}`} title="Remove">
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="sn-btn sn-btn--sm pf__pick"
          onClick={onUse}
          disabled={!currentlySelectedTrack || tracks.length === 0}
          aria-describedby={!currentlySelectedTrack ? 'pf-pick-hint' : undefined}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          {useLabel}
        </button>
      )}
    </div>
  );

  return (
    <div className="pf">
      <p className="pf__intro">Build a route through tracks DJs have played back to back, to a set length.</p>

      {tracks.length === 0 && (
        <p className="sn-inline-message" data-status="info">The track list fills in once the graph loads.</p>
      )}

      {currentlySelectedTrack ? (
        <div className="pf__selected">
          <span className="pf__label">Selected in the graph</span>
          <span className="pf__selected-name">{currentlySelectedTrack.artist} – {currentlySelectedTrack.name || currentlySelectedTrack.title}</span>
        </div>
      ) : (
        <p className="pf__hint" id="pf-pick-hint">Select a track in the graph, then add it as the start, end or a waypoint.</p>
      )}

      {slot('Start', startTrack, useSelectedTrackAsStart, () => pathfinding.setStartTrack(null as any), 'Use selected track as start')}
      {slot('End (optional)', endTrack, useSelectedTrackAsEnd, () => pathfinding.setEndTrack(null as any), 'Use selected track as end')}

      <div className="pf__field">
        <span className="pf__label">Waypoints (optional)</span>
        <span className="pf__help">Tracks the route must pass through.</span>
        {waypoints.map(waypoint => (
          <div key={waypoint.id} className="pf__slot">
            <div className="sn-track-cell pf__slot-main">
              <span className="sn-track-cell__title">
                <span className="sn-track-cell__name"><span className="sn-track-cell__artist">{waypoint.artist} –</span> {waypoint.name || waypoint.title}</span>
              </span>
            </div>
            <button type="button" className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm" onClick={() => removeWaypoint(waypoint.id)} aria-label={`Remove waypoint ${waypoint.name || waypoint.title}`} title="Remove">
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="sn-btn sn-btn--sm pf__pick"
          onClick={useSelectedTrackAsWaypoint}
          disabled={!currentlySelectedTrack || tracks.length === 0}
        >
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
          Add selected track as waypoint
        </button>
      </div>

      <div className="sn-field">
        <label htmlFor="pf-length">Set length: <span className="pf__value">{formatDuration(targetDuration * 60000)}</span></label>
        <input id="pf-length" type="range" min="15" max="240" step="5" value={targetDuration} onChange={(e) => setTargetDuration(Number(e.target.value))} />
        <span className="pf__range"><span>15 min</span><span>4 h</span></span>
      </div>

      <div className="sn-field">
        <label htmlFor="pf-tol">Allowed difference: <span className="pf__value">±{tolerance} min</span></label>
        <input id="pf-tol" type="range" min="1" max="30" step="1" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
        <span className="pf__range"><span>±1 min</span><span>±30 min</span></span>
      </div>

      <label className="sn-checkbox">
        <input type="checkbox" checked={preferKeyMatching} onChange={(e) => setPreferKeyMatching(e.target.checked)} />
        <span className="sn-checkbox__text"><span>Break ties by Camelot key match</span></span>
      </label>

      <button
        type="button"
        className="sn-btn sn-btn--primary"
        onClick={findPath}
        disabled={!startTrack || isSearching || tracks.length === 0}
        aria-busy={isSearching || undefined}
      >
        {isSearching ? <span className="sn-spinner" aria-hidden="true" /> : <Route size={16} strokeWidth={2} aria-hidden="true" />}
        {isSearching ? 'Finding a route…' : 'Find route'}
      </button>

      {error && (
        <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{error}</p>
      )}

      {result && result.success && (
        <section className="pf__result" aria-labelledby="pf-result">
          <h3 className="sn-title title-s" id="pf-result">Route: {result.path.length} tracks</h3>
          <dl className="pf__facts">
            <div><dt>Length</dt><dd>{formatDuration(result.total_duration_ms)}</dd></div>
            <div><dt>Target</dt><dd>{formatDuration(result.target_duration_ms)}</dd></div>
            <div><dt>Difference</dt><dd>{formatDuration(result.duration_difference_ms)}</dd></div>
            <div><dt>Waypoints</dt><dd>{result.waypoints_visited.length} of {result.waypoints_visited.length + result.waypoints_missed.length}</dd></div>
            <div><dt>Link strength</dt><dd>{result.average_connection_strength.toFixed(2)}</dd></div>
            <div><dt>Key matches</dt><dd>{SN.format.percent(result.key_compatibility_score)}</dd></div>
          </dl>

          {result.path.some((segment: any) => segment.is_synthetic_edge) && (
            <p className="sn-inline-message" data-status="info">
              Some tracks were never played back to back, so the route bridges them with a key match. Those steps are marked “Key link”.
            </p>
          )}

          <ol className="pf__path">
            {(() => {
              const waypointsVisitedSet = new Set(result.waypoints_visited);
              return result.path.map((segment, index) => {
                const isWaypoint = waypointsVisitedSet.has(segment.track.id);
                return (
                  <li key={index} className="pf__step" data-waypoint={isWaypoint ? '' : undefined}>
                    <span className="pf__num" aria-hidden="true">{index + 1}</span>
                    <div className="sn-track-cell pf__step-main">
                      <span className="sn-track-cell__title">
                        <span className="sn-track-cell__name" title={`${segment.track.artist} – ${segment.track.name}`}>
                          <span className="sn-track-cell__artist">{segment.track.artist} –</span> {segment.track.name}
                        </span>
                      </span>
                      <span className="sn-track-cell__meta">
                        <KeyBadge value={segment.track.camelot_key} />
                        {segment.track.duration_ms ? <><span className="sn-track-cell__sep" aria-hidden="true">·</span><span className="sn-track-cell__dur">{SN.format.duration(segment.track.duration_ms / 1000)}</span></> : null}
                        {isWaypoint && <span className="sn-tag">Waypoint</span>}
                        {segment.key_compatible && index > 0 && <CompatibilityBadge level="compatible" label="key fits" outline />}
                        {segment.is_synthetic_edge && index > 0 && <span className="sn-tag">Key link</span>}
                      </span>
                    </div>
                  </li>
                );
              });
            })()}
          </ol>
        </section>
      )}
    </div>
  );
};

export default PathfinderPanel;
