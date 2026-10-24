import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Check, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Button, Input, Badge } from './ui';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface TrackWithoutArtist {
  track_id: string;
  title: string;
  normalized_title: string | null;
  source: string | null;
  playlist_count: number;
  adjacency_count: number;
}

interface ArtistSearchResult {
  artist_id: string;
  name: string;
  normalized_name: string;
  spotify_id: string | null;
  musicbrainz_id: string | null;
  genres: string[] | null;
  match_score: number;
  track_count: number;
}

interface DirtyArtist {
  artist_id: string;
  current_name: string;
  suggested_clean_name: string;
  track_count: number;
  has_conflict: boolean;
  pattern_type: string;
}

// ============================================================================
// Main Component
// ============================================================================

interface ArtistAttributionManagerProps {
  onClose: () => void;
}

export const ArtistAttributionManager: React.FC<ArtistAttributionManagerProps> = ({ onClose }) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'missing' | 'dirty'>('missing');

  // State for tracks missing artists
  const [tracks, setTracks] = useState<TrackWithoutArtist[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<TrackWithoutArtist | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());

  // State for dirty artists
  const [dirtyArtists, setDirtyArtists] = useState<DirtyArtist[]>([]);
  const [selectedDirtyArtist, setSelectedDirtyArtist] = useState<DirtyArtist | null>(null);

  // State for artist search
  const [searchQuery, setSearchQuery] = useState('');
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<ArtistSearchResult | null>(null);

  // State for new artist creation
  const [showCreateArtist, setShowCreateArtist] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<'importance' | 'alphabetical'>('importance');
  const ITEMS_PER_PAGE = 50;

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = page * ITEMS_PER_PAGE;
      const response = await fetch(
        `/api/v1/tracks/missing-artist?limit=${ITEMS_PER_PAGE}&offset=${offset}&sort_by=${sortBy}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tracks: ${response.statusText}`);
      }

      const data = await response.json();
      setTracks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tracks');
      console.error('Error fetching tracks:', err);
    } finally {
      setLoading(false);
    }
  }, [page, sortBy]);

  const searchArtists = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setArtistResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/artists/search?query=${encodeURIComponent(query)}&limit=20`
      );

      if (!response.ok) {
        throw new Error(`Failed to search artists: ${response.statusText}`);
      }

      const data = await response.json();
      setArtistResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search artists');
      console.error('Error searching artists:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  const fetchDirtyArtists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = page * ITEMS_PER_PAGE;
      const response = await fetch(
        `/api/v1/artists/dirty?limit=${ITEMS_PER_PAGE}&offset=${offset}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch dirty artists: ${response.statusText}`);
      }

      const data = await response.json();
      setDirtyArtists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dirty artists');
      console.error('Error fetching dirty artists:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  // ============================================================================
  // Artist Assignment
  // ============================================================================

  const assignArtistToTrack = async (trackId: string, artistId: string, artistName: string) => {
    setAssigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/tracks/${trackId}/assign-artist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          track_id: trackId,
          artist_id: artistId,
          role: 'primary'
        })
      });

      if (response.status === 202) {
        // Backend accepted job
      } else if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.detail || `Server responded with ${response.status}`);
        } catch (e) {
          throw new Error(errorText.substring(0, 100) || `Server responded with ${response.status}`);
        }
      }

      setSuccessMessage(`Successfully assigned ${artistName} to track`);
      setTimeout(() => setSuccessMessage(null), 3000);

      setTracks(prevTracks => prevTracks.filter(t => t.track_id !== trackId));
      setSelectedTrack(null);
      setSearchQuery('');
      setArtistResults([]);
      setSelectedArtist(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign artist');
      console.error('Error assigning artist:', err);
    } finally {
      setAssigning(false);
    }
  };

  const assignArtistToBulk = async () => {
    if (!selectedArtist || selectedTracks.size === 0) return;

    setAssigning(true);
    setError(null);

    let successCount = 0;
    let failCount = 0;

    for (const trackId of selectedTracks) {
      try {
        const response = await fetch(`/api/v1/tracks/${trackId}/assign-artist`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            track_id: trackId,
            artist_id: selectedArtist.artist_id,
            role: 'primary'
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`Error assigning artist to track ${trackId}:`, err);
      }
    }

    setSuccessMessage(`Assigned ${selectedArtist.name} to ${successCount} tracks${failCount > 0 ? ` (${failCount} failed)` : ''}`);
    setTimeout(() => setSuccessMessage(null), 5000);

    await fetchTracks();
    setSelectedTracks(new Set());
    setSearchQuery('');
    setArtistResults([]);
    setSelectedArtist(null);
    setAssigning(false);
  };

  // ============================================================================
  // Artist Creation
  // ============================================================================

  const createArtist = async () => {
    if (newArtistName.trim().length < 2) {
      setError('Artist name must be at least 2 characters');
      return;
    }

    setAssigning(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/artists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newArtistName.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create artist');
      }

      const newArtist = await response.json();

      setSuccessMessage(`Created new artist: ${newArtist.name}`);
      setTimeout(() => setSuccessMessage(null), 3000);

      setSelectedArtist({
        artist_id: newArtist.artist_id,
        name: newArtist.name,
        normalized_name: newArtist.name.toLowerCase(),
        spotify_id: null,
        musicbrainz_id: null,
        genres: null,
        match_score: 1.0,
        track_count: 0
      });

      setShowCreateArtist(false);
      setNewArtistName('');
      await searchArtists(newArtist.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create artist');
      console.error('Error creating artist:', err);
    } finally {
      setAssigning(false);
    }
  };

  // ============================================================================
  // Dirty Artist Correction
  // ============================================================================

  const applyCleanName = async (dirtyArtist: DirtyArtist) => {
    setAssigning(true);
    setError(null);

    try {
      const endpoint = dirtyArtist.has_conflict
        ? `/api/v1/artists/${dirtyArtist.artist_id}/merge`
        : `/api/v1/artists/${dirtyArtist.artist_id}/rename`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ new_name: dirtyArtist.suggested_clean_name })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${dirtyArtist.has_conflict ? 'merge' : 'rename'} artist`);
      }

      const successAction = dirtyArtist.has_conflict ? 'merged into' : 'renamed to';
      setSuccessMessage(`Successfully ${successAction}: ${dirtyArtist.current_name} → ${dirtyArtist.suggested_clean_name}`);
      setTimeout(() => setSuccessMessage(null), 3000);

      await fetchDirtyArtists();
      setSelectedDirtyArtist(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply clean name');
      console.error('Error applying clean name:', err);
    } finally {
      setAssigning(false);
    }
  };

  const deleteArtist = async (dirtyArtist: DirtyArtist) => {
    if (!confirm(`Are you sure you want to delete "${dirtyArtist.current_name}"? This will remove the artist and all its track associations.`)) {
      return;
    }

    setAssigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/artists/${dirtyArtist.artist_id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete artist');
      }

      setSuccessMessage(`Successfully deleted: ${dirtyArtist.current_name}`);
      setTimeout(() => setSuccessMessage(null), 3000);

      await fetchDirtyArtists();
      setSelectedDirtyArtist(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete artist');
      console.error('Error deleting artist:', err);
    } finally {
      setAssigning(false);
    }
  };

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (activeTab === 'missing') {
      fetchTracks();
    } else if (activeTab === 'dirty') {
      fetchDirtyArtists();
    }
  }, [activeTab, fetchTracks, fetchDirtyArtists]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchArtists(searchQuery);
      } else {
        setArtistResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery, searchArtists]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const toggleTrackSelection = (trackId: string) => {
    const newSelection = new Set(selectedTracks);
    if (newSelection.has(trackId)) {
      newSelection.delete(trackId);
    } else {
      newSelection.add(trackId);
    }
    setSelectedTracks(newSelection);
  };

  const selectAllOnPage = () => {
    const allIds = tracks.map(t => t.track_id);
    setSelectedTracks(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedTracks(new Set());
  };

  const getImportanceScore = (track: TrackWithoutArtist) => {
    return track.playlist_count + track.adjacency_count;
  };

  return (
    <div className="fixed inset-0 bg-[var(--color-bg-base)] z-[10000] flex flex-col overflow-hidden text-[var(--color-text-primary)] font-[var(--font-family-base)]">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="m-0 text-[var(--color-brand-primary)] text-2xl font-bold mb-2">
              Artist Attribution Manager
            </h2>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close manager">
            <X size={20} />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'missing' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('missing')}
          >
            Missing Artists
          </Button>
          <Button
            variant={activeTab === 'dirty' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('dirty')}
          >
            Dirty Artist Names
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="px-6 py-3 bg-[var(--color-error-bg)] border-b border-[var(--color-border-error)] text-[var(--color-error)] flex items-center gap-2 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="px-6 py-3 bg-[var(--color-success-bg)] border-b border-[var(--color-border-success)] text-[var(--color-success)] flex items-center gap-2 text-sm">
          <Check size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'missing' ? (
          <>
            {/* Left Panel - Track List */}
            <div className="w-1/2 border-r border-[var(--color-border-subtle)] flex flex-col overflow-hidden bg-[var(--color-bg-base)]">
              {/* Controls */}
              <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={sortBy === 'importance' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSortBy('importance')}
                  >
                    By Importance
                  </Button>
                  <Button
                    variant={sortBy === 'alphabetical' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setSortBy('alphabetical')}
                  >
                    Alphabetical
                  </Button>
                </div>

                <div className="flex gap-2 items-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={selectAllOnPage}
                    disabled={tracks.length === 0}
                  >
                    Select All ({tracks.length})
                  </Button>
                  {selectedTracks.size > 0 && (
                    <>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear Selection
                      </Button>
                      <Badge variant="default" size="md">
                        {selectedTracks.size} selected
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Track List */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center h-48 text-[var(--color-text-secondary)] gap-2">
                    <Loader2 size={20} className="animate-spin" />
                    <span>Loading tracks...</span>
                  </div>
                ) : tracks.length === 0 ? (
                  <div className="text-center p-10 text-[var(--color-text-secondary)]">
                    🎉 No tracks missing artist attribution!
                  </div>
                ) : (
                  tracks.map((track) => (
                    <div
                      key={track.track_id}
                      onClick={() => setSelectedTrack(track)}
                      className={`p-3 rounded-[var(--radius-card)] border cursor-pointer transition-colors flex items-start gap-3 ${
                        selectedTrack?.track_id === track.track_id
                          ? 'bg-[var(--color-brand-primary-muted)] border-[var(--color-brand-primary)]'
                          : 'bg-[var(--color-bg-elevated-1)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated-2)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTracks.has(track.track_id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleTrackSelection(track.track_id);
                        }}
                        className="mt-1 cursor-pointer w-4 h-4 rounded border-[var(--color-border-default)]"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate mb-1">
                          {track.title}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] flex gap-3 flex-wrap">
                          <span>📊 Importance: {getImportanceScore(track)}</span>
                          <span>📝 Playlists: {track.playlist_count}</span>
                          {track.source && <span>🔗 {track.source}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] flex gap-2 justify-center items-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <div className="text-xs text-[var(--color-text-secondary)] px-3">
                  Page {page + 1}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={tracks.length < ITEMS_PER_PAGE}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Right Panel - Artist Search & Assignment */}
            <div className="w-1/2 flex flex-col overflow-hidden bg-[var(--color-bg-base)]">
              {/* Search Bar */}
              <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] space-y-3">
                <Input
                  leftIcon={<Search size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for artists..."
                  disabled={!selectedTrack && selectedTracks.size === 0}
                />

                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setShowCreateArtist(!showCreateArtist)}
                  disabled={!selectedTrack && selectedTracks.size === 0}
                  leftIcon={<Plus size={16} />}
                >
                  Create New Artist
                </Button>
              </div>

              {/* Create Artist Form */}
              {showCreateArtist && (
                <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-2)] space-y-3">
                  <Input
                    value={newArtistName}
                    onChange={(e) => setNewArtistName(e.target.value)}
                    placeholder="Enter artist name..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={createArtist}
                      disabled={assigning || newArtistName.trim().length < 2}
                      loading={assigning}
                      leftIcon={<Plus size={14} />}
                    >
                      Create
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowCreateArtist(false);
                        setNewArtistName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Artist Results */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                {searching ? (
                  <div className="flex items-center justify-center h-48 text-[var(--color-text-secondary)] gap-2">
                    <Loader2 size={20} className="animate-spin" />
                    <span>Searching artists...</span>
                  </div>
                ) : !selectedTrack && selectedTracks.size === 0 ? (
                  <div className="text-center p-10 text-[var(--color-text-secondary)]">
                    ← Select a track or multiple tracks to begin
                  </div>
                ) : artistResults.length === 0 && searchQuery.trim().length >= 2 ? (
                  <div className="text-center p-10 text-[var(--color-text-secondary)]">
                    No artists found. Try creating a new artist.
                  </div>
                ) : (
                  artistResults.map((artist) => (
                    <div
                      key={artist.artist_id}
                      onClick={() => setSelectedArtist(artist)}
                      className={`p-3 rounded-[var(--radius-card)] border cursor-pointer transition-colors ${
                        selectedArtist?.artist_id === artist.artist_id
                          ? 'bg-[var(--color-brand-primary-muted)] border-[var(--color-brand-primary)]'
                          : 'bg-[var(--color-bg-elevated-1)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated-2)]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-sm text-[var(--color-text-primary)]">
                          {artist.name}
                        </div>
                        <div className="text-xs font-semibold text-[var(--color-brand-primary)]">
                          {Math.round(artist.match_score * 100)}% match
                        </div>
                      </div>

                      <div className="text-xs text-[var(--color-text-secondary)] flex gap-3 flex-wrap">
                        <span>🎵 {artist.track_count} tracks</span>
                        {artist.spotify_id && <span>✓ Spotify</span>}
                        {artist.musicbrainz_id && <span>✓ MusicBrainz</span>}
                      </div>

                      {artist.genres && artist.genres.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {artist.genres.slice(0, 3).map((genre, idx) => (
                            <Badge key={idx} variant="default" size="sm">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Assignment Button */}
              {selectedArtist && (selectedTrack || selectedTracks.size > 0) && (
                <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)]">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={() => {
                      if (selectedTracks.size > 0) {
                        assignArtistToBulk();
                      } else if (selectedTrack) {
                        assignArtistToTrack(selectedTrack.track_id, selectedArtist.artist_id, selectedArtist.name);
                      }
                    }}
                    disabled={assigning}
                    loading={assigning}
                    leftIcon={<Check size={16} />}
                  >
                    Assign {selectedArtist.name} to {selectedTracks.size > 0 ? `${selectedTracks.size} tracks` : 'track'}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Dirty Artists Tab */
          <div className="w-full flex flex-col overflow-hidden p-6 bg-[var(--color-bg-base)]">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-[var(--color-text-secondary)] gap-2">
                <Loader2 size={20} className="animate-spin" />
                <span>Loading dirty artists...</span>
              </div>
            ) : dirtyArtists.length === 0 ? (
              <div className="text-center p-10 text-[var(--color-text-secondary)]">
                🎉 No dirty artist names found! All artists are clean.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar p-1">
                {dirtyArtists.map((artist) => (
                  <div
                    key={artist.artist_id}
                    className={`p-4 bg-[var(--color-bg-elevated-1)] border rounded-[var(--radius-card)] space-y-3 ${
                      artist.has_conflict
                        ? 'border-[var(--color-border-error)]'
                        : 'border-[var(--color-border-subtle)]'
                    }`}
                  >
                    {/* Current Name */}
                    <div className="pb-3 border-b border-[var(--color-border-subtle)]">
                      <div className="text-[10px] text-[var(--color-error)] font-bold uppercase tracking-wider mb-1">
                        Current (Dirty)
                      </div>
                      <div className="text-base font-semibold font-mono text-[var(--color-text-primary)]">
                        {artist.current_name}
                      </div>
                    </div>

                    {/* Suggested Clean Name */}
                    <div className="pb-3 border-b border-[var(--color-border-subtle)]">
                      <div className="text-[10px] text-[var(--color-brand-primary)] font-bold uppercase tracking-wider mb-1">
                        Suggested Clean Name
                      </div>
                      <div className="text-base font-semibold text-[var(--color-text-primary)]">
                        {artist.suggested_clean_name}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex gap-3 text-xs text-[var(--color-text-secondary)] items-center">
                      <span>🎵 {artist.track_count} tracks</span>
                      <Badge variant="secondary" size="sm">
                        {artist.pattern_type.replace('_', ' ')}
                      </Badge>
                    </div>

                    {/* Conflict Warning */}
                    {artist.has_conflict && (
                      <div className="p-2 bg-[var(--color-error-bg)] border border-[var(--color-border-error)] rounded-[var(--radius-base)] text-[var(--color-error)] text-xs flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>Name conflict - will merge into existing artist</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant={artist.has_conflict ? 'outline' : 'primary'}
                        className="flex-1"
                        onClick={() => applyCleanName(artist)}
                        disabled={assigning}
                        loading={assigning}
                        leftIcon={<Check size={14} />}
                      >
                        {artist.has_conflict ? 'Merge into Existing' : 'Apply Clean Name'}
                      </Button>

                      <Button
                        variant="outline"
                        className="border-[var(--color-border-error)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                        onClick={() => deleteArtist(artist)}
                        disabled={assigning}
                        aria-label="Delete artist"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination for Dirty Artists */}
            {!loading && dirtyArtists.length > 0 && (
              <div className="mt-6 flex gap-2 justify-center items-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <div className="text-xs text-[var(--color-text-secondary)] px-3">
                  Page {page + 1}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={dirtyArtists.length < ITEMS_PER_PAGE}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
