import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from './ui';

interface TidalPlaylist {
  id: string;
  name: string;
  description: string;
  track_count: number;
  duration: number;
  public: boolean;
  url?: string;
  created_at?: string;
}

interface TidalTrackResponse {
  id: number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  isrc?: string;
  explicit: boolean;
  available: boolean;
  url?: string;
}

const REST_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';
const TIDAL_BRAND_CYAN = '#00E5FF';

export const TidalPlaylistManager: React.FC = () => {
  const { currentSetlist, musicCredentials } = useStore();
  const [playlists, setPlaylists] = useState<TidalPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [trackAvailability, setTrackAvailability] = useState<Map<string, TidalTrackResponse | null>>(new Map());

  // Use existing Tidal authentication from Zustand (Settings Panel)
  const isAuthenticated = !!(musicCredentials.tidal?.accessToken && musicCredentials.tidal?.isConnected);

  // CRITICAL: Add ref to avoid closure issues with polling and setTimeout
  const authStatusRef = useRef<{authenticated: boolean; message?: string; status?: string}>({authenticated: false});

  // Check Tidal authentication status from Zustand
  useEffect(() => {
    // Update auth status based on Zustand credentials
    const authenticated = !!(musicCredentials.tidal?.accessToken && musicCredentials.tidal?.isConnected);
    const status = {
      authenticated,
      message: authenticated
        ? 'Connected via Settings Panel'
        : 'Connect Tidal in Settings to use playlists'
    };
    authStatusRef.current = status;

    // Auto-load playlists when authenticated
    if (authenticated) {
      loadPlaylists();
    }
  }, [musicCredentials.tidal]);

  // Redirect to Settings Panel for authentication
  const openSettings = () => {
    // Emit event to open Settings Panel (parent component handles this)
    window.dispatchEvent(new CustomEvent('openSettings'));
  };

  // Load user playlists
  const loadPlaylists = async () => {
    if (!isAuthenticated || !musicCredentials.tidal?.accessToken) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${REST_API_BASE}/api/v1/tidal/playlists/list`, {
        headers: {
          'Authorization': `Bearer ${musicCredentials.tidal.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to load playlists' }));
        setError(errorData.detail || 'Failed to load playlists');
      }
    } catch (error) {
      setError('Failed to load playlists');
      console.error('Load playlists error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check track availability for current setlist
  useEffect(() => {
    const checkTrackAvailability = async () => {
      if (!currentSetlist || !isAuthenticated || !musicCredentials.tidal?.accessToken) return;

      const availabilityMap = new Map<string, TidalTrackResponse | null>();

      for (const setlistTrack of currentSetlist.tracks) {
        const track = setlistTrack.track;
        try {
          const response = await fetch(`${REST_API_BASE}/api/v1/tidal/tracks/check-availability`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${musicCredentials.tidal.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              artist: track.artist,
              title: track.title || track.name, // Support both title and name
              isrc: track.isrc,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            availabilityMap.set(track.id, result.track);
          } else {
            availabilityMap.set(track.id, null);
          }
        } catch (error) {
          console.error(`Failed to check availability for ${track.artist} - ${track.title}:`, error);
          availabilityMap.set(track.id, null);
        }
      }

      setTrackAvailability(availabilityMap);
    };

    if (currentSetlist && isAuthenticated) {
      checkTrackAvailability();
    }
  }, [currentSetlist, isAuthenticated, musicCredentials.tidal?.accessToken]);

  // Create playlist from current setlist
  const createPlaylistFromSetlist = async () => {
    if (!currentSetlist || !isAuthenticated || !musicCredentials.tidal?.accessToken) {
      setError('No setlist selected or not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      const name = playlistName || `${currentSetlist.name} - SongNodes`;

      // Step 1: Create the playlist
      const createResponse = await fetch(`${REST_API_BASE}/api/v1/tidal/playlists/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${musicCredentials.tidal.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          description: playlistDescription || `Created from ${currentSetlist.name}`,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ detail: 'Failed to create playlist' }));
        throw new Error(errorData.detail || 'Failed to create playlist');
      }

      const newPlaylist = await createResponse.json();

      // Step 2: Search for tracks and collect Tidal IDs
      const tidalTrackIds: string[] = [];
      for (const setlistTrack of currentSetlist.tracks) {
        const track = setlistTrack.track;
        const searchResponse = await fetch(`${REST_API_BASE}/api/v1/tidal/tracks/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${musicCredentials.tidal.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artist: track.artist,
            title: track.title || track.name,
            isrc: track.isrc,
          }),
        });

        if (searchResponse.ok) {
          const tidalTrack = await searchResponse.json();
          if (tidalTrack?.id) {
            tidalTrackIds.push(tidalTrack.id.toString());
          }
        }
      }

      // Step 3: Add tracks to playlist
      if (tidalTrackIds.length > 0) {
        await fetch(`${REST_API_BASE}/api/v1/tidal/playlists/${newPlaylist.id}/tracks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${musicCredentials.tidal.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            track_ids: tidalTrackIds,
            position: 0,
            allow_duplicates: false,
          }),
        });
      }

      setPlaylists(prev => [...prev, newPlaylist]);
      setPlaylistName('');
      setPlaylistDescription('');
      setError(null);
      alert(`✅ Created playlist "${name}" with ${tidalTrackIds.length} tracks!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create playlist';
      setError(message);
      console.error('Create playlist error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create empty playlist
  const createEmptyPlaylist = async () => {
    if (!isAuthenticated || !playlistName.trim() || !musicCredentials.tidal?.accessToken) {
      setError('Please enter a playlist name');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${REST_API_BASE}/api/v1/tidal/playlists/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${musicCredentials.tidal.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName.trim(),
          description: playlistDescription.trim(),
        }),
      });

      if (response.ok) {
        const newPlaylist = await response.json();
        setPlaylists(prev => [...prev, newPlaylist]);
        setPlaylistName('');
        setPlaylistDescription('');
        setError(null);
        alert(`✅ Created playlist "${playlistName.trim()}"!`);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to create playlist' }));
        setError(errorData.detail || 'Failed to create playlist');
      }
    } catch (error) {
      setError('Failed to create playlist');
      console.error('Create playlist error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailabilityStats = () => {
    if (!currentSetlist) return { total: 0, available: 0, unavailable: 0 };

    const total = currentSetlist.tracks.length;
    let available = 0;
    let unavailable = 0;

    currentSetlist.tracks.forEach(setlistTrack => {
      const availability = trackAvailability.get(setlistTrack.track.id);
      if (availability) {
        available++;
      } else {
        unavailable++;
      }
    });

    return { total, available, unavailable };
  };

  const stats = getAvailabilityStats();

  return (
    <div className="space-y-6">
      {/* Authentication Status */}
      <Card className="border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: isAuthenticated ? TIDAL_BRAND_CYAN : 'var(--color-warning)' }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Tidal Integration</h3>
                  <Badge
                    variant={isAuthenticated ? 'success' : 'warning'}
                    size="sm"
                  >
                    {isAuthenticated ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {isAuthenticated
                    ? 'Authentication managed via Settings Panel'
                    : 'Connect Tidal in Settings to enable playlist features'}
                </p>
              </div>
            </div>

            {!isAuthenticated && (
              <Button
                onClick={openSettings}
                size="sm"
                className="bg-[#00E5FF] hover:bg-[#33ebff] text-black font-semibold"
              >
                Connect Tidal
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-[var(--radius-card)]">
          <p className="text-[var(--color-error)] text-sm">{error}</p>
        </div>
      )}

      {/* Current Setlist Status */}
      {currentSetlist && (
        <Card className="border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base text-[var(--color-text-primary)]">
              Current Setlist: {currentSetlist.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
              <span>Total tracks: {stats.total}</span>
              {isAuthenticated && trackAvailability.size > 0 && (
                <div className="flex gap-2">
                  <Badge variant="success" size="sm">{stats.available} Available</Badge>
                  <Badge variant="error" size="sm">{stats.unavailable} Missing</Badge>
                </div>
              )}
            </div>

            {isAuthenticated && trackAvailability.size > 0 && (
              <div className="w-full bg-[var(--color-bg-elevated-3)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 transition-all duration-300"
                  style={{
                    width: `${stats.total > 0 ? (stats.available / stats.total) * 100 : 0}%`,
                    backgroundColor: TIDAL_BRAND_CYAN
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Playlist Creation */}
      {isAuthenticated && (
        <Card className="border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base text-[var(--color-text-primary)]">Create New Playlist</CardTitle>
          </CardHeader>

          <CardContent className="p-4 pt-2 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Playlist Name
              </label>
              <Input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="My Awesome Playlist"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Description (optional)
              </label>
              <textarea
                value={playlistDescription}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-[var(--radius-input)] text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:outline-none focus:border-[var(--color-border-focus)] text-sm"
                rows={2}
                placeholder="Created with SongNodes"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={createEmptyPlaylist}
                loading={isLoading}
                disabled={!playlistName.trim()}
                variant="secondary"
              >
                Create Empty Playlist
              </Button>

              {currentSetlist && (
                <Button
                  onClick={createPlaylistFromSetlist}
                  loading={isLoading}
                  className="bg-[#00E5FF] hover:bg-[#33ebff] text-black font-semibold"
                >
                  Create from Setlist
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Playlists */}
      {isAuthenticated && (
        <Card className="border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-[var(--color-text-primary)]">Your Tidal Playlists</CardTitle>
            <Button
              onClick={loadPlaylists}
              loading={isLoading}
              variant="outline"
              size="sm"
            >
              Refresh
            </Button>
          </CardHeader>

          <CardContent className="p-4 pt-2">
            {playlists.length === 0 ? (
              <p className="text-[var(--color-text-disabled)] text-sm">No playlists found</p>
            ) : (
              <div className="space-y-2">
                {playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated-2)] border border-[var(--color-card-border)] rounded-[var(--radius-card)]"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <h4 className="font-medium text-sm text-[var(--color-text-primary)] truncate">{playlist.name}</h4>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {playlist.track_count} tracks • {Math.floor(playlist.duration / 60)}:{(playlist.duration % 60).toString().padStart(2, '0')}
                      </p>
                      {playlist.description && (
                        <p className="text-xs text-[var(--color-text-disabled)] mt-1 truncate">{playlist.description}</p>
                      )}
                    </div>
                    {playlist.url && (
                      <a
                        href={playlist.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button
                          size="sm"
                          className="bg-[#00E5FF] hover:bg-[#33ebff] text-black font-semibold"
                        >
                          Open in Tidal
                        </Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TidalPlaylistManager;
