import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Check, Trash2, CircleCheck, MousePointerClick, SearchX } from 'lucide-react';
import { SN } from '../lib/songnodes';
import { Dialog, ConfirmDialog, Tabs, TabPanel, SegmentedControl, OverflowMenu, EmptyPanel, LoadingPanel, showToast } from './ds';
import './ArtistAttributionManager.css';

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

    // Statistics
    
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

            // Handle immediate success for async job (202) or synchronous success (200, 204)
            if (response.status === 202) {
                // Backend accepted the job, but hasn't finished it.
                // We can optimistically update the UI.
            } else if (!response.ok) {
                // Handle non-JSON responses like 504 Gateway Timeout
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.detail || `Server responded with ${response.status}`);
                } catch (e) {
                    // If parsing fails, it's likely an HTML error page from the gateway
                    throw new Error(errorText.substring(0, 100) || `Server responded with ${response.status}`);
                }
            }

            // Show success message
            showToast(`Artist set: ${artistName}`);

            // Optimistic UI Update: Remove the assigned track from the list locally
            // This provides instant feedback without waiting for a full refresh.
            setTracks(prevTracks => prevTracks.filter(t => t.track_id !== trackId));
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
        showToast(`Artist set: ${selectedArtist.name} on ${successCount} tracks${failCount > 0 ? `, ${failCount} failed` : ''}`);

        // Refresh and clear selection
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

            // Show success and switch to the new artist
            showToast(`Artist added: ${newArtist.name}`);

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
    // Dirty Artist Correction
    // ============================================================================

    const applyCleanName = async (dirtyArtist: DirtyArtist) => {
        setAssigning(true);
        setError(null);

        try {
            // Use merge endpoint if there's a conflict, otherwise use rename
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
            showToast(`Renamed: ${dirtyArtist.current_name} to ${dirtyArtist.suggested_clean_name}`);

            // Refresh the dirty artists list
            await fetchDirtyArtists();
            setSelectedDirtyArtist(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to apply clean name');
            console.error('Error applying clean name:', err);
        } finally {
            setAssigning(false);
        }
    };

    const [pendingDelete, setPendingDelete] = useState<DirtyArtist | null>(null);

    const deleteArtist = async (dirtyArtist: DirtyArtist) => {
        setPendingDelete(null);

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

            showToast(`Artist deleted: ${dirtyArtist.current_name}`);

            // Refresh the dirty artists list
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

    // ============================================================================
    // Render
    // ============================================================================

    const noTarget = !selectedTrack && selectedTracks.size === 0;
    const pager = (count: number) => (
        <div className="aam__pager">
            <button type="button" className="sn-btn sn-btn--sm" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>Previous page</button>
            <span className="aam__page">Page {page + 1}</span>
            <button type="button" className="sn-btn sn-btn--sm" onClick={() => setPage(page + 1)} disabled={count < ITEMS_PER_PAGE}>Next page</button>
        </div>
    );

    return (
        <>
        <Dialog open title="Artist attribution" sub="Every transition needs a real artist at both ends. Fix tracks without one and tidy messy names." size="l" onClose={onClose}>
            <Tabs<'missing' | 'dirty'>
                label="Artist attribution"
                idBase="aam"
                tabs={[{ id: 'missing', label: 'Missing artist' }, { id: 'dirty', label: 'Messy names' }]}
                value={activeTab}
                onChange={(t) => { setActiveTab(t); setPage(0); }}
            />

            {error && <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{error}</p>}

            <TabPanel idBase="aam" id={activeTab}>
                {activeTab === 'missing' ? (
                    <div className="aam__split">
                        <section className="aam__col" aria-label="Tracks without an artist">
                            <div className="aam__bar">
                                <SegmentedControl<'importance' | 'alphabetical'>
                                    label="Sort tracks"
                                    size="sm"
                                    value={sortBy}
                                    onChange={setSortBy}
                                    options={[{ value: 'importance', label: 'Most used' }, { value: 'alphabetical', label: 'A to Z' }]}
                                />
                                {selectedTracks.size > 0 ? (
                                    <>
                                        <span className="aam__muted" role="status">{selectedTracks.size} selected</span>
                                        <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={clearSelection}>Clear selection</button>
                                    </>
                                ) : (
                                    <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={selectAllOnPage} disabled={tracks.length === 0}>Select all {tracks.length}</button>
                                )}
                            </div>

                            {loading ? (
                                <LoadingPanel message="Loading tracks without an artist…" rows={6} />
                            ) : tracks.length === 0 ? (
                                <EmptyPanel compact icon={CircleCheck} title="Every track has an artist">
                                    New tracks without one appear here after the next scrape.
                                </EmptyPanel>
                            ) : (
                                <ul className="aam__list">
                                    {tracks.map((track) => (
                                        <li key={track.track_id} className="aam__item" aria-selected={selectedTrack?.track_id === track.track_id || selectedTracks.has(track.track_id)} onClick={() => setSelectedTrack(track)}>
                                            <label className="sn-checkbox sn-checkbox--bare" onClick={(e) => e.stopPropagation()}>
                                                <input type="checkbox" checked={selectedTracks.has(track.track_id)} onChange={() => toggleTrackSelection(track.track_id)} aria-label={`Select ${track.title}`} />
                                            </label>
                                            <div className="sn-track-cell aam__main">
                                                <span className="sn-track-cell__title"><span className="sn-track-cell__name">{track.title}</span></span>
                                                <span className="sn-track-cell__meta">
                                                    <span>{SN.format.count(track.playlist_count)} playlists</span>
                                                    <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                                                    <span>{SN.format.count(getImportanceScore(track))} uses</span>
                                                    {track.source ? <><span className="sn-track-cell__sep" aria-hidden="true">·</span><span>{track.source}</span></> : null}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {pager(tracks.length)}
                        </section>

                        <section className="aam__col" aria-label="Choose an artist">
                            <div className="aam__bar">
                                <div className="aam__search">
                                    <span className="aam__search-icon" aria-hidden="true"><Search size={16} strokeWidth={2} /></span>
                                    <input type="search" className="sn-input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search artists" aria-label="Search artists" disabled={noTarget} />
                                </div>
                                <button type="button" className="sn-btn sn-btn--sm" onClick={() => setShowCreateArtist(!showCreateArtist)} disabled={noTarget} aria-expanded={showCreateArtist}>
                                    <Plus size={16} strokeWidth={2} aria-hidden="true" />
                                    New artist
                                </button>
                            </div>

                            {showCreateArtist && (
                                <div className="aam__create">
                                    <div className="sn-field">
                                        <label htmlFor="aam-new">Artist name</label>
                                        <input id="aam-new" className="sn-input" type="text" value={newArtistName} onChange={(e) => setNewArtistName(e.target.value)} autoFocus />
                                    </div>
                                    <div className="aam__row">
                                        <button type="button" className="sn-btn sn-btn--sm" onClick={createArtist} disabled={assigning || newArtistName.trim().length < 2} aria-busy={assigning || undefined}>
                                            {assigning ? 'Adding…' : 'Add artist'}
                                        </button>
                                        <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => { setShowCreateArtist(false); setNewArtistName(''); }}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {searching ? (
                                <span className="sn-loading-state__inline" role="status"><span className="sn-spinner" aria-hidden="true" />Searching artists…</span>
                            ) : noTarget ? (
                                <EmptyPanel compact icon={MousePointerClick} title="Pick a track first">Select one track, or tick several, then search for its artist.</EmptyPanel>
                            ) : artistResults.length === 0 && searchQuery.trim().length >= 2 ? (
                                <EmptyPanel compact icon={SearchX} title="No artists match" actions={<button type="button" className="sn-btn" onClick={() => { setShowCreateArtist(true); setNewArtistName(searchQuery); }}>Add “{searchQuery}” as a new artist</button>}>
                                    None of the artists in the library match “{searchQuery}”.
                                </EmptyPanel>
                            ) : (
                                <ul className="aam__list">
                                    {artistResults.map((artist) => (
                                        <li key={artist.artist_id} className="aam__item" aria-selected={selectedArtist?.artist_id === artist.artist_id} onClick={() => setSelectedArtist(artist)}>
                                            <div className="aam__main">
                                                <div className="aam__row">
                                                    <span className="aam__name">{artist.name}</span>
                                                    <span className="aam__muted">{SN.format.percent(artist.match_score)} match</span>
                                                </div>
                                                <div className="aam__tags">
                                                    <span className="aam__muted">{SN.format.count(artist.track_count)} tracks</span>
                                                    {artist.spotify_id && <span className="sn-tag">Spotify</span>}
                                                    {artist.musicbrainz_id && <span className="sn-tag">MusicBrainz</span>}
                                                    {artist.genres?.slice(0, 3).map((genre, idx) => <span key={idx} className="sn-tag">{genre}</span>)}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {selectedArtist && !noTarget && (
                                <button
                                    type="button"
                                    className="sn-btn sn-btn--primary aam__assign"
                                    onClick={() => {
                                        if (selectedTracks.size > 0) assignArtistToBulk();
                                        else if (selectedTrack) assignArtistToTrack(selectedTrack.track_id, selectedArtist.artist_id, selectedArtist.name);
                                    }}
                                    disabled={assigning}
                                    aria-busy={assigning || undefined}
                                >
                                    {assigning ? <span className="sn-spinner" aria-hidden="true" /> : <Check size={16} strokeWidth={2} aria-hidden="true" />}
                                    {assigning ? 'Setting artist…' : `Set ${selectedArtist.name} as artist${selectedTracks.size > 0 ? ` of ${selectedTracks.size} tracks` : ''}`}
                                </button>
                            )}
                        </section>
                    </div>
                ) : (
                    <section aria-label="Messy artist names">
                        {loading ? (
                            <LoadingPanel message="Loading artist names to tidy…" rows={6} />
                        ) : dirtyArtists.length === 0 ? (
                            <EmptyPanel compact icon={CircleCheck} title="Every artist name is tidy">
                                Names with extra text such as “feat.” or a label appear here after the next scrape.
                            </EmptyPanel>
                        ) : (
                            <ul className="aam__grid">
                                {dirtyArtists.map((artist) => (
                                    <li key={artist.artist_id} className="aam__card">
                                        <dl className="aam__names">
                                            <dt>Now</dt><dd className="aam__old">{artist.current_name}</dd>
                                            <dt>Tidy</dt><dd className="aam__new">{artist.suggested_clean_name}</dd>
                                        </dl>
                                        <div className="aam__tags">
                                            <span className="aam__muted">{SN.format.count(artist.track_count)} tracks</span>
                                            <span className="sn-tag">{artist.pattern_type.replace(/_/g, ' ')}</span>
                                        </div>
                                        {artist.has_conflict && (
                                            <p className="sn-inline-message" data-status="warn">An artist with the tidy name exists; applying merges the two.</p>
                                        )}
                                        <div className="aam__row">
                                            <button type="button" className="sn-btn sn-btn--sm" onClick={() => applyCleanName(artist)} disabled={assigning}>
                                                {artist.has_conflict ? 'Merge into existing artist' : 'Use tidy name'}
                                            </button>
                                            <OverflowMenu
                                                small
                                                quiet
                                                label={`More actions for ${artist.current_name}`}
                                                onSelect={() => setPendingDelete(artist)}
                                                items={[{ id: 'delete', label: 'Delete artist…', icon: Trash2, destructive: true }]}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!loading && dirtyArtists.length > 0 && pager(dirtyArtists.length)}
                    </section>
                )}
            </TabPanel>
        </Dialog>

        <ConfirmDialog
            open={!!pendingDelete}
            title={`Delete “${pendingDelete?.current_name ?? ''}”?`}
            confirmLabel="Delete artist"
            busy={assigning}
            busyLabel="Deleting…"
            onConfirm={() => pendingDelete && deleteArtist(pendingDelete)}
            onCancel={() => setPendingDelete(null)}
            facts={[`Its ${pendingDelete?.track_count ?? 0} tracks lose this artist and go back to “Missing artist”.`]}
        >
            This removes the artist and every link to its tracks. This can’t be undone.
        </ConfirmDialog>
        </>
    );
};
