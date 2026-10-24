import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { api } from '../services/api';
import MusicServiceSearch from './MusicServiceSearch';
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, Card, CardHeader, CardTitle, CardContent } from './ui';

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

  // Priority badge component using design system tokens
  const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
    const badgeVariantMap = {
      high: 'error' as const,
      medium: 'warning' as const,
      low: 'secondary' as const,
    };

    return (
      <Badge variant={badgeVariantMap[priority as keyof typeof badgeVariantMap] || 'secondary'} size="sm">
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
    <div className="h-full flex flex-col bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[var(--color-border-subtle)] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>🎯</span>
            Target Tracks Manager
            {(tracks?.length ?? 0) > 0 && (
              <span className="text-sm text-[var(--color-text-secondary)] font-normal">({tracks.length} tracks)</span>
            )}
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={handleExportTracks}
              variant="outline"
              size="sm"
              disabled={(tracks?.length ?? 0) === 0}
            >
              Export
            </Button>
            <Button
              onClick={() => setIsImportModalOpen(true)}
              variant="outline"
              size="sm"
            >
              Import
            </Button>
            <Button
              onClick={handleAddTrack}
              variant="primary"
              size="sm"
            >
              + Add Track
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-[var(--color-border-subtle)] mb-4">
          <button
            onClick={() => setActiveTab('manage')}
            className={clsx(
              'px-4 py-2 font-semibold text-sm transition-all border-b-2',
              activeTab === 'manage'
                ? 'text-[var(--color-brand-primary)] border-[var(--color-brand-primary)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
            )}
          >
            📋 Manage Tracks
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={clsx(
              'px-4 py-2 font-semibold text-sm transition-all border-b-2',
              activeTab === 'search'
                ? 'text-[var(--color-brand-primary)] border-[var(--color-brand-primary)]'
                : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
            )}
          >
            🔍 Search Services
          </button>
        </div>

        {/* Tab Content: Manage Tracks */}
        {activeTab === 'manage' && (
          <>
            {/* Bulk Operations Bar */}
            {selectedTracks.size > 0 && (
              <div className="mb-4 p-3 bg-[var(--color-bg-elevated-2)] border border-[var(--color-brand-primary)] rounded-[var(--radius-card)] flex items-center justify-between">
                <span className="text-sm text-[var(--color-text-primary)] font-medium">
                  {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleBulkActivate(true)}
                    size="xs"
                    variant="primary"
                  >
                    Activate
                  </Button>
                  <Button
                    onClick={() => handleBulkActivate(false)}
                    size="xs"
                    variant="secondary"
                  >
                    Deactivate
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    size="xs"
                    className="bg-[var(--color-error)] text-white hover:bg-[var(--color-brand-tertiary-hover)]"
                  >
                    Delete
                  </Button>
                  <Button
                    onClick={clearSelection}
                    size="xs"
                    variant="ghost"
                  >
                    Clear
                  </Button>
                </div>
              </div>
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
              <Select
                value={selectedPriority}
                onValueChange={(val) => setSelectedPriority(val as any)}
              >
                <SelectTrigger className="w-[150px] bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--color-bg-elevated-2)] border-[var(--color-border-default)] text-[var(--color-text-primary)]">
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border-default)] accent-[var(--color-brand-primary)]"
                />
                <span>Show Archived</span>
              </label>

              {filteredTracks.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={selectAllTracks}
                    size="sm"
                    variant="secondary"
                  >
                    Select All
                  </Button>
                  {selectedTracks.size > 0 && (
                    <Button
                      onClick={clearSelection}
                      size="sm"
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand-primary)]"></div>
                </div>
              ) : filteredTracks.length === 0 ? (
                <div className="text-center text-[var(--color-text-tertiary)] py-8">
                  No target tracks found. Add some tracks to get started!
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTracks.map((track) => {
                    const isSelected = selectedTracks.has(track.track_id!);
                    return (
                      <Card
                        key={track.track_id}
                        className={clsx(
                          "transition-all p-4 border rounded-[var(--radius-card)] bg-[var(--color-card-bg)]",
                          isSelected
                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                            : "border-[var(--color-card-border)] hover:border-[var(--color-border-strong)]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection Checkbox */}
                          <div className="pt-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleTrackSelection(track.track_id!)}
                              className="w-4 h-4 rounded border-[var(--color-border-default)] accent-[var(--color-brand-primary)] cursor-pointer"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="font-semibold text-base text-[var(--color-text-primary)]">{track.title}</h3>
                              <PriorityBadge priority={track.priority} />
                              {!track.is_active && (
                                <Badge variant="secondary" size="sm">Inactive</Badge>
                              )}
                            </div>
                            <p className="text-sm text-[var(--color-text-secondary)] mb-2">by {track.artist}</p>

                            {/* Stats */}
                            <div className="flex gap-4 text-xs text-[var(--color-text-tertiary)] flex-wrap">
                              <span>📋 {track.playlists_found || 0} playlists</span>
                              <span>🔗 {track.adjacencies_found || 0} adjacencies</span>
                              {track.last_searched && (
                                <span>🔍 Last: {new Date(track.last_searched).toLocaleDateString()}</span>
                              )}
                            </div>

                            {/* Genres */}
                            {track.genres && track.genres.length > 0 && (
                              <div className="mt-2 flex gap-1.5 flex-wrap">
                                {track.genres.map((genre, idx) => (
                                  <Badge key={idx} variant="outline" size="sm">
                                    {genre}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1 shrink-0">
                            <Button
                              onClick={() => handleArchiveTrack(track.track_id!, !track.archived)}
                              variant="ghost"
                              size="xs"
                              title={track.archived ? 'Unarchive' : 'Archive'}
                            >
                              {track.archived ? '📂' : '🗄️'}
                            </Button>
                            <Button
                              onClick={() => handleSearchNow(track.track_id!)}
                              variant="ghost"
                              size="xs"
                              title="Search now"
                            >
                              🔍
                            </Button>
                            <Button
                              onClick={() => handleEditTrack(track)}
                              variant="ghost"
                              size="xs"
                              title="Edit"
                            >
                              ✏️
                            </Button>
                            <Button
                              onClick={() => handleDeleteTrack(track.track_id!)}
                              variant="ghost"
                              size="xs"
                              className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)]"
                              title="Delete"
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>

                        {/* Completion Slider */}
                        <div className="mt-3 pt-2 border-t border-[var(--color-border-subtle)]">
                          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-1">
                            <span>Match Completion</span>
                            <span className="font-mono">{track.completion_percentage || 0}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={track.completion_percentage || 0}
                            onChange={(e) =>
                              handleUpdateCompletion(track.track_id!, parseInt(e.target.value))
                            }
                            className="w-full h-1.5 bg-[var(--color-bg-elevated-3)] rounded-lg appearance-none cursor-pointer accent-[var(--color-brand-primary)]"
                          />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab Content: Search Services */}
        {activeTab === 'search' && (
          <div className="flex-1 overflow-hidden">
            <MusicServiceSearch onAddToTargets={handleAddFromMusicService} />
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className="bg-[var(--color-bg-elevated-2)] border border-[var(--color-border-default)] rounded-[var(--radius-modal)] p-6 w-full max-w-md shadow-[var(--shadow-modal)]">
            <h3 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">
              {editingTrack ? 'Edit Target Track' : 'Add Target Track'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Title</label>
                <Input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Artist</label>
                <Input
                  type="text"
                  required
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Priority</label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) => setFormData({ ...formData, priority: val as any })}
                >
                  <SelectTrigger className="w-full bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--color-bg-elevated-3)] border-[var(--color-border-default)] text-[var(--color-text-primary)]">
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Genres */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Genres</label>
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
                    <Button
                      type="button"
                      onClick={addGenre}
                      variant="secondary"
                    >
                      Add
                    </Button>
                  </div>
                  {formData.genres && formData.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.genres.map((genre, index) => (
                        <Badge key={index} variant="secondary" size="sm" className="gap-1">
                          {genre}
                          <button
                            type="button"
                            onClick={() => removeGenre(genre)}
                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Search Terms */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Search Terms</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newSearchTerm}
                      onChange={(e) => setNewSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSearchTerm())}
                      placeholder="Add search term..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={addSearchTerm}
                      variant="secondary"
                    >
                      Add
                    </Button>
                  </div>
                  {formData.search_terms && formData.search_terms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.search_terms.map((term, index) => (
                        <Badge key={index} variant="outline" size="sm" className="gap-1">
                          {term}
                          <button
                            type="button"
                            onClick={() => removeSearchTerm(term)}
                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
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
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--color-border-default)] accent-[var(--color-brand-primary)]"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                >
                  {editingTrack ? 'Update' : 'Add'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  variant="secondary"
                  fullWidth
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-bg-elevated-2)] border border-[var(--color-border-default)] rounded-[var(--radius-modal)] p-6 w-full max-w-lg shadow-[var(--shadow-modal)]">
            <h3 className="text-lg font-bold mb-4 text-[var(--color-text-primary)]">Import Target Tracks</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                  JSON Data <span className="text-[var(--color-text-disabled)]">(Paste JSON array of tracks)</span>
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
    "search_terms": ["remix", "original mix"],
    "is_active": true
  }
]`}
                  className="w-full h-64 p-3 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-[var(--radius-input)] text-[var(--color-text-primary)] font-mono text-xs focus:outline-none focus:border-[var(--color-border-focus)]"
                />
              </div>

              <div className="bg-[var(--color-bg-elevated-1)] p-3 rounded-[var(--radius-base)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-tertiary)]">
                <strong>Format:</strong> JSON array with fields: title, artist, priority, genres, search_terms, is_active
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleImportTracks}
                  disabled={!importData.trim()}
                  variant="primary"
                  fullWidth
                >
                  Import Tracks
                </Button>
                <Button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportData('');
                  }}
                  variant="secondary"
                  fullWidth
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={clsx(
            'fixed bottom-4 right-4 px-4 py-2 rounded-[var(--radius-base)] shadow-lg transition-all z-50 text-sm font-medium',
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
