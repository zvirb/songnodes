import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Check, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Input } from './ui';

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

  // Data Fetching
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

  // Artist Assignment
  const assignArtistToTrack = async (trackId: string, artistId: string, artistName: string) => {
    setAssigning(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/tracks/${trackId}/assign-artist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: trackId,
          artist_id: artistId,
          role: 'primary'
        })
      });

      if (!response.ok && response.status !== 202) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.detail || `Server responded with ${response.status}`);
        } catch {
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track_id: trackId,
            artist_id: selectedArtist.artist_id,
            role: 'primary'
          })
        });

        if (response.ok || response.status === 202) {
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

  // Artist Creation
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArtistName.trim() })
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

  // Dirty Artist Correction
  const applyCleanName = async (dirtyArtist: DirtyArtist) => {
    setAssigning(true);
    setError(null);

    try {
      const endpoint = dirtyArtist.has_conflict
        ? `/api/v1/artists/${dirtyArtist.artist_id}/merge`
        : `/api/v1/artists/${dirtyArtist.artist_id}/rename`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="fixed inset-0 bg-[var(--color-modal-overlay)] z-[var(--z-modal)] backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <Card variant="elevated" className="rounded-none border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] p-6">
        <div className="flex justify-between items-center mb-4">
          <CardTitle className="text-xl font-bold text-[var(--color-text-primary)]">
            Artist Attribution Manager
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'missing' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('missing')}
          >
            Missing Artists
          </Button>
          <Button
            variant={activeTab === 'dirty' ? 'primary' : 'outline'}
            onClick={() => setActiveTab('dirty')}
          >
            Dirty Artist Names
          </Button>
        </div>
      </Card>

      {/* Messages */}
      {error && (
        <Card className="rounded-none border-t-0 border-b border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </Card>
      )}

      {successMessage && (
        <Card className="rounded-none border-t-0 border-b border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--color-success)]">
            <Check size={16} />
            <span>{successMessage}</span>
          </div>
        </Card>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'missing' ? (
          <>
            {/* Left Panel - Track List */}
            <div className="w-1/2 border-r border-[var(--color-border-subtle)] flex flex-col bg-[var(--color-bg-base)]">
              {/* Controls */}
              <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={sortBy === 'importance' ? 'secondary' : 'outline'}
                    onClick={() => setSortBy('importance')}
                  >
                    By Importance
                  </Button>
                  <Button
                    size="sm"
                    variant={sortBy === 'alphabetical' ? 'secondary' : 'outline'}
                    onClick={() => setSortBy('alphabetical')}
                  >
                    Alphabetical
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllOnPage}
                    disabled={tracks.length === 0}
                  >
                    Select All ({tracks.length})
                  </Button>
                  {selectedTracks.size > 0 && (
                    <>
                      <Button size="sm" variant="ghost" onClick={clearSelection}>
                        Clear Selection
                      </Button>
                      <Badge variant="success">
                        {selectedTracks.size} selected
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              {/* Track List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-tertiary)] gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Loading tracks...</span>
                  </div>
                ) : tracks.length === 0 ? (
                  <div className="text-center py-10 text-sm text-[var(--color-text-tertiary)]">
                    🎉 No tracks missing artist attribution!
                  </div>
                ) : (
                  tracks.map((track) => (
                    <Card
                      key={track.track_id}
                      variant="default"
                      className={`p-3 cursor-pointer transition-all border ${
                        selectedTrack?.track_id === track.track_id
                          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]'
                          : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]'
                      }`}
                      onClick={() => setSelectedTrack(track)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedTracks.has(track.track_id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleTrackSelection(track.track_id);
                          }}
                          className="mt-1 w-4 h-4 accent-[var(--color-brand-primary)]"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                            {track.title}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)] mt-1">
                            <span>📊 Importance: {getImportanceScore(track)}</span>
                            <span>📝 Playlists: {track.playlist_count}</span>
                            {track.source && <span>🔗 {track.source}</span>}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Pagination */}
              <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                  Page {page + 1}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={tracks.length < ITEMS_PER_PAGE}
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Right Panel - Artist Search & Assignment */}
            <div className="w-1/2 flex flex-col bg-[var(--color-bg-base)]">
              <div className="p-4 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)] space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for artists..."
                    disabled={!selectedTrack && selectedTracks.size === 0}
                    className="pl-9"
                  />
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!selectedTrack && selectedTracks.size === 0}
                  onClick={() => setShowCreateArtist(!showCreateArtist)}
                >
                  <Plus size={16} className="mr-1 inline" /> Create New Artist
                </Button>
              </div>

              {/* Create Artist Form */}
              {showCreateArtist && (
                <Card variant="default" className="rounded-none border-b border-[var(--color-border-subtle)] p-4 bg-[var(--color-bg-elevated-2)] space-y-3">
                  <Input
                    type="text"
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
                    >
                      {assigning ? <Loader2 size={14} className="animate-spin mr-1 inline" /> : <Plus size={14} className="mr-1 inline" />}
                      Create
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateArtist(false);
                        setNewArtistName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              )}

              {/* Artist Results */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {searching ? (
                  <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-tertiary)] gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Searching artists...</span>
                  </div>
                ) : !selectedTrack && selectedTracks.size === 0 ? (
                  <div className="text-center py-10 text-sm text-[var(--color-text-tertiary)]">
                    ← Select a track or multiple tracks to begin
                  </div>
                ) : artistResults.length === 0 && searchQuery.trim().length >= 2 ? (
                  <div className="text-center py-10 text-sm text-[var(--color-text-tertiary)]">
                    No artists found. Try creating a new artist.
                  </div>
                ) : (
                  artistResults.map((artist) => (
                    <Card
                      key={artist.artist_id}
                      variant="default"
                      className={`p-3 cursor-pointer transition-all border ${
                        selectedArtist?.artist_id === artist.artist_id
                          ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]'
                          : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]'
                      }`}
                      onClick={() => setSelectedArtist(artist)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm text-[var(--color-text-primary)]">{artist.name}</h4>
                        <Badge variant="success" size="sm">
                          {Math.round(artist.match_score * 100)}% match
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                        <span>🎵 {artist.track_count} tracks</span>
                        {artist.spotify_id && <span>✓ Spotify</span>}
                        {artist.musicbrainz_id && <span>✓ MusicBrainz</span>}
                      </div>

                      {artist.genres && artist.genres.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {artist.genres.slice(0, 3).map((genre, idx) => (
                            <Badge key={idx} variant="outline" size="sm">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>

              {/* Assignment Button */}
              {selectedArtist && (selectedTrack || selectedTracks.size > 0) && (
                <div className="p-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated-1)]">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      if (selectedTracks.size > 0) {
                        assignArtistToBulk();
                      } else if (selectedTrack) {
                        assignArtistToTrack(selectedTrack.track_id, selectedArtist.artist_id, selectedArtist.name);
                      }
                    }}
                    disabled={assigning}
                  >
                    {assigning ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin" /> Assigning...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Check size={16} /> Assign {selectedArtist.name} to {selectedTracks.size > 0 ? `${selectedTracks.size} tracks` : 'track'}
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Dirty Artists Tab */
          <div className="w-full p-6 overflow-y-auto space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-sm text-[var(--color-text-tertiary)] gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading dirty artists...</span>
              </div>
            ) : dirtyArtists.length === 0 ? (
              <div className="text-center py-10 text-sm text-[var(--color-text-tertiary)]">
                🎉 No dirty artist names found! All artists are clean.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dirtyArtists.map((artist) => (
                  <Card
                    key={artist.artist_id}
                    variant="elevated"
                    className={`p-4 border ${
                      artist.has_conflict ? 'border-[var(--color-error-border)]' : 'border-[var(--color-border-subtle)]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-semibold text-[var(--color-error)] uppercase tracking-wider block mb-1">
                          Current (Dirty)
                        </span>
                        <p className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">
                          {artist.current_name}
                        </p>
                      </div>

                      <div className="border-t border-[var(--color-border-subtle)] pt-2">
                        <span className="text-[10px] font-semibold text-[var(--color-success)] uppercase tracking-wider block mb-1">
                          Suggested Clean Name
                        </span>
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {artist.suggested_clean_name}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-tertiary)]">
                        <span>🎵 {artist.track_count} tracks</span>
                        <Badge variant="outline" size="sm">
                          {artist.pattern_type.replace('_', ' ')}
                        </Badge>
                      </div>

                      {artist.has_conflict && (
                        <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-2 flex items-center gap-2 text-xs text-[var(--color-error)]">
                          <AlertCircle size={14} />
                          <span>Name conflict - will merge into existing artist</span>
                        </Card>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant={artist.has_conflict ? 'secondary' : 'primary'}
                          className="flex-1"
                          onClick={() => applyCleanName(artist)}
                          disabled={assigning}
                        >
                          {assigning ? (
                            <Loader2 size={14} className="animate-spin inline mr-1" />
                          ) : (
                            <Check size={14} className="inline mr-1" />
                          )}
                          {artist.has_conflict ? 'Merge' : 'Apply Clean Name'}
                        </Button>

                        <Button
                          variant="outline"
                          className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                          onClick={() => deleteArtist(artist)}
                          disabled={assigning}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
