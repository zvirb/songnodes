import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Track } from '../types';

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
  const authStatusRef = useRef<{authenticated: boolean}>({authenticated: false});

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
        // Split into chunks of 100
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
      <div className={`p-3 rounded-lg ${isAuthenticated ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className={`text-sm font-medium ${isAuthenticated ? 'text-green-800' : 'text-yellow-800'}`}>
            {isAuthenticated ? 'Connected to Spotify' : 'Not connected to Spotify'}
          </span>
        </div>
        <p className={`mt-1 text-xs ${isAuthenticated ? 'text-green-600' : 'text-yellow-600'}`}>
          {isAuthenticated
            ? 'Authentication managed via Settings Panel'
            : 'Connect Spotify in Settings to use playlist features'}
        </p>

        {/* Link to Settings Panel */}
        {!isAuthenticated && (
          <button
            onClick={openSettings}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            Open Settings to Connect Spotify
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Current Setlist Status */}
      {currentSetlist && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-2">Current Setlist: {currentSetlist.name}</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>Total tracks: {stats.total}</p>
            {isAuthenticated && trackAvailability.size > 0 && (
              <>
                <p className="text-green-600">Available on Spotify: {stats.available}</p>
                <p className="text-red-600">Not available: {stats.unavailable}</p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(stats.available / stats.total) * 100}%` }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Playlist Creation */}
      {isAuthenticated && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-900 mb-4">Create New Playlist</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Playlist Name
              </label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="My Awesome Playlist"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={playlistDescription}
                onChange={(e) => setPlaylistDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="playlist-public" className="text-sm text-gray-700">
                Make playlist public
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createEmptyPlaylist}
                disabled={isLoading || !playlistName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Empty Playlist'}
              </button>

              {currentSetlist && (
                <button
                  onClick={createPlaylistFromSetlist}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create from Setlist'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Playlists */}
      {isAuthenticated && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Your Spotify Playlists</h3>
            <button
              onClick={loadPlaylists}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {playlists.length === 0 ? (
            <p className="text-gray-500 text-sm">No playlists found</p>
          ) : (
            <div className="space-y-2">
              {playlists.map((playlist) => (
                <div key={playlist.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{playlist.name}</h4>
                      {!playlist.public && (
                        <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">Private</span>
                      )}
                      {playlist.collaborative && (
                        <span className="px-2 py-0.5 text-xs bg-blue-200 text-blue-600 rounded">Collaborative</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {playlist.track_count} tracks
                    </p>
                    {playlist.description && (
                      <p className="text-xs text-gray-500 mt-1">{playlist.description}</p>
                    )}
                  </div>
                  {playlist.url && (
                    <a
                      href={playlist.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Open in Spotify
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifyPlaylistManager;
