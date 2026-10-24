import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { api } from '../services/api';
import MusicServiceSearch from './MusicServiceSearch';
import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Input } from './ui';

interface TargetTrack {
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

const TargetTracksManager: React.FC = () => {
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

  const modalRef = useRef<HTMLDivElement>(null);

  // Load target tracks
  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/target-tracks');
      setTracks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification('error', 'Failed to load target tracks');
      console.error('Error loading tracks:', error);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
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

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm('Are you sure you want to delete this target track?')) return;

    try {
      await api.delete(`/target-tracks/${trackId}`);
      showNotification('success', 'Track deleted successfully');
      loadTracks();
    } catch (error) {
      showNotification('error', 'Failed to delete track');
      console.error('Error deleting track:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTrack) {
        await api.put(`/target-tracks/${editingTrack.track_id}`, formData);
        showNotification('success', 'Track updated successfully');
      } else {
        await api.post('/target-tracks', formData);
        showNotification('success', 'Track added successfully');
      }
      setIsAddModalOpen(false);
      loadTracks();
    } catch (error) {
      showNotification('error', 'Failed to save track');
      console.error('Error saving track:', error);
    }
  };

  const handleArchiveTrack = async (trackId: string, archived: boolean) => {
    try {
      await api.put(`/target-tracks/${trackId}`, { archived });
      showNotification('success', `Track ${archived ? 'archived' : 'unarchived'} successfully`);
      loadTracks();
    } catch (error) {
      showNotification('error', `Failed to ${archived ? 'archive' : 'unarchive'} track`);
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
      showNotification('error', 'Failed to update completion');
      console.error('Error updating completion:', error);
      loadTracks();
    }
  };

  const handleSearchNow = async (trackId: string) => {
    try {
      await api.post(`/target-tracks/${trackId}/search`);
      showNotification('success', 'Search triggered for track');
      loadTracks();
    } catch (error) {
      showNotification('error', 'Failed to trigger search');
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
    showNotification('success', 'Tracks exported successfully');
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
      showNotification('error', 'Failed to parse import data');
      console.error('Import error:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTracks.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedTracks.size} tracks?`)) return;

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

  // Filter tracks based on search and priority
  const filteredTracks = tracks?.filter(track => {
    if (!showArchived && track.archived) {
      return false;
    }

    const query = searchQuery.toLowerCase();
    const title = track.title?.toLowerCase() || '';
    const artist = track.artist?.toLowerCase() || '';
    const matchesSearch = !searchQuery ||
      title.includes(query) ||
      artist.includes(query);

    const matchesPriority = selectedPriority === 'all' || track.priority === selectedPriority;

    return matchesSearch && matchesPriority;
  }) || [];

  // Priority badge component
  const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const variants: Record<string, 'error' | 'warning' | 'secondary'> = {
      high: 'error',
      medium: 'warning',
      low: 'secondary'
    };

    return (
      <Badge variant={variants[priority] || 'secondary'} size="sm">
        {priority.toUpperCase()}
      </Badge>
    );
  };

  // Close modal on escape or outside click
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddModalOpen) {
        setIsAddModalOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsAddModalOpen(false);
      }
    };

    if (isAddModalOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAddModalOpen]);

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <Card variant="elevated" className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <span>🎯</span> Target Tracks Manager
            {(tracks?.length ?? 0) > 0 && (
              <span className="text-xs text-[var(--color-text-tertiary)] font-normal">({tracks.length} tracks)</span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTracks}
              disabled={(tracks?.length ?? 0) === 0}
            >
              📤 Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
            >
              📥 Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddTrack}
            >
              + Add Track
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-[var(--color-border-subtle)] pb-2">
          <Button
            variant={activeTab === 'manage' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('manage')}
          >
            📋 Manage Tracks
          </Button>
          <Button
            variant={activeTab === 'search' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('search')}
          >
            🔍 Search Services
          </Button>
        </div>

        {/* Tab Content: Manage Tracks Controls */}
        {activeTab === 'manage' && (
          <div className="space-y-4 pt-2">
            {/* Bulk Operations Bar */}
            {selectedTracks.size > 0 && (
              <Card variant="default" className="p-3 bg-[var(--color-bg-elevated-2)] border-[var(--color-border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => handleBulkActivate(true)}>
                    ✅ Activate
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleBulkActivate(false)}>
                    ⏸️ Deactivate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[var(--color-error-border)] text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                    onClick={handleBulkDelete}
                  >
                    🗑️ Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    ✖️ Clear
                  </Button>
                </div>
              </Card>
            )}

            {/* Filters */}
            <div className="flex gap-3 items-center">
              <Input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-md text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)]"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-brand-primary)]"
                />
                Show Archived
              </label>
              {filteredTracks.length > 0 && (
                <Button size="sm" variant="outline" onClick={selectAllTracks}>
                  Select All
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {activeTab === 'manage' ? (
          loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand-primary)]"></div>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center text-[var(--color-text-tertiary)] py-8 text-sm">
              No target tracks found. Add some tracks to get started!
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTracks.map((track) => (
                <Card
                  key={track.track_id}
                  variant="default"
                  className={`p-4 transition-all border ${
                    selectedTracks.has(track.track_id!)
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]'
                      : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedTracks.has(track.track_id!)}
                      onChange={() => toggleTrackSelection(track.track_id!)}
                      className="mt-1 w-4 h-4 accent-[var(--color-brand-primary)]"
                    />

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base text-[var(--color-text-primary)] truncate">{track.title}</h3>
                        <PriorityBadge priority={track.priority} />
                        {!track.is_active && (
                          <Badge variant="secondary" size="sm">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">by {track.artist}</p>

                      <div className="flex gap-4 text-xs text-[var(--color-text-tertiary)]">
                        <span>📋 {track.playlists_found || 0} playlists</span>
                        <span>🔗 {track.adjacencies_found || 0} adjacencies</span>
                        {track.last_searched && (
                          <span>🔍 Last searched: {new Date(track.last_searched).toLocaleDateString()}</span>
                        )}
                      </div>

                      {track.genres && track.genres.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {track.genres.map((genre, idx) => (
                            <Badge key={idx} variant="outline" size="sm">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Completion Slider */}
                      <div className="pt-2 space-y-1">
                        <div className="flex justify-between text-[11px] text-[var(--color-text-tertiary)]">
                          <span>Completion</span>
                          <span>{track.completion_percentage || 0}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={track.completion_percentage || 0}
                          onChange={(e) =>
                            handleUpdateCompletion(track.track_id!, parseInt(e.target.value))
                          }
                          className="w-full h-1.5 bg-[var(--color-bg-elevated-3)] rounded appearance-none cursor-pointer accent-[var(--color-brand-primary)]"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleArchiveTrack(track.track_id!, !track.archived)}
                        title={track.archived ? 'Unarchive' : 'Archive'}
                      >
                        {track.archived ? '📂' : '🗄️'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSearchNow(track.track_id!)}
                        title="Search now"
                      >
                        🔍
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTrack(track)}
                        title="Edit"
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[var(--color-error)]"
                        onClick={() => handleDeleteTrack(track.track_id!)}
                        title="Delete"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : (
          <MusicServiceSearch onAddToTargets={handleAddFromMusicService} />
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-modal-overlay)] flex items-center justify-center z-[var(--z-modal)] p-4 backdrop-blur-sm">
          <Card ref={modalRef} variant="elevated" className="w-full max-w-md p-6 border-[var(--color-border-default)] bg-[var(--color-bg-elevated-1)] space-y-4">
            <CardTitle className="text-lg font-bold">
              {editingTrack ? 'Edit Target Track' : 'Add Target Track'}
            </CardTitle>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Title</label>
                <Input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Artist</label>
                <Input
                  type="text"
                  required
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-md text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)]"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Genres */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Genres</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGenre())}
                      placeholder="Add genre..."
                      className="flex-1"
                    />
                    <Button type="button" size="sm" variant="secondary" onClick={addGenre}>
                      Add
                    </Button>
                  </div>
                  {formData.genres && formData.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.genres.map((genre, index) => (
                        <Badge key={index} variant="outline" size="sm" className="flex items-center gap-1">
                          {genre}
                          <button
                            type="button"
                            onClick={() => removeGenre(genre)}
                            className="text-[var(--color-error)] ml-1"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 accent-[var(--color-brand-primary)]"
                  />
                  Active
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" variant="primary" className="flex-1">
                  {editingTrack ? 'Update' : 'Add'}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-[var(--color-modal-overlay)] flex items-center justify-center z-[var(--z-modal)] p-4 backdrop-blur-sm">
          <Card variant="elevated" className="w-full max-w-lg p-6 border-[var(--color-border-default)] bg-[var(--color-bg-elevated-1)] space-y-4">
            <CardTitle className="text-lg font-bold">Import Target Tracks</CardTitle>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                  JSON Data
                  <span className="text-[var(--color-text-tertiary)] ml-2">(Paste JSON array of tracks)</span>
                </label>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder={`[
  {
    "title": "Track Name",
    "artist": "Artist Name",
    "priority": "medium",
    "genres": ["Electronic", "House"],
    "is_active": true
  }
]`}
                  className="w-full h-48 px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-md text-[var(--color-text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--color-input-focus)]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleImportTracks}
                  disabled={!importData.trim()}
                >
                  Import Tracks
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportData('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={clsx(
            'fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg transition-all z-50 text-xs font-semibold',
            notification.type === 'success'
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]'
              : 'bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error-border)]'
          )}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default TargetTracksManager;
