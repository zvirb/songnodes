import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useTargetSuggestions, type TargetSuggestion } from '../hooks/useTargetSuggestions';
import MusicServiceSearch from './MusicServiceSearch';
import { Plus, Upload, Download, Archive, ArchiveRestore, Search, Pencil, Trash2, Target, X, SearchX, ServerCrash } from 'lucide-react';
import { SN } from '../lib/songnodes';
import { SegmentedControl, OverflowMenu, StatusPill, ConfirmDialog, Dialog, EmptyPanel, ErrorPanel, LoadingPanel, showToast, Card, Title, Text } from './ds';
import './TargetTracksManager.css';

export interface TargetTrack {
  track_id?: string;
  title: string;
  artist: string;
  priority: 'high' | 'medium' | 'low';
  search_terms?: string[];
  genres?: string[];
  is_active: boolean;
  last_searched?: string;
  playlists_found?: number;
  adjacencies_found?: number;
  archived?: boolean;
  completion_percentage?: number;
}

interface TargetTracksManagerProps {
  embedded?: boolean;
  filterStatus?: 'all' | 'pending' | 'failed' | 'active';
}

const TargetTracksManager: React.FC<TargetTracksManagerProps> = ({ embedded = false, filterStatus = 'all' }) => {
  const { suggestions, promoteSuggestion, dismissSuggestion } = useTargetSuggestions();

  const [tracks, setTracks] = useState<TargetTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<TargetTrack | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [importData, setImportData] = useState('');
  const [activeTab, setActiveTab] = useState<'manage' | 'search'>('manage');
  const [loadFailed, setLoadFailed] = useState(false);

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<TargetTrack>>({
    title: '',
    artist: '',
    priority: 'medium',
    genres: [],
    search_terms: [],
    is_active: true
  });

  // Form helper states
  const [newGenre, setNewGenre] = useState('');
  const [newSearchTerm, setNewSearchTerm] = useState('');

  // Load target tracks
  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/target-tracks');
      setTracks(Array.isArray(response.data) ? response.data : []);
      setLoadFailed(false);
    } catch (error) {
      setLoadFailed(true);
      console.error('Error loading tracks:', error);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setNotification(null);
      showToast(message);
    } else {
      setNotification({ type, message });
    }
  };

  const handleAddTrack = () => {
    setFormData({
      title: '',
      artist: '',
      priority: 'medium',
      genres: [],
      search_terms: [],
      is_active: true
    });
    setNewGenre('');
    setNewSearchTerm('');
    setEditingTrack(null);
    setIsAddModalOpen(true);
  };

  const handleEditTrack = (track: TargetTrack) => {
    setFormData(track);
    setNewGenre('');
    setNewSearchTerm('');
    setEditingTrack(track);
    setIsAddModalOpen(true);
  };

  // Pending destructive action, confirmed in a ConfirmDialog
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; label: string; bulk?: boolean } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTrack = async (trackId: string) => {
    try {
      await api.delete(`/target-tracks/${trackId}`);
      showNotification('success', 'Target track deleted');
      loadTracks();
    } catch (error) {
      showNotification('error', 'Couldn’t delete the target track.');
      console.error('Error deleting track:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTrack) {
        await api.put(`/target-tracks/${editingTrack.track_id}`, formData);
        showNotification('success', 'Target track saved');
      } else {
        await api.post('/target-tracks', formData);
        showNotification('success', 'Target track added');
      }
      setIsAddModalOpen(false);
      loadTracks();
    } catch (error) {
      showNotification('error', 'Couldn’t save the target track.');
      console.error('Error saving track:', error);
    }
  };

  const handleArchiveTrack = async (trackId: string, archived: boolean) => {
    try {
      await api.put(`/target-tracks/${trackId}`, { archived });
      showNotification('success', `Target track ${archived ? 'archived' : 'restored'}`);
      loadTracks();
    } catch (error) {
      showNotification('error', `Couldn’t ${archived ? 'archive' : 'restore'} the target track.`);
      console.error('Error archiving track:', error);
    }
  };

  const handleUpdateCompletion = async (trackId: string, completion_percentage: number) => {
    try {
      setTracks(prevTracks =>
        prevTracks.map(t =>
          t.track_id === trackId ? { ...t, completion_percentage } : t
        )
      );
      await api.put(`/target-tracks/${trackId}`, { completion_percentage });
    } catch (error) {
      showNotification('error', 'Couldn’t save progress.');
      console.error('Error updating completion:', error);
      loadTracks();
    }
  };

  const handleSearchNow = async (trackId: string) => {
    try {
      await api.post(`/target-tracks/${trackId}/search`);
      showNotification('success', 'Search started');
      loadTracks();
    } catch (error) {
      showNotification('error', 'Couldn’t start the search.');
      console.error('Error triggering search:', error);
    }
  };

  const handleExportTracks = () => {
    const exportData = tracks.map(track => ({
      title: track.title,
      artist: track.artist,
      priority: track.priority,
      genres: track.genres || [],
      search_terms: track.search_terms || [],
      is_active: track.is_active
    }));

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `target_tracks_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showNotification('success', 'Target tracks exported');
  };

  const handleImportTracks = async () => {
    try {
      const parsedData = JSON.parse(importData);
      if (!Array.isArray(parsedData)) {
        throw new Error('Invalid format: Expected array of tracks');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const track of parsedData) {
        try {
          await api.post('/target-tracks', track);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error('Failed to import track:', track, error);
        }
      }

      setIsImportModalOpen(false);
      setImportData('');
      loadTracks();
      showNotification('success', `Imported ${successCount} tracks${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    } catch (error) {
      showNotification('error', 'That isn’t a JSON array of tracks.');
      console.error('Import error:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTracks.size === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const trackId of selectedTracks) {
      try {
        await api.delete(`/target-tracks/${trackId}`);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Failed to delete track:', trackId, error);
      }
    }

    setSelectedTracks(new Set());
    loadTracks();
    showNotification('success', `Deleted ${successCount} tracks${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
  };

  const handleBulkActivate = async (activate: boolean) => {
    if (selectedTracks.size === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const trackId of selectedTracks) {
      try {
        const track = tracks.find(t => t.track_id === trackId);
        if (track) {
          await api.put(`/target-tracks/${trackId}`, { ...track, is_active: activate });
          successCount++;
        }
      } catch (error) {
        errorCount++;
        console.error('Failed to update track:', trackId, error);
      }
    }

    setSelectedTracks(new Set());
    loadTracks();
    showNotification('success', `${activate ? 'Activated' : 'Deactivated'} ${successCount} tracks${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
  };

  const toggleTrackSelection = (trackId: string) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedTracks(newSelected);
  };

  const selectAllTracks = () => {
    setSelectedTracks(new Set(filteredTracks.map(t => t.track_id!)));
  };

  const clearSelection = () => {
    setSelectedTracks(new Set());
  };

  const handleAddFromMusicService = async (musicTracks: any[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const track of musicTracks) {
      try {
        await api.post('/target-tracks', {
          title: track.title,
          artist: track.artist,
          priority: 'medium',
          genres: [],
          is_active: true
        });
        successCount++;
      } catch (error) {
        errorCount++;
        console.error('Failed to add track from music service:', track, error);
      }
    }

    loadTracks();
    showNotification('success', `Added ${successCount} track${successCount !== 1 ? 's' : ''} to targets${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
    setActiveTab('manage');
  };

  const addGenre = () => {
    if (newGenre.trim() && !formData.genres?.includes(newGenre.trim())) {
      setFormData({
        ...formData,
        genres: [...(formData.genres || []), newGenre.trim()]
      });
      setNewGenre('');
    }
  };

  const removeGenre = (genre: string) => {
    setFormData({
      ...formData,
      genres: formData.genres?.filter(g => g !== genre) || []
    });
  };

  const addSearchTerm = () => {
    if (newSearchTerm.trim() && !formData.search_terms?.includes(newSearchTerm.trim())) {
      setFormData({
        ...formData,
        search_terms: [...(formData.search_terms || []), newSearchTerm.trim()]
      });
      setNewSearchTerm('');
    }
  };

  const removeSearchTerm = (term: string) => {
    setFormData({
      ...formData,
      search_terms: formData.search_terms?.filter(t => t !== term) || []
    });
  };

  // Filter tracks based on search, priority, and embedding mode
  const filteredTracks = tracks?.filter(track => {
    if (!showArchived && track.archived) {
      return false;
    }

    if (filterStatus === 'pending' && track.completion_percentage === 100) return false;
    if (filterStatus === 'failed' && track.is_active) return false;
    if (filterStatus === 'active' && !track.is_active) return false;

    const query = searchQuery.toLowerCase();
    const title = track.title?.toLowerCase() || '';
    const artist = track.artist?.toLowerCase() || '';
    const matchesSearch = !searchQuery ||
      title.includes(query) ||
      artist.includes(query);

    const matchesPriority = selectedPriority === 'all' || track.priority === selectedPriority;

    return matchesSearch && matchesPriority;
  }) || [];

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    if (!pendingDelete.bulk) {
      await handleDeleteTrack(pendingDelete.ids[0]);
    } else {
      await handleBulkDelete();
    }
    setDeleting(false);
    setPendingDelete(null);
  };

  const priorityPill = (priority: 'high' | 'medium' | 'low') => {
    const label = priority === 'high' ? 'High priority' : priority === 'medium' ? 'Medium priority' : 'Low priority';
    const status = priority === 'high' ? 'bad' : priority === 'medium' ? 'warn' : 'ok';
    return <StatusPill raw={status} label={label} />;
  };

  const handlePromoteSuggestion = async (suggestion: TargetSuggestion) => {
    try {
      await promoteSuggestion(suggestion);
      showToast(`Added ${suggestion.title} to targets`);
      void loadTracks();
    } catch {
      showToast('Could not add the target');
    }
  };

  return (
    <div className={`ttm ${embedded ? 'ttm--embedded' : ''}`}>
      {!embedded && activeTab === 'manage' && suggestions && suggestions.length > 0 && (
        <section aria-labelledby="ttm-suggestions-title" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Title size="title-m" as="h2" id="ttm-suggestions-title">Suggested for discovery</Title>
          <div style={{ display: 'flex', overflowX: 'auto', gap: 'var(--space-3)', paddingBottom: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            {suggestions.map(s => (
              <Card key={s.id} style={{ flex: '0 0 var(--rail-w)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <Text variant="body-strong">{s.title}</Text>
                  <Text variant="body-s" className="sn-muted">{s.artist}</Text>
                  {s.reason && (
                    <div style={{ marginTop: 'var(--space-2)' }}>
                      <StatusPill raw="info" label={s.reason} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'auto' }}>
                  <button type="button" className="sn-btn sn-btn--quiet sn-btn--sm" onClick={() => dismissSuggestion(s.id)}>Dismiss</button>
                  <button type="button" className="sn-btn sn-btn--quiet sn-btn--sm" onClick={() => { void handlePromoteSuggestion(s); }}>
                    <Plus size={16} strokeWidth={2} aria-hidden="true" /> Add to targets
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="ttm__head">
        <p className="body-s sn-muted">
          <span className="data-strong">{SN.format.count(filteredTracks.length)}</span> target {filteredTracks.length === 1 ? 'track' : 'tracks'}
        </p>
        <div className="ttm__actions">
          <button type="button" className="sn-btn sn-btn--sm" onClick={handleAddTrack}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add target track
          </button>
          <OverflowMenu
            small
            label="More target track actions"
            onSelect={(id) => {
              if (id === 'import') setIsImportModalOpen(true);
              else if (id === 'export') handleExportTracks();
            }}
            items={[
              { id: 'import', label: 'Import from JSON', icon: Upload },
              { id: 'export', label: 'Export as JSON', icon: Download, disabledReason: tracks.length ? undefined : 'Add a target track first' },
            ]}
          />
        </div>
      </div>

      {!embedded && (
        <SegmentedControl<'manage' | 'search'>
          label="Target tracks view"
          size="sm"
          block
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'manage', label: 'Your targets', icon: Target },
            { value: 'search', label: 'Find in services', icon: Search },
          ]}
        />
      )}

      {notification?.type === 'error' && (
        <p className="sn-inline-message sn-inline-message--boxed" data-status="bad" role="alert">{notification.message}</p>
      )}

      {activeTab === 'manage' && (
        <>
          <div className="ttm__filters">
            <input
              type="search"
              className="sn-input"
              placeholder="Search target tracks"
              aria-label="Search target tracks"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="sn-input"
              aria-label="Priority"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
            >
              <option value="all">All priorities</option>
              <option value="high">High priority</option>
              <option value="medium">Medium priority</option>
              <option value="low">Low priority</option>
            </select>
            <label className="sn-checkbox">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              <span className="sn-checkbox__text"><span>Show archived</span></span>
            </label>
          </div>

          {selectedTracks.size > 0 ? (
            <div className="ttm__bulk" role="region" aria-label="Selected target tracks">
              <span role="status" className="data"><strong className="data-strong">{selectedTracks.size}</strong> selected</span>
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleBulkActivate(true)}>Turn on</button>
              <button type="button" className="sn-btn sn-btn--sm" onClick={() => handleBulkActivate(false)}>Turn off</button>
              <button type="button" className="sn-btn sn-btn--sm sn-btn--danger-quiet" onClick={() => setPendingDelete({ ids: Array.from(selectedTracks), label: `${selectedTracks.size} target tracks`, bulk: true })}>
                <Trash2 size={16} strokeWidth={2} aria-hidden="true" />
                Delete…
              </button>
              <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={clearSelection}>Clear selection</button>
            </div>
          ) : filteredTracks.length > 1 ? (
            <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet ttm__selectall" onClick={selectAllTracks}>
              Select all <span className="data-strong">{filteredTracks.length}</span> tracks
            </button>
          ) : null}

          {loading ? (
            <LoadingPanel message="Loading target tracks…" rows={4} />
          ) : loadFailed ? (
            <ErrorPanel
              icon={ServerCrash}
              status="bad"
              panel
              title="SongNodes couldn’t load target tracks"
              retry="Try again in a few minutes."
              actions={<button type="button" className="sn-btn" onClick={loadTracks}>Try again</button>}
            >
              The target tracks API didn’t answer.
            </ErrorPanel>
          ) : filteredTracks.length === 0 ? (
            tracks.length === 0 ? (
              <EmptyPanel
                compact
                icon={Target}
                title="No target tracks yet"
                actions={<button type="button" className="sn-btn" onClick={handleAddTrack}>Add target track</button>}
              >
                Target tracks are the songs the scrapers look for in DJ playlists.
              </EmptyPanel>
            ) : (
              <EmptyPanel
                compact
                icon={SearchX}
                title="No target tracks match these filters"
                actions={<button type="button" className="sn-btn" onClick={() => { setSearchQuery(''); setSelectedPriority('all'); }}>Clear filters</button>}
              >
                None of the {tracks.length} target tracks match.
              </EmptyPanel>
            )
          ) : (
            <ul className="ttm__list">
              {filteredTracks.map((track) => {
                const id = track.track_id!;
                const name = `${track.artist} – ${track.title}`;
                const completion = track.completion_percentage || 0;
                return (
                  <li key={id} className="ttm__item" aria-selected={selectedTracks.has(id)}>
                    <label className="sn-checkbox sn-checkbox--bare">
                      <input type="checkbox" checked={selectedTracks.has(id)} onChange={() => toggleTrackSelection(id)} aria-label={`Select ${name}`} />
                    </label>
                    <div className="ttm__main">
                      <div className="sn-track-cell">
                        <span className="sn-track-cell__title">
                          <span className="sn-track-cell__name" title={name}>
                            <span className="sn-track-cell__artist">{track.artist} –</span> {track.title}
                          </span>
                        </span>
                        <span className="sn-track-cell__meta">
                          <span className="data"><strong className="data-strong">{SN.format.count(track.playlists_found || 0)}</strong> playlists</span>
                          <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                          <span className="data"><strong className="data-strong">{SN.format.count(track.adjacencies_found || 0)}</strong> transitions</span>
                          {track.last_searched ? (
                            <>
                              <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                              <span>Searched <time className="data">{SN.format.date(track.last_searched)}</time></span>
                            </>
                          ) : null}
                          {track.track_id ? (
                            <>
                              <span className="sn-track-cell__sep" aria-hidden="true">·</span>
                              <span className="data" style={{ fontSize: '0.6875rem', color: 'var(--fg-2)' }}>ID: {track.track_id}</span>
                            </>
                          ) : null}
                        </span>
                      </div>
                      <div className="ttm__tags">
                        {priorityPill(track.priority)}
                        {!track.is_active && <StatusPill raw="info" label="Disabled" />}
                        {track.archived && <span className="sn-tag">Archived</span>}
                        {track.genres?.map((genre, idx) => <span key={idx} className="sn-tag">{genre}</span>)}
                      </div>
                      <div className="ttm__progress">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label className="label" htmlFor={`ttm-done-${id}`}>Progress:</label>
                          <span className="data-strong">{completion}%</span>
                        </div>
                        <div className="ttm__progress-track">
                          <div className="ttm__progress-bar" style={{ width: `${completion}%` }} />
                        </div>
                        <input
                          id={`ttm-done-${id}`}
                          type="range"
                          min="0"
                          max="100"
                          value={completion}
                          onChange={(e) => handleUpdateCompletion(id, parseInt(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="ttm__row-actions">
                      <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={() => handleSearchNow(id)}>
                        <Search size={16} strokeWidth={2} aria-hidden="true" />
                        Search now
                      </button>
                      <OverflowMenu
                        small
                        quiet
                        label={`More actions for ${name}`}
                        onSelect={(action) => {
                          if (action === 'edit') handleEditTrack(track);
                          else if (action === 'archive') handleArchiveTrack(id, !track.archived);
                          else if (action === 'delete') setPendingDelete({ ids: [id], label: name });
                        }}
                        items={[
                          { id: 'edit', label: 'Edit target track', icon: Pencil },
                          { id: 'archive', label: track.archived ? 'Restore from archive' : 'Archive', icon: track.archived ? ArchiveRestore : Archive },
                          { id: 'delete', label: 'Delete target track…', icon: Trash2, destructive: true },
                        ]}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {activeTab === 'search' && !embedded && (
        <MusicServiceSearch onAddToTargets={handleAddFromMusicService} />
      )}

      <Dialog
        open={isAddModalOpen}
        title={editingTrack ? 'Edit target track' : 'Add target track'}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleSubmit}
        footer={
          <>
            <button type="button" className="sn-btn" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
            <button type="submit" className="sn-btn sn-btn--primary">{editingTrack ? 'Save target track' : 'Add target track'}</button>
          </>
        }
      >
        <div className="sn-field">
          <label htmlFor="ttm-title">Title</label>
          <input id="ttm-title" className="sn-input" type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
        </div>
        <div className="sn-field">
          <label htmlFor="ttm-artist">Artist</label>
          <input id="ttm-artist" className="sn-input" type="text" value={formData.artist} onChange={(e) => setFormData({ ...formData, artist: e.target.value })} required />
        </div>
        <div className="sn-field">
          <label htmlFor="ttm-priority">Priority</label>
          <select id="ttm-priority" className="sn-input" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'high' | 'medium' | 'low' })}>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
        </div>
        <div className="sn-field">
          <label htmlFor="ttm-genre">Genres</label>
          <div className="ttm__add">
            <input id="ttm-genre" className="sn-input" type="text" value={newGenre} onChange={(e) => setNewGenre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGenre(); } }} placeholder="House" />
            <button type="button" className="sn-btn sn-btn--sm" onClick={addGenre}>Add genre</button>
          </div>
          {formData.genres && formData.genres.length > 0 && (
            <div className="ttm__chips">
              {formData.genres.map((genre, idx) => (
                <span key={idx} className="sn-tag">
                  {genre}
                  <button type="button" className="sn-chip-input__remove" onClick={() => removeGenre(genre)} aria-label={`Remove genre ${genre}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="sn-field">
          <label htmlFor="ttm-term">Search terms</label>
          <div className="ttm__add">
            <input id="ttm-term" className="sn-input" type="text" value={newSearchTerm} onChange={(e) => setNewSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSearchTerm(); } }} placeholder="Extended mix" />
            <button type="button" className="sn-btn sn-btn--sm" onClick={addSearchTerm}>Add term</button>
          </div>
          {formData.search_terms && formData.search_terms.length > 0 && (
            <div className="ttm__chips">
              {formData.search_terms.map((term, idx) => (
                <span key={idx} className="sn-tag">
                  {term}
                  <button type="button" className="sn-chip-input__remove" onClick={() => removeSearchTerm(term)} aria-label={`Remove search term ${term}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <label className="sn-checkbox">
          <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} />
          <span className="sn-checkbox__text"><span>Search for this track</span></span>
        </label>
      </Dialog>

      <Dialog
        open={isImportModalOpen}
        title="Import target tracks"
        sub="Paste a JSON array with title, artist, priority, genres, search_terms and is_active."
        onClose={() => { setIsImportModalOpen(false); setImportData(''); }}
        footer={
          <>
            <button type="button" className="sn-btn" onClick={() => { setIsImportModalOpen(false); setImportData(''); }}>Cancel</button>
            <button type="button" className="sn-btn sn-btn--primary" onClick={handleImportTracks} disabled={!importData.trim()}>Import tracks</button>
          </>
        }
      >
        <div className="sn-field">
          <label htmlFor="ttm-json">JSON</label>
          <textarea
            id="ttm-json"
            className="sn-input ttm__json"
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder={`[\n  { "title": "Glue", "artist": "Bicep", "priority": "medium" }\n]`}
            rows={10}
          />
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete?.bulk ? `Delete ${pendingDelete.ids.length} target tracks?` : `Delete “${pendingDelete?.label ?? ''}”?`}
        confirmLabel={pendingDelete?.bulk ? `Delete ${pendingDelete.ids.length} tracks` : 'Delete target track'}
        busy={deleting}
        busyLabel="Deleting…"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        facts={['Playlists and transitions already scraped stay in the graph.']}
      >
        The scrapers stop looking for {pendingDelete?.bulk ? 'these tracks' : 'this track'}. This can’t be undone; archive instead to pause it.
      </ConfirmDialog>
    </div>
  );
};

export default TargetTracksManager;
