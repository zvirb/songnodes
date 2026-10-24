import { trackFromNode } from '../utils/trackMetadata';
import React, { useState, useMemo, useCallback } from 'react';
import { Track } from '../types/dj';
import useStore from '../store/useStore';

/**
 * MobileTrackExplorer - Mobile-optimized track navigation
 *
 * Uses card-based UI instead of graph visualization for better mobile performance.
 * Features:
 * - Search to find tracks
 * - Large track info card for current track
 * - Connected tracks shown as smaller cards below
 * - Navigation history (breadcrumbs)
 * - Touch-optimized with design tokens and accessibility attributes
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
        trackName: currentTrack?.name || 'Unknown',
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

  // Render search view
  if (!currentTrackId || showSearch) {
    return (
      <div
        className="p-4 h-full flex flex-col bg-[var(--color-bg-base)] overflow-hidden"
        data-testid="mobile-track-explorer"
      >
        {/* Header */}
        <div className="mb-4">
          <h2 className="m-0 mb-2 text-[var(--color-text-primary)] text-[var(--fluid-font-xl)] font-bold">
            Explore Tracks
          </h2>
          <p className="m-0 text-[var(--color-text-secondary)] text-[var(--fluid-font-sm)]">
            Search for a track to start exploring connections
          </p>
        </div>

        {/* Search Input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by track, artist, or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-[var(--color-bg-elevated-1)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)] text-[var(--color-text-primary)] text-[var(--fluid-font-base)] outline-none focus:border-[var(--color-brand-primary)] min-h-[44px]"
            autoFocus
            data-testid="mobile-search-input"
          />
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto pr-2">
          {searchQuery.trim() === '' ? (
            <div className="text-center py-10 px-5 text-[var(--color-text-secondary)]">
              <div className="text-5xl mb-4">🔍</div>
              <p className="m-0 text-[var(--fluid-font-base)]">Start typing to search</p>
              <p className="mt-2 m-0 text-[var(--fluid-font-sm)]">
                {allTracks.length} tracks available
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-10 px-5 text-[var(--color-text-secondary)]">
              <div className="text-5xl mb-4">😕</div>
              <p className="m-0 text-[var(--fluid-font-base)]">No tracks found</p>
              <p className="mt-2 m-0 text-[var(--fluid-font-sm)]">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2" data-testid="mobile-search-results">
              {searchResults.map(track => (
                <button
                  key={track.id}
                  onClick={() => navigateToTrack(track.id, track.name)}
                  className="p-3 bg-[var(--color-card-bg)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)] text-[var(--color-text-primary)] text-left cursor-pointer hover:bg-[var(--color-card-hover)] min-h-[44px] flex flex-col justify-center transition-colors"
                  data-testid={`mobile-track-card-${track.id}`}
                >
                  <div className="text-[var(--fluid-font-base)] font-semibold mb-1">
                    {track.name}
                  </div>
                  <div className="text-[var(--fluid-font-sm)] text-[var(--color-text-secondary)]">
                    {track.artist} • {track.bpm} BPM • {track.key}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render track detail view
  return (
    <div
      className="h-full flex flex-col bg-[var(--color-bg-base)] overflow-hidden"
      data-testid="mobile-track-detail"
    >
      {/* Navigation Bar */}
      <div className="px-4 py-3 bg-[var(--color-bg-elevated-1)] border-b border-[var(--color-border-subtle)] flex items-center gap-3">
        <button
          onClick={navigateBack}
          className="px-3 py-2 bg-transparent border-none text-[var(--color-brand-secondary)] text-[var(--fluid-font-base)] cursor-pointer flex items-center gap-1 min-h-[44px] font-medium"
          data-testid="mobile-back-button"
        >
          <span className="text-lg">←</span>
          Back
        </button>

        <button
          onClick={resetNavigation}
          className="px-3 py-2 bg-transparent border-none text-[var(--color-brand-secondary)] text-[var(--fluid-font-base)] cursor-pointer flex items-center min-h-[44px] font-medium"
          data-testid="mobile-search-toggle"
        >
          🔍 Search
        </button>

        <div className="flex-1" />

        {navigationHistory.length > 0 && (
          <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)]">
            {navigationHistory.length} deep
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Current Track Card (Large) */}
        {currentTrack && (
          <div
            className="p-6 bg-[var(--color-bg-elevated-1)] border-2 border-[var(--color-brand-primary)] rounded-[var(--radius-xl)] mb-6 shadow-lg"
            data-testid="current-track-detail-card"
          >
            <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-2 uppercase tracking-wider font-semibold">
              Now Viewing
            </div>

            <h1 className="m-0 mb-2 text-[var(--fluid-font-2xl)] font-bold text-[var(--color-text-primary)] leading-tight">
              {currentTrack.name}
            </h1>

            <div className="text-[var(--fluid-font-lg)] text-[var(--color-text-secondary)] mb-5">
              {currentTrack.artist}
            </div>

            {/* Track Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 mt-5">
              <div>
                <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-1">
                  BPM
                </div>
                <div className="text-[var(--fluid-font-lg)] font-semibold text-[var(--color-brand-secondary)]">
                  {currentTrack.bpm}
                </div>
              </div>

              <div>
                <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-1">
                  Key
                </div>
                <div className="text-[var(--fluid-font-lg)] font-semibold text-[var(--color-brand-primary)]">
                  {currentTrack.key}
                </div>
              </div>

              <div>
                <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-1">
                  Energy
                </div>
                <div className="text-[var(--fluid-font-lg)] font-semibold text-[var(--color-text-primary)]">
                  {currentTrack.energy}/10
                </div>
              </div>

              <div>
                <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-1">
                  Genre
                </div>
                <div className="text-[var(--fluid-font-base)] font-semibold text-[var(--color-text-primary)]">
                  {currentTrack.genre}
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="mt-4">
              <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-1">
                Duration
              </div>
              <div className="text-[var(--fluid-font-base)] font-semibold text-[var(--color-text-primary)]">
                {Math.floor(currentTrack.duration / 60)}:{(currentTrack.duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

        {/* Connected Tracks Section */}
        <div className="mb-4">
          <h3 className="m-0 mb-4 text-[var(--fluid-font-lg)] font-bold text-[var(--color-text-primary)]">
            Connected Tracks ({connectedTracks.length})
          </h3>

          {connectedTracks.length === 0 ? (
            <div className="p-8 text-center bg-[var(--color-bg-elevated-1)] rounded-[var(--radius-lg)] text-[var(--color-text-secondary)]">
              <div className="text-4xl mb-3">🔗</div>
              <p className="m-0">No connected tracks found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3" data-testid="connected-tracks-list">
              {connectedTracks.map(({ track, connectionStrength }) => (
                <button
                  key={track.id}
                  onClick={() => navigateToTrack(track.id, track.name)}
                  className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-border-subtle)] rounded-[var(--radius-card)] text-[var(--color-text-primary)] text-left cursor-pointer transition-all relative hover:bg-[var(--color-card-hover)] min-h-[56px]"
                  data-testid={`connected-track-${track.id}`}
                >
                  {/* Connection Strength Indicator */}
                  <div className="absolute top-3 right-3 px-2 py-1 bg-[var(--color-brand-primary-muted)] border border-[var(--color-brand-primary)] rounded-[var(--radius-badge)] text-[var(--fluid-font-xs)] font-bold text-[var(--color-brand-primary)]">
                    {Math.round(connectionStrength * 100)}%
                  </div>

                  <div className="text-[var(--fluid-font-base)] font-semibold mb-1 pr-16">
                    {track.name}
                  </div>

                  <div className="text-[var(--fluid-font-sm)] text-[var(--color-text-secondary)] mb-2">
                    {track.artist}
                  </div>

                  <div className="flex gap-3 text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)]">
                    <span>{track.bpm} BPM</span>
                    <span>•</span>
                    <span>{track.key}</span>
                    <span>•</span>
                    <span>Energy {track.energy}/10</span>
                  </div>

                  {/* Navigate Arrow */}
                  <div className="absolute right-4 bottom-4 text-lg text-[var(--color-brand-secondary)]">
                    →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Breadcrumb Trail */}
        {navigationHistory.length > 0 && (
          <div className="mt-6 p-4 bg-[var(--color-bg-elevated-1)] rounded-[var(--radius-lg)]">
            <div className="text-[var(--fluid-font-xs)] text-[var(--color-text-tertiary)] mb-3 uppercase tracking-wider font-semibold">
              Navigation Trail
            </div>

            <div className="flex flex-col gap-2">
              {navigationHistory.map((item, index) => (
                <div
                  key={`${item.trackId}-${index}`}
                  className="text-[var(--fluid-font-sm)] text-[var(--color-text-secondary)]"
                  style={{ paddingLeft: `${index * 16}px` }}
                >
                  {index > 0 && <span className="mr-2">↳</span>}
                  {item.trackName}
                </div>
              ))}
              <div
                className="text-[var(--fluid-font-sm)] text-[var(--color-brand-primary)] font-semibold"
                style={{ paddingLeft: `${navigationHistory.length * 16}px` }}
              >
                <span className="mr-2">↳</span>
                {currentTrack?.name} (current)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileTrackExplorer;
