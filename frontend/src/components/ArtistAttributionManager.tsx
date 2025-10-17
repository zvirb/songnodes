import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Check, AlertCircle, Loader2, Trash2 } from 'lucide-react';

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

interface DataCompletenessStats {
    total_tracks: number;
    missing_artist_count: number;
    missing_artist_percentage: number;
}

// ============================================================================
// Main Component
// ============================================================================

interface ArtistAttributionManagerProps {
    onClose: () => void;
}

export const ArtistAttributionManager: React.FC<ArtistAttributionManagerProps> = ({ onClose }) => {
    // State for tracks missing artists
    const [tracks, setTracks] = useState<TrackWithoutArtist[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<TrackWithoutArtist | null>(null);
    const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());

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

    // Statistics
    const [stats, setStats] = useState<DataCompletenessStats | null>(null);

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

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/observability/data-completeness');

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();
            setStats({
                total_tracks: data.total_counts.tracks,
                missing_artist_count: data.track_completeness.artist_attribution.missing,
                missing_artist_percentage: data.track_completeness.artist_attribution.percentage
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, []);

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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to assign artist');
            }

            // Show success message
            setSuccessMessage(`Successfully assigned ${artistName} to track`);
            setTimeout(() => setSuccessMessage(null), 3000);

            // Refresh the tracks list and stats
            await fetchTracks();
            await fetchStats();

            // Clear selection
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

        // Show results
        setSuccessMessage(`Assigned ${selectedArtist.name} to ${successCount} tracks${failCount > 0 ? ` (${failCount} failed)` : ''}`);
        setTimeout(() => setSuccessMessage(null), 5000);

        // Refresh and clear selection
        await fetchTracks();
        await fetchStats();
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

            // Show success and switch to the new artist
            setSuccessMessage(`Created new artist: ${newArtist.name}`);
            setTimeout(() => setSuccessMessage(null), 3000);

            // Set the newly created artist as selected
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

            // Close creation form
            setShowCreateArtist(false);
            setNewArtistName('');

            // Refresh artist search to show the new artist
            await searchArtists(newArtist.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create artist');
            console.error('Error creating artist:', err);
        } finally {
            setAssigning(false);
        }
    };

    // ============================================================================
    // Effects
    // ============================================================================

    useEffect(() => {
        fetchTracks();
        fetchStats();
    }, [fetchTracks, fetchStats]);

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

    // ============================================================================
    // Render
    // ============================================================================

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '24px',
                borderBottom: '1px solid rgba(126, 211, 33, 0.3)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.8)'
            }}>
                <div>
                    <h2 style={{
                        margin: 0,
                        color: '#7ED321',
                        fontSize: '24px',
                        fontWeight: 700,
                        marginBottom: '8px'
                    }}>
                        Artist Attribution Manager
                    </h2>
                    {stats && (
                        <p style={{
                            margin: 0,
                            color: '#FFFFFF',
                            fontSize: '14px',
                            opacity: 0.8
                        }}>
                            {stats.missing_artist_count.toLocaleString()} tracks ({stats.missing_artist_percentage.toFixed(1)}%) missing artist attribution
                        </p>
                    )}
                </div>

                <button
                    onClick={onClose}
                    style={{
                        padding: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <X size={20} />
                </button>
            </div>

            {/* Messages */}
            {error && (
                <div style={{
                    padding: '12px 24px',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderBottom: '1px solid rgba(231, 76, 60, 0.4)',
                    color: '#E74C3C',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div style={{
                    padding: '12px 24px',
                    backgroundColor: 'rgba(126, 211, 33, 0.2)',
                    borderBottom: '1px solid rgba(126, 211, 33, 0.4)',
                    color: '#7ED321',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <Check size={16} />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Main Content */}
            <div style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden'
            }}>
                {/* Left Panel - Track List */}
                <div style={{
                    width: '50%',
                    borderRight: '1px solid rgba(126, 211, 33, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Controls */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid rgba(126, 211, 33, 0.3)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <button
                                onClick={() => setSortBy('importance')}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: sortBy === 'importance' ? 'rgba(126, 211, 33, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    border: `1px solid ${sortBy === 'importance' ? 'rgba(126, 211, 33, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
                                    borderRadius: '6px',
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                By Importance
                            </button>
                            <button
                                onClick={() => setSortBy('alphabetical')}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: sortBy === 'alphabetical' ? 'rgba(126, 211, 33, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                                    border: `1px solid ${sortBy === 'alphabetical' ? 'rgba(126, 211, 33, 0.5)' : 'rgba(255, 255, 255, 0.2)'}`,
                                    borderRadius: '6px',
                                    color: '#FFFFFF',
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Alphabetical
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={selectAllOnPage}
                                disabled={tracks.length === 0}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: 'rgba(126, 211, 33, 0.2)',
                                    border: '1px solid rgba(126, 211, 33, 0.4)',
                                    borderRadius: '6px',
                                    color: '#FFFFFF',
                                    fontSize: '12px',
                                    cursor: tracks.length === 0 ? 'not-allowed' : 'pointer',
                                    opacity: tracks.length === 0 ? 0.5 : 1
                                }}
                            >
                                Select All ({tracks.length})
                            </button>
                            {selectedTracks.size > 0 && (
                                <>
                                    <button
                                        onClick={clearSelection}
                                        style={{
                                            padding: '6px 12px',
                                            backgroundColor: 'rgba(231, 76, 60, 0.2)',
                                            border: '1px solid rgba(231, 76, 60, 0.4)',
                                            borderRadius: '6px',
                                            color: '#FFFFFF',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Selection
                                    </button>
                                    <div style={{
                                        padding: '6px 12px',
                                        backgroundColor: 'rgba(126, 211, 33, 0.1)',
                                        border: '1px solid rgba(126, 211, 33, 0.3)',
                                        borderRadius: '6px',
                                        color: '#7ED321',
                                        fontSize: '12px',
                                        fontWeight: 600
                                    }}>
                                        {selectedTracks.size} selected
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Track List */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px'
                    }}>
                        {loading ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '200px',
                                color: '#FFFFFF',
                                gap: '8px'
                            }}>
                                <Loader2 size={20} className="animate-spin" />
                                <span>Loading tracks...</span>
                            </div>
                        ) : tracks.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                color: '#FFFFFF',
                                opacity: 0.6
                            }}>
                                🎉 No tracks missing artist attribution!
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {tracks.map((track) => (
                                    <div
                                        key={track.track_id}
                                        onClick={() => setSelectedTrack(track)}
                                        style={{
                                            padding: '12px',
                                            backgroundColor: selectedTrack?.track_id === track.track_id
                                                ? 'rgba(126, 211, 33, 0.2)'
                                                : 'rgba(255, 255, 255, 0.05)',
                                            border: `1px solid ${selectedTrack?.track_id === track.track_id
                                                ? 'rgba(126, 211, 33, 0.5)'
                                                : 'rgba(255, 255, 255, 0.1)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: '12px'
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedTracks.has(track.track_id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleTrackSelection(track.track_id);
                                            }}
                                            style={{
                                                marginTop: '4px',
                                                cursor: 'pointer',
                                                width: '16px',
                                                height: '16px'
                                            }}
                                        />

                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                color: '#FFFFFF',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                marginBottom: '4px'
                                            }}>
                                                {track.title}
                                            </div>
                                            <div style={{
                                                color: '#FFFFFF',
                                                fontSize: '12px',
                                                opacity: 0.6,
                                                display: 'flex',
                                                gap: '12px'
                                            }}>
                                                <span>📊 Importance: {getImportanceScore(track)}</span>
                                                <span>📝 Playlists: {track.playlist_count}</span>
                                                {track.source && <span>🔗 {track.source}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div style={{
                        padding: '16px',
                        borderTop: '1px solid rgba(126, 211, 33, 0.3)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'center'
                    }}>
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'rgba(126, 211, 33, 0.2)',
                                border: '1px solid rgba(126, 211, 33, 0.4)',
                                borderRadius: '6px',
                                color: '#FFFFFF',
                                fontSize: '13px',
                                cursor: page === 0 ? 'not-allowed' : 'pointer',
                                opacity: page === 0 ? 0.5 : 1
                            }}
                        >
                            Previous
                        </button>
                        <div style={{
                            padding: '8px 16px',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            Page {page + 1}
                        </div>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={tracks.length < ITEMS_PER_PAGE}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'rgba(126, 211, 33, 0.2)',
                                border: '1px solid rgba(126, 211, 33, 0.4)',
                                borderRadius: '6px',
                                color: '#FFFFFF',
                                fontSize: '13px',
                                cursor: tracks.length < ITEMS_PER_PAGE ? 'not-allowed' : 'pointer',
                                opacity: tracks.length < ITEMS_PER_PAGE ? 0.5 : 1
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>

                {/* Right Panel - Artist Search & Assignment */}
                <div style={{
                    width: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Search Bar */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid rgba(126, 211, 33, 0.3)',
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }}>
                        <div style={{
                            position: 'relative',
                            marginBottom: '12px'
                        }}>
                            <Search
                                size={16}
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    color: '#7ED321',
                                    pointerEvents: 'none'
                                }}
                            />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search for artists..."
                                disabled={!selectedTrack && selectedTracks.size === 0}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px 10px 36px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                    border: '1px solid rgba(126, 211, 33, 0.3)',
                                    borderRadius: '8px',
                                    color: '#FFFFFF',
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <button
                            onClick={() => setShowCreateArtist(!showCreateArtist)}
                            disabled={!selectedTrack && selectedTracks.size === 0}
                            style={{
                                width: '100%',
                                padding: '10px',
                                backgroundColor: 'rgba(126, 211, 33, 0.2)',
                                border: '1px solid rgba(126, 211, 33, 0.4)',
                                borderRadius: '8px',
                                color: '#FFFFFF',
                                fontSize: '13px',
                                cursor: (!selectedTrack && selectedTracks.size === 0) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                opacity: (!selectedTrack && selectedTracks.size === 0) ? 0.5 : 1
                            }}
                        >
                            <Plus size={16} />
                            Create New Artist
                        </button>
                    </div>

                    {/* Create Artist Form */}
                    {showCreateArtist && (
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid rgba(126, 211, 33, 0.3)',
                            backgroundColor: 'rgba(126, 211, 33, 0.1)'
                        }}>
                            <input
                                type="text"
                                value={newArtistName}
                                onChange={(e) => setNewArtistName(e.target.value)}
                                placeholder="Enter artist name..."
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    marginBottom: '8px',
                                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                    border: '1px solid rgba(126, 211, 33, 0.3)',
                                    borderRadius: '8px',
                                    color: '#FFFFFF',
                                    fontSize: '14px',
                                    outline: 'none'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={createArtist}
                                    disabled={assigning || newArtistName.trim().length < 2}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        backgroundColor: 'rgba(126, 211, 33, 0.3)',
                                        border: '1px solid rgba(126, 211, 33, 0.5)',
                                        borderRadius: '6px',
                                        color: '#FFFFFF',
                                        fontSize: '13px',
                                        cursor: (assigning || newArtistName.trim().length < 2) ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        opacity: (assigning || newArtistName.trim().length < 2) ? 0.5 : 1
                                    }}
                                >
                                    {assigning ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={14} />
                                            Create
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCreateArtist(false);
                                        setNewArtistName('');
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '6px',
                                        color: '#FFFFFF',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Artist Results */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px'
                    }}>
                        {searching ? (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '200px',
                                color: '#FFFFFF',
                                gap: '8px'
                            }}>
                                <Loader2 size={20} className="animate-spin" />
                                <span>Searching artists...</span>
                            </div>
                        ) : !selectedTrack && selectedTracks.size === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                color: '#FFFFFF',
                                opacity: 0.6
                            }}>
                                ← Select a track or multiple tracks to begin
                            </div>
                        ) : artistResults.length === 0 && searchQuery.trim().length >= 2 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '40px',
                                color: '#FFFFFF',
                                opacity: 0.6
                            }}>
                                No artists found. Try creating a new artist.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {artistResults.map((artist) => (
                                    <div
                                        key={artist.artist_id}
                                        style={{
                                            padding: '12px',
                                            backgroundColor: selectedArtist?.artist_id === artist.artist_id
                                                ? 'rgba(126, 211, 33, 0.2)'
                                                : 'rgba(255, 255, 255, 0.05)',
                                            border: `1px solid ${selectedArtist?.artist_id === artist.artist_id
                                                ? 'rgba(126, 211, 33, 0.5)'
                                                : 'rgba(255, 255, 255, 0.1)'}`,
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onClick={() => setSelectedArtist(artist)}
                                    >
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'flex-start',
                                            marginBottom: '8px'
                                        }}>
                                            <div style={{
                                                color: '#FFFFFF',
                                                fontSize: '14px',
                                                fontWeight: 600
                                            }}>
                                                {artist.name}
                                            </div>
                                            <div style={{
                                                color: '#7ED321',
                                                fontSize: '12px',
                                                fontWeight: 600
                                            }}>
                                                {Math.round(artist.match_score * 100)}% match
                                            </div>
                                        </div>

                                        <div style={{
                                            color: '#FFFFFF',
                                            fontSize: '12px',
                                            opacity: 0.6,
                                            display: 'flex',
                                            gap: '12px',
                                            flexWrap: 'wrap'
                                        }}>
                                            <span>🎵 {artist.track_count} tracks</span>
                                            {artist.spotify_id && <span>✓ Spotify</span>}
                                            {artist.musicbrainz_id && <span>✓ MusicBrainz</span>}
                                        </div>

                                        {artist.genres && artist.genres.length > 0 && (
                                            <div style={{
                                                marginTop: '8px',
                                                display: 'flex',
                                                gap: '4px',
                                                flexWrap: 'wrap'
                                            }}>
                                                {artist.genres.slice(0, 3).map((genre, idx) => (
                                                    <span
                                                        key={idx}
                                                        style={{
                                                            padding: '2px 8px',
                                                            backgroundColor: 'rgba(126, 211, 33, 0.2)',
                                                            border: '1px solid rgba(126, 211, 33, 0.3)',
                                                            borderRadius: '12px',
                                                            color: '#7ED321',
                                                            fontSize: '11px'
                                                        }}
                                                    >
                                                        {genre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Assignment Button */}
                    {selectedArtist && (selectedTrack || selectedTracks.size > 0) && (
                        <div style={{
                            padding: '16px',
                            borderTop: '1px solid rgba(126, 211, 33, 0.3)',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)'
                        }}>
                            <button
                                onClick={() => {
                                    if (selectedTracks.size > 0) {
                                        assignArtistToBulk();
                                    } else if (selectedTrack) {
                                        assignArtistToTrack(selectedTrack.track_id, selectedArtist.artist_id, selectedArtist.name);
                                    }
                                }}
                                disabled={assigning}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    backgroundColor: 'rgba(126, 211, 33, 0.3)',
                                    border: '1px solid rgba(126, 211, 33, 0.5)',
                                    borderRadius: '8px',
                                    color: '#FFFFFF',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: assigning ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    opacity: assigning ? 0.5 : 1
                                }}
                            >
                                {assigning ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Assigning...
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        Assign {selectedArtist.name} to {selectedTracks.size > 0 ? `${selectedTracks.size} tracks` : 'track'}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
