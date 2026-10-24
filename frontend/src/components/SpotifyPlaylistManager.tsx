import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Track } from '../types';
import { ServicePlaylistView } from './ServicePlaylistView';
import { showToast } from './ds';
import { API_BASE_URL } from '../lib/apiBase';

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

const REST_API_BASE = API_BASE_URL;

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
      showToast(`Playlist created: “${name}”, ${spotifyTrackIds.length} tracks`);
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

  return (
    <ServicePlaylistView
      service="Spotify"
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
      playlists={playlists.map((p) => ({ id: String(p.id), name: p.name, description: p.description, trackCount: p.track_count, url: p.url, tags: [...(!p.public ? ['Private'] : []), ...(p.collaborative ? ['Collaborative'] : [])] }))}
      extraFields={
        <label className="sn-checkbox">
          <input type="checkbox" checked={playlistPublic} onChange={(e) => setPlaylistPublic(e.target.checked)} />
          <span className="sn-checkbox__text"><span>Make the playlist public</span></span>
        </label>
      }
    />
  );
};

export default SpotifyPlaylistManager;
