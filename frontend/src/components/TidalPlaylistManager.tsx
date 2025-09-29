import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Track } from '../types';

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

const TIDAL_API_BASE = 'http://localhost:8085';

export const TidalPlaylistManager: React.FC = () => {
  const { currentSetlist } = useStore();
  const [playlists, setPlaylists] = useState<TidalPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [trackAvailability, setTrackAvailability] = useState<Map<string, TidalTrackResponse | null>>(new Map());
  const [authStatus, setAuthStatus] = useState<{authenticated: boolean; message?: string; status?: string}>({authenticated: false});
  const [oauthData, setOauthData] = useState<{auth_url?: string; user_code?: string; instructions?: string} | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  const isAuthenticated = authStatus.authenticated;

  // CRITICAL: Add ref to avoid closure issues with polling and setTimeout
  const authStatusRef = useRef<{authenticated: boolean; message?: string; status?: string}>({authenticated: false});

  // Check Tidal authentication status
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await fetch(`${TIDAL_API_BASE}/auth/status`);
        const data = await response.json();
        setAuthStatus(data);
        authStatusRef.current = data; // Update ref to avoid closure issues
      } catch (error) {
        console.error('Failed to check auth status:', error);
        setAuthStatus({authenticated: false, message: 'Service unavailable'});
      }
    };

    checkAuthStatus();
  }, []);

  // Start OAuth authentication
  const startOAuthFlow = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${TIDAL_API_BASE}/auth/start-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        if (result.authenticated) {
          // Already authenticated
          setAuthStatus({authenticated: true, message: result.message});
          loadPlaylists();
        } else {
          // Need to complete OAuth flow
          setOauthData({
            auth_url: result.auth_url,
            user_code: result.user_code,
            instructions: result.instructions
          });

          // Start polling for completion
          startAuthPolling();
        }
      } else {
        setError(result.message || 'Failed to start OAuth flow');
      }
    } catch (error) {
      setError('Failed to start OAuth authentication');
      console.error('OAuth start error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for OAuth completion
  const startAuthPolling = () => {
    setIsCheckingAuth(true);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${TIDAL_API_BASE}/auth/check-oauth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const result = await response.json();

        if (result.success && result.authenticated) {
          clearInterval(pollInterval);
          setIsCheckingAuth(false);
          setOauthData(null);
          const newAuthStatus = {authenticated: true, message: result.message};
          setAuthStatus(newAuthStatus);
          authStatusRef.current = newAuthStatus; // Update ref
          loadPlaylists();
        }
      } catch (error) {
        console.error('OAuth polling error:', error);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsCheckingAuth(false);
      // CRITICAL FIX: Use ref instead of state to avoid stale closure
      if (!authStatusRef.current.authenticated) {
        setError('Authentication timed out. Please try again.');
        setOauthData(null);
      }
    }, 300000);
  };

  // Load user playlists
  const loadPlaylists = async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${TIDAL_API_BASE}/playlists/list`);

      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      } else {
        setError('Failed to load playlists');
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
      if (!currentSetlist || !isAuthenticated) return;

      const availabilityMap = new Map<string, TidalTrackResponse | null>();

      for (const setlistTrack of currentSetlist.tracks) {
        const track = setlistTrack.track;
        try {
          const response = await fetch(`${TIDAL_API_BASE}/tracks/check-availability`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              song_id: track.id,
              artist: track.artist,
              title: track.title || track.name, // Support both title and name
              isrc: track.isrc,
            }),
          });

          if (response.ok) {
            const tidalTrack = await response.json();
            availabilityMap.set(track.id, tidalTrack);
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
  }, [currentSetlist, isAuthenticated]);

  // Create playlist from current setlist
  const createPlaylistFromSetlist = async () => {
    if (!currentSetlist || !isAuthenticated) {
      setError('No setlist selected or not authenticated');
      return;
    }

    try {
      setIsLoading(true);
      const name = playlistName || `${currentSetlist.name} - SongNodes`;

      const response = await fetch(`${TIDAL_API_BASE}/playlists/from-setlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          setlist_id: currentSetlist.id,
          playlist_name: name,
          track_ids: currentSetlist.tracks.map(t => t.track.id),
        }),
      });

      if (response.ok) {
        const newPlaylist = await response.json();
        setPlaylists(prev => [...prev, newPlaylist]);
        setPlaylistName('');
        setPlaylistDescription('');
        setError(null);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to create playlist');
      }
    } catch (error) {
      setError('Failed to create playlist');
      console.error('Create playlist error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create empty playlist
  const createEmptyPlaylist = async () => {
    if (!isAuthenticated || !playlistName.trim()) {
      setError('Please enter a playlist name');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${TIDAL_API_BASE}/playlists/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playlistName.trim(),
          description: playlistDescription.trim(),
          public: false,
        }),
      });

      if (response.ok) {
        const newPlaylist = await response.json();
        setPlaylists(prev => [...prev, newPlaylist]);
        setPlaylistName('');
        setPlaylistDescription('');
        setError(null);
      } else {
        const errorData = await response.json();
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

  // No need to check for credentials since we use OAuth now

  return (
    <div className="space-y-6">
      {/* Authentication Status */}
      <div className={`p-3 rounded-lg ${isAuthenticated ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`text-sm font-medium ${isAuthenticated ? 'text-green-800' : 'text-red-800'}`}>
            {isAuthenticated ? 'Connected to Tidal' : 'Not connected to Tidal'}
          </span>
        </div>
        {authStatus.message && (
          <p className={`mt-1 text-xs ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
            {authStatus.message}
          </p>
        )}

        {/* OAuth Authentication Button */}
        {!isAuthenticated && !oauthData && !isCheckingAuth && (
          <button
            onClick={startOAuthFlow}
            disabled={isLoading}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : 'Connect to Tidal'}
          </button>
        )}
      </div>

      {/* OAuth Instructions */}
      {oauthData && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-3">Complete Tidal Authentication</h3>
          <div className="space-y-3">
            <div>
              <p className="text-blue-800 text-sm mb-2">
                Click the link below to authenticate with Tidal:
              </p>
              <a
                href={oauthData.auth_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Open Tidal Authentication
              </a>
            </div>
            {oauthData.user_code && (
              <div className="p-3 bg-white border border-blue-300 rounded">
                <p className="text-blue-800 text-sm mb-1">Enter this code when prompted:</p>
                <code className="text-lg font-mono text-blue-900 font-bold">{oauthData.user_code}</code>
              </div>
            )}
            {oauthData.instructions && (
              <p className="text-blue-700 text-xs">{oauthData.instructions}</p>
            )}
          </div>
        </div>
      )}

      {/* Checking Authentication Status */}
      {isCheckingAuth && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-600"></div>
            <span className="text-yellow-800 text-sm">
              Waiting for authentication... Please complete the process in your browser.
            </span>
          </div>
        </div>
      )}

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
                <p className="text-green-600">Available on Tidal: {stats.available}</p>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Created with SongNodes"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={createEmptyPlaylist}
                disabled={isLoading || !playlistName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Empty Playlist'}
              </button>

              {currentSetlist && (
                <button
                  onClick={createPlaylistFromSetlist}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <h3 className="font-medium text-gray-900">Your Tidal Playlists</h3>
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
                    <h4 className="font-medium text-gray-900">{playlist.name}</h4>
                    <p className="text-sm text-gray-600">
                      {playlist.track_count} tracks • {Math.floor(playlist.duration / 60)}:{(playlist.duration % 60).toString().padStart(2, '0')}
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
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Open in Tidal
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

export default TidalPlaylistManager;