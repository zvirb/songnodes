import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Track } from '../types';
import { ServicePlaylistView } from './ServicePlaylistView';
import { showToast } from './ds';
import { API_BASE_URL } from '../lib/apiBase';

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

const REST_API_BASE = API_BASE_URL;

export const TidalPlaylistManager: React.FC = () => {
  const { currentSetlist, musicCredentials } = useStore();
  const [playlists, setPlaylists] = useState<TidalPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [trackAvailability, setTrackAvailability] = useState<Map<string, TidalTrackResponse | null>>(new Map());
  const [oauthData, setOauthData] = useState<{auth_url?: string; user_code?: string; instructions?: string} | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

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
        : 'Connect TIDAL in Settings to use playlists'
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
      showToast(`Playlist created: “${name}”, ${tidalTrackIds.length} tracks`);
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
        showToast(`Playlist created: “${playlistName.trim()}”`);
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

  // No need to check for credentials since we use OAuth now

  return (
    <ServicePlaylistView
      service="TIDAL"
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
      error={error}
      setlistName={currentSetlist?.name}
      stats={currentSetlist ? { ...stats, checked: isAuthenticated && trackAvailability.size > 0 } : undefined}
      playlistName={playlistName}
      playlistDescription={playlistDescription}
      onNameChange={setPlaylistName}
      onDescriptionChange={setPlaylistDescription}
      onConnect={openSettings}
      onCreateEmpty={createEmptyPlaylist}
      onCreateFromSetlist={currentSetlist ? createPlaylistFromSetlist : undefined}
      onRefresh={loadPlaylists}
      playlists={playlists.map((p) => ({ id: String(p.id), name: p.name, description: p.description, trackCount: p.track_count, duration: p.duration, url: p.url }))}
    />
  );
};

export default TidalPlaylistManager;