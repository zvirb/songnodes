import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Input } from './ui';

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  track_count: number;
  public: boolean;
  collaborative: boolean;
  url?: string;
  snapshot_id?: string;
}

interface SpotifyTrackResponse {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration_ms: number;
  isrc?: string;
  explicit: boolean;
  uri: string;
  url?: string;
}

const REST_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082';

export const SpotifyPlaylistManager: React.FC = () => {
  const { currentSetlist, musicCredentials } = useStore();
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [playlistPublic, setPlaylistPublic] = useState(true);
  const [trackAvailability, setTrackAvailability] = useState<Map<string, SpotifyTrackResponse | null>>(new Map());

  // Use existing Spotify authentication from Zustand (Settings Panel)
  const isAuthenticated = !!(musicCredentials.spotify?.accessToken);

  // CRITICAL: Add ref to avoid closure issues
  const authStatusRef = useRef<{ authenticated: boolean }>({ authenticated: false });

  // Check Spotify authentication status from Zustand
  useEffect(() => {
    const authenticated = !!musicCredentials.spotify?.accessToken;
    authStatusRef.current = { authenticated };

    // Auto-load playlists when authenticated
    if (authenticated) {
      loadPlaylists();
    }
  }, [musicCredentials.spotify]);

  // Redirect to Settings Panel for authentication
  const openSettings = () => {
    window.dispatchEvent(new CustomEvent('openSettings'));
  };

  // Load user playlists
  const loadPlaylists = async () => {
    if (!isAuthenticated || !musicCredentials.spotify?.accessToken) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${REST_API_BASE}/api/v1/spotify/playlists/list`, {
        headers: {
          'Authorization': `Bearer ${musicCredentials.spotify.accessToken}`,
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
      if (!currentSetlist || !isAuthenticated || !musicCredentials.spotify?.accessToken) return;

      const availabilityMap = new Map<string, SpotifyTrackResponse | null>();

      for (const setlistTrack of currentSetlist.tracks) {
        const track = setlistTrack.track;
        try {
          const response = await fetch(`${REST_API_BASE}/api/v1/spotify/tracks/check-availability`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${musicCredentials.spotify.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              artist: track.artist,
              title: track.title || track.name,
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
  }, [currentSetlist, isAuthenticated, musicCredentials.spotify?.accessToken]);

  // Create playlist from current setlist
  const createPlaylistFromSetlist = async () => {
    if (!currentSetlist || !isAuthenticated || !musicCredentials.spotify?.accessToken) {
      setError('No setlist selected or not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      const name = playlistName || `${currentSetlist.name} - SongNodes`;

      // Step 1: Create the playlist
      const createResponse = await fetch(`${REST_API_BASE}/api/v1/spotify/playlists/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${musicCredentials.spotify.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          description: playlistDescription || `Created from ${currentSetlist.name}`,
          public: playlistPublic,
          collaborative: false,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({ detail: 'Failed to create playlist' }));
        throw new Error(errorData.detail || 'Failed to create playlist');
      }

      const newPlaylist = await createResponse.json();

      // Step 2: Search for tracks and collect Spotify IDs
      const spotifyTrackIds: string[] = [];
      for (const setlistTrack of currentSetlist.tracks) {
        const track = setlistTrack.track;
        const searchResponse = await fetch(`${REST_API_BASE}/api/v1/spotify/tracks/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${musicCredentials.spotify.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            artist: track.artist,
            title: track.title || track.name,
            isrc: track.isrc,
          }),
        });

        if (searchResponse.ok) {
          const spotifyTrack = await searchResponse.json();
          if (spotifyTrack?.id) {
            spotifyTrackIds.push(spotifyTrack.id);
          }
        }
      }

      // Step 3: Add tracks to playlist (max 100 at a time)
      if (spotifyTrackIds.length > 0) {
        for (let i = 0; i < spotifyTrackIds.length; i += 100) {
          const chunk = spotifyTrackIds.slice(i, i + 100);
          await fetch(`${REST_API_BASE}/api/v1/spotify/playlists/${newPlaylist.id}/tracks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${musicCredentials.spotify.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              track_ids: chunk,
            }),
          });
        }
      }

      setPlaylists(prev => [...prev, newPlaylist]);
      setPlaylistName('');
      setPlaylistDescription('');
      setError(null);
      alert(`✅ Created playlist "${name}" with ${spotifyTrackIds.length} tracks!`);
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
    if (!isAuthenticated || !playlistName.trim() || !musicCredentials.spotify?.accessToken) {
      setError('Please enter a playlist name');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${REST_API_BASE}/api/v1/spotify/playlists/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${musicCredentials.spotify.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName.trim(),
          description: playlistDescription.trim(),
          public: playlistPublic,
          collaborative: false,
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
      <Card variant="default">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={isAuthenticated ? 'success' : 'warning'}>
                {isAuthenticated ? 'Connected' : 'Disconnected'}
              </Badge>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {isAuthenticated ? 'Connected to Spotify' : 'Not connected to Spotify'}
              </span>
            </div>
            {!isAuthenticated && (
              <Button size="sm" onClick={openSettings}>
                Open Settings
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
            {isAuthenticated
              ? 'Authentication managed via Settings Panel'
              : 'Connect Spotify in Settings to use playlist features'}
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)]">
          <CardContent className="p-3">
            <p className="text-[var(--color-error)] text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Current Setlist Status */}
      {currentSetlist && (
        <Card variant="elevated">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Current Setlist: {currentSetlist.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <p>Total tracks: {stats.total}</p>
            {isAuthenticated && trackAvailability.size > 0 && (
              <>
                <div className="flex gap-4">
                  <span className="text-[var(--color-success)]">Available on Spotify: {stats.available}</span>
                  <span className="text-[var(--color-error)]">Not available: {stats.unavailable}</span>
                </div>
                <div className="w-full bg-[var(--color-bg-elevated-3)] rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className="bg-[var(--color-brand-primary)] h-2 rounded-full transition-all"
                    style={{ width: `${(stats.available / Math.max(stats.total, 1)) * 100}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Playlist Creation */}
      {isAuthenticated && (
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="text-base">Create New Playlist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
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
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                Description (optional)
              </label>
              <textarea
                value={playlistDescription}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)] text-sm"
                rows={2}
                placeholder="Created with SongNodes"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="playlist-public"
                checked={playlistPublic}
                onChange={(e) => setPlaylistPublic(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-brand-primary)] border-[var(--color-border-default)] rounded"
              />
              <label htmlFor="playlist-public" className="text-sm text-[var(--color-text-secondary)] cursor-pointer">
                Make playlist public
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                onClick={createEmptyPlaylist}
                disabled={isLoading || !playlistName.trim()}
                variant="primary"
              >
                {isLoading ? 'Creating...' : 'Create Empty Playlist'}
              </Button>

              {currentSetlist && (
                <Button
                  onClick={createPlaylistFromSetlist}
                  disabled={isLoading}
                  variant="secondary"
                >
                  {isLoading ? 'Creating...' : 'Create from Setlist'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Playlists */}
      {isAuthenticated && (
        <Card variant="elevated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Your Spotify Playlists</CardTitle>
            <Button
              onClick={loadPlaylists}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </CardHeader>
          <CardContent>
            {playlists.length === 0 ? (
              <p className="text-[var(--color-text-tertiary)] text-sm">No playlists found</p>
            ) : (
              <div className="space-y-3">
                {playlists.map((playlist) => (
                  <Card key={playlist.id} variant="default" className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-[var(--color-text-primary)] text-sm">{playlist.name}</h4>
                          {!playlist.public && (
                            <Badge variant="outline" size="sm">Private</Badge>
                          )}
                          {playlist.collaborative && (
                            <Badge variant="secondary" size="sm">Collaborative</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {playlist.track_count} tracks
                        </p>
                        {playlist.description && (
                          <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">{playlist.description}</p>
                        )}
                      </div>
                      {playlist.url && (
                        <a
                          href={playlist.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-3"
                        >
                          <Button size="sm" variant="outline">
                            Open in Spotify
                          </Button>
                        </a>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SpotifyPlaylistManager;
