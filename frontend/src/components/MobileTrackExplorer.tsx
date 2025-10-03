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
    return (graphData?.nodes || []).map(node => ({
      id: node.id,
      name: node.title || node.metadata?.title || node.label || 'Unknown Track',
      artist: node.artist || node.metadata?.artist || 'Unknown Artist',
      bpm: node.metadata?.bpm || 120,
      key: node.metadata?.key || node.metadata?.camelotKey || '1A',
      energy: node.metadata?.energy || 5,
      duration: node.metadata?.duration || 180,
      genre: node.metadata?.genre || 'Electronic',
      album: node.metadata?.album,
      year: node.metadata?.year,
    }));
  }, [graphData?.nodes]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return allTracks
      .filter(track =>
        track.name.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.genre?.toLowerCase().includes(query)
      )
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
          connectedId = typeof edge.target === 'string' ? edge.target : edge.target?.id;
        } else if (edge.target === currentTrackId) {
          connectedId = edge.source;
        }
      } else if (edge.source?.id === currentTrackId) {
        connectedId = typeof edge.target === 'string' ? edge.target : edge.target?.id;
      } else if (edge.target?.id === currentTrackId) {
        connectedId = typeof edge.source === 'string' ? edge.source : edge.source?.id;
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
      <div style={{
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1C1C1E',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{
            margin: '0 0 8px 0',
            color: '#F8F8F8',
            fontSize: '24px',
            fontWeight: 700,
          }}>
            Explore Tracks
          </h2>
          <p style={{
            margin: 0,
            color: '#8E8E93',
            fontSize: '14px',
          }}>
            Search for a track to start exploring connections
          </p>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="Search by track, artist, or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: '#2C2C2E',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#F8F8F8',
              fontSize: '16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            autoFocus
          />
        </div>

        {/* Search Results */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          marginRight: '-16px',
          paddingRight: '16px',
        }}>
          {searchQuery.trim() === '' ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#8E8E93',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <p style={{ margin: 0, fontSize: '16px' }}>Start typing to search</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                {allTracks.length} tracks available
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#8E8E93',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
              <p style={{ margin: 0, fontSize: '16px' }}>No tracks found</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                Try a different search term
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.map(track => (
                <button
                  key={track.id}
                  onClick={() => navigateToTrack(track.id, track.name)}
                  style={{
                    padding: '12px',
                    backgroundColor: '#2C2C2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#F8F8F8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = '#3C3C3E';
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.backgroundColor = '#2C2C2E';
                  }}
                >
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '4px',
                  }}>
                    {track.name}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#8E8E93',
                  }}>
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
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1C1C1E',
      overflow: 'hidden',
    }}>
      {/* Navigation Bar */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#2C2C2E',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          onClick={navigateBack}
          style={{
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#007AFF',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '18px' }}>←</span>
          Back
        </button>

        <button
          onClick={resetNavigation}
          style={{
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#007AFF',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          🔍 Search
        </button>

        <div style={{ flex: 1 }} />

        {navigationHistory.length > 0 && (
          <div style={{
            fontSize: '12px',
            color: '#8E8E93',
          }}>
            {navigationHistory.length} deep
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }}>
        {/* Current Track Card (Large) */}
        {currentTrack && (
          <div style={{
            padding: '24px',
            backgroundColor: '#2C2C2E',
            border: '2px solid rgba(126,211,33,0.5)',
            borderRadius: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              fontSize: '12px',
              color: '#8E8E93',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Now Viewing
            </div>

            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: 700,
              color: '#F8F8F8',
              lineHeight: 1.3,
            }}>
              {currentTrack.name}
            </h1>

            <div style={{
              fontSize: '18px',
              color: '#8E8E93',
              marginBottom: '20px',
            }}>
              {currentTrack.artist}
            </div>

            {/* Track Metadata Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginTop: '20px',
            }}>
              <div>
                <div style={{ fontSize: '12px', color: '#8E8E93', marginBottom: '4px' }}>
                  BPM
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#F8F8F8' }}>
                  {currentTrack.bpm}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#8E8E93', marginBottom: '4px' }}>
                  Key
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#F8F8F8' }}>
                  {currentTrack.key}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#8E8E93', marginBottom: '4px' }}>
                  Energy
                </div>
                <div style={{ fontSize: '20px', fontWeight: 600, color: '#F8F8F8' }}>
                  {currentTrack.energy}/10
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#8E8E93', marginBottom: '4px' }}>
                  Genre
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#F8F8F8' }}>
                  {currentTrack.genre}
                </div>
              </div>
            </div>

            {/* Duration */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8E8E93', marginBottom: '4px' }}>
                Duration
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#F8F8F8' }}>
                {Math.floor(currentTrack.duration / 60)}:{(currentTrack.duration % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}

        {/* Connected Tracks Section */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: 700,
            color: '#F8F8F8',
          }}>
            Connected Tracks ({connectedTracks.length})
          </h3>

          {connectedTracks.length === 0 ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              backgroundColor: '#2C2C2E',
              borderRadius: '12px',
              color: '#8E8E93',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔗</div>
              <p style={{ margin: 0 }}>No connected tracks found</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {connectedTracks.map(({ track, connectionStrength }) => (
                <button
                  key={track.id}
                  onClick={() => navigateToTrack(track.id, track.name)}
                  style={{
                    padding: '16px',
                    backgroundColor: '#2C2C2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#F8F8F8',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.backgroundColor = '#3C3C3E';
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.backgroundColor = '#2C2C2E';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {/* Connection Strength Indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 8px',
                    backgroundColor: `rgba(126, 211, 33, ${Math.min(connectionStrength, 1)})`,
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#000',
                  }}>
                    {Math.round(connectionStrength * 100)}%
                  </div>

                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    marginBottom: '6px',
                    paddingRight: '60px', // Space for strength indicator
                  }}>
                    {track.name}
                  </div>

                  <div style={{
                    fontSize: '14px',
                    color: '#8E8E93',
                    marginBottom: '8px',
                  }}>
                    {track.artist}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '12px',
                    fontSize: '12px',
                    color: '#8E8E93',
                  }}>
                    <span>{track.bpm} BPM</span>
                    <span>•</span>
                    <span>{track.key}</span>
                    <span>•</span>
                    <span>Energy {track.energy}/10</span>
                  </div>

                  {/* Navigate Arrow */}
                  <div style={{
                    position: 'absolute',
                    right: '16px',
                    bottom: '16px',
                    fontSize: '18px',
                    color: '#007AFF',
                  }}>
                    →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Breadcrumb Trail */}
        {navigationHistory.length > 0 && (
          <div style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: '#2C2C2E',
            borderRadius: '12px',
          }}>
            <div style={{
              fontSize: '12px',
              color: '#8E8E93',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Navigation Trail
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {navigationHistory.map((item, index) => (
                <div
                  key={`${item.trackId}-${index}`}
                  style={{
                    fontSize: '14px',
                    color: '#8E8E93',
                    paddingLeft: `${index * 16}px`,
                  }}
                >
                  {index > 0 && <span style={{ marginRight: '8px' }}>↳</span>}
                  {item.trackName}
                </div>
              ))}
              <div
                style={{
                  fontSize: '14px',
                  color: '#7ED321',
                  fontWeight: 600,
                  paddingLeft: `${navigationHistory.length * 16}px`,
                }}
              >
                <span style={{ marginRight: '8px' }}>↳</span>
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
