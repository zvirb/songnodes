import { trackFromNode } from '../utils/trackMetadata';
import React, { useState, useMemo, useCallback } from 'react';
import { Track } from '../types/dj';
import useStore from '../store/useStore';
import { Search, SearchX, ArrowLeft, ChevronRight, Unlink } from 'lucide-react';
import { SN, Bpm, KeyBadge } from '../lib/songnodes';
import { EmptyPanel, TrackEnergy } from './ds';
import './MobileTrackExplorer.css';

/**
 * MobileTrackExplorer - Mobile-optimized track navigation
 *
 * Uses card-based UI instead of graph visualization for better mobile performance.
 * Features:
 * - Search to find tracks
 * - Large track info card for current track
 * - Connected tracks shown as smaller cards below
 * - Navigation history (breadcrumbs)
 * - No WebGL/PIXI.js rendering
 */

interface NavigationHistoryItem {
  trackId: string;
  trackName: string;
}

interface ConnectedTrack {
  track: Track;
  connectionStrength: number;
  edgeMetadata?: {
    weight?: number;
    type?: string;
  };
}

export const MobileTrackExplorer: React.FC = () => {
  const { graphData } = useStore();

  // Navigation state
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(true);

  // Get all tracks from graph data
  const allTracks = useMemo(() => {
    return (graphData?.nodes || []).map(trackFromNode);
  }, [graphData?.nodes]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return allTracks
      .filter(track => {
        const name = track.name?.toLowerCase() || '';
        const artist = track.artist?.toLowerCase() || '';
        const genre = track.genre?.toLowerCase() || '';
        return name.includes(query) || artist.includes(query) || genre.includes(query);
      })
      .slice(0, 20); // Limit to 20 results for performance
  }, [searchQuery, allTracks]);

  // Get current track
  const currentTrack = useMemo(() => {
    if (!currentTrackId) return null;
    return allTracks.find(t => t.id === currentTrackId) || null;
  }, [currentTrackId, allTracks]);

  // Get connected tracks (tracks with edges to current track)
  const connectedTracks = useMemo((): ConnectedTrack[] => {
    if (!currentTrackId || !graphData?.edges) return [];

    const connections: ConnectedTrack[] = [];
    const edges = graphData.edges;

    edges.forEach(edge => {
      let connectedId: string | null = null;
      let edgeWeight = edge.weight || edge.strength || 1;

      // Check if current track is source or target
      if (typeof edge.source === 'string') {
        if (edge.source === currentTrackId) {
          connectedId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id;
        } else if (edge.target === currentTrackId) {
          connectedId = edge.source;
        }
      } else if ((edge.source as any)?.id === currentTrackId) {
        connectedId = typeof edge.target === 'string' ? edge.target : (edge.target as any)?.id;
      } else if ((edge.target as any)?.id === currentTrackId) {
        connectedId = typeof edge.source === 'string' ? edge.source : (edge.source as any)?.id;
      }

      if (connectedId) {
        const track = allTracks.find(t => t.id === connectedId);
        if (track) {
          connections.push({
            track,
            connectionStrength: edgeWeight,
            edgeMetadata: {
              weight: edgeWeight,
              type: edge.type,
            },
          });
        }
      }
    });

    // Sort by connection strength (highest first)
    return connections.sort((a, b) => b.connectionStrength - a.connectionStrength);
  }, [currentTrackId, graphData?.edges, allTracks]);

  // Navigation handlers
  const navigateToTrack = useCallback((trackId: string, trackName: string) => {
    if (currentTrackId) {
      // Add current track to history
      setNavigationHistory(prev => [...prev, {
        trackId: currentTrackId,
        trackName: currentTrack?.name || '–',
      }]);
    }
    setCurrentTrackId(trackId);
    setShowSearch(false);
  }, [currentTrackId, currentTrack]);

  const navigateBack = useCallback(() => {
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1];
      setCurrentTrackId(previous.trackId);
      setNavigationHistory(prev => prev.slice(0, -1));
    } else {
      // No history, go back to search
      setCurrentTrackId(null);
      setShowSearch(true);
    }
  }, [navigationHistory]);

  const resetNavigation = useCallback(() => {
    setCurrentTrackId(null);
    setNavigationHistory([]);
    setShowSearch(true);
    setSearchQuery('');
  }, []);

  const trackRow = (track: Track, meta?: React.ReactNode) => (
    <button key={track.id} type="button" className="mte__row" onClick={() => navigateToTrack(track.id, track.name)}>
      <span className="sn-track-cell mte__cell">
        <span className="sn-track-cell__title">
          <span className="sn-track-cell__name" title={`${track.artist} – ${track.name}`}>
            <span className="sn-track-cell__artist">{track.artist} –</span> {track.name}
          </span>
        </span>
        <span className="sn-track-cell__meta">
          <Bpm value={track.bpm} />
          <span className="sn-track-cell__sep" aria-hidden="true">·</span>
          <KeyBadge value={track.camelotKey || track.key} />
          <span className="sn-track-cell__sep" aria-hidden="true">·</span>
          <TrackEnergy energy={track.energy} scale={track.energy_scale} />
          {meta}
        </span>
      </span>
      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" className="mte__chev" />
    </button>
  );

  // Render search view
  if (!currentTrackId || showSearch) {
    return (
      <div className="mte">
        <div className="mte__search">
          <span className="mte__search-icon" aria-hidden="true"><Search size={16} strokeWidth={2} /></span>
          <input
            type="search"
            className="sn-input"
            placeholder="Track, artist or genre"
            aria-label="Search tracks"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {searchQuery.trim() === '' ? (
          <EmptyPanel compact icon={Search} title="Search to start exploring">
            Find a track, then follow the transitions DJs have played from it. {SN.format.count(allTracks.length)} tracks loaded.
          </EmptyPanel>
        ) : searchResults.length === 0 ? (
          <EmptyPanel compact icon={SearchX} title="No tracks match" actions={<button type="button" className="sn-btn" onClick={() => setSearchQuery('')}>Clear search</button>}>
            None of the {SN.format.count(allTracks.length)} tracks match “{searchQuery}”.
          </EmptyPanel>
        ) : (
          <div className="mte__list">{searchResults.map((track) => trackRow(track))}</div>
        )}
      </div>
    );
  }

  // Render track detail view
  return (
    <div className="mte">
      <div className="mte__bar">
        <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={navigateBack}>
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Back
        </button>
        <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={resetNavigation}>
          <Search size={16} strokeWidth={2} aria-hidden="true" />
          Search
        </button>
      </div>

      {navigationHistory.length > 0 && (
        <nav className="mte__trail" aria-label="Navigation trail">
          <ol>
            {navigationHistory.map((item, index) => <li key={`${item.trackId}-${index}`}>{item.trackName}</li>)}
            <li aria-current="page">{currentTrack?.name}</li>
          </ol>
        </nav>
      )}

      {currentTrack && (
        <section className="mte__current" aria-labelledby="mte-current">
          <h2 className="sn-title title-s" id="mte-current">{currentTrack.artist} – {currentTrack.name}</h2>
          <dl className="mte__facts">
            <div><dt>BPM</dt><dd><Bpm value={currentTrack.bpm} /></dd></div>
            <div><dt>Key</dt><dd><KeyBadge value={currentTrack.camelotKey || currentTrack.key} withName /></dd></div>
            <div><dt>Energy</dt><dd><TrackEnergy energy={currentTrack.energy} scale={currentTrack.energy_scale} /></dd></div>
            <div><dt>Genre</dt><dd>{currentTrack.genre || <span className="sn-none">–</span>}</dd></div>
            <div><dt>Length</dt><dd>{currentTrack.duration ? <span className="sn-bpm">{SN.format.duration(currentTrack.duration)}</span> : <span className="sn-none">–</span>}</dd></div>
          </dl>
        </section>
      )}

      <section aria-labelledby="mte-next">
        <h3 className="mte__label" id="mte-next">Played next to it <span className="sn-bpm">{connectedTracks.length}</span></h3>
        {connectedTracks.length === 0 ? (
          <EmptyPanel compact icon={Unlink} title="No transitions yet">No DJ set in the data plays this track next to another one.</EmptyPanel>
        ) : (
          <div className="mte__list">
            {connectedTracks.map(({ track, connectionStrength }) =>
              trackRow(track, <><span className="sn-track-cell__sep" aria-hidden="true">·</span><span>strength {connectionStrength.toFixed(2)}</span></>)
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default MobileTrackExplorer;
