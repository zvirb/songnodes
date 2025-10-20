import React, { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { api } from '../services/api';
import MusicServiceSearch from './MusicServiceSearch';

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
      // ✅ FIX: Ensure we always set an array, even if API returns undefined
      setTracks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showNotification('error', 'Failed to load target tracks');
      console.error('Error loading tracks:', error);
      // ✅ FIX: Set empty array on error to prevent undefined state
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
    const colors = {
      high: 'bg-dj-danger text-white',
      medium: 'bg-dj-warning text-black',
      low: 'bg-dj-light-gray text-gray-300'
    };

    return (
      <span className={clsx(
        'px-2 py-1 rounded text-xs font-semibold uppercase',
        colors[priority as keyof typeof colors] || colors.low
      )}>
        {priority}
      </span>
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
    <div className="h-full flex flex-col bg-dj-dark text-gray-200">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-dj-gray p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Target Tracks Manager
            {(tracks?.length ?? 0) > 0 && (
              <span className="text-sm text-gray-400 font-normal">({tracks.length} tracks)</span>
            )}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportTracks}
              className="px-3 py-2 bg-dj-gray text-gray-300 rounded hover:bg-opacity-90 transition-all flex items-center gap-1 text-sm"
              disabled={(tracks?.length ?? 0) === 0}
            >
              📤 Export
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 bg-dj-gray text-gray-300 rounded hover:bg-opacity-90 transition-all flex items-center gap-1 text-sm"
            >
              📥 Import
            </button>
            <button
              onClick={handleAddTrack}
              className="px-4 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all flex items-center gap-2"
            >
              <span className="text-lg">+</span>
              Add Track
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-dj-gray mb-4">
          <button
            onClick={() => setActiveTab('manage')}
            className={clsx(
              'px-4 py-2 font-semibold transition-all',
              activeTab === 'manage'
                ? 'text-dj-accent border-b-2 border-dj-accent'
                : 'text-gray-400 hover:text-gray-300'
            )}
          >
            📋 Manage Tracks
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={clsx(
              'px-4 py-2 font-semibold transition-all',
              activeTab === 'search'
                ? 'text-dj-accent border-b-2 border-dj-accent'
                : 'text-gray-400 hover:text-gray-300'
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
              <div className="mb-4 p-3 bg-dj-black border border-dj-accent rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkActivate(true)}
                  className="px-3 py-1 bg-dj-accent text-black rounded text-sm hover:bg-opacity-90"
                >
                  ✅ Activate
                </button>
                <button
                  onClick={() => handleBulkActivate(false)}
                  className="px-3 py-1 bg-dj-gray text-gray-300 rounded text-sm hover:bg-opacity-90"
                >
                  ⏸️ Deactivate
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-dj-danger text-white rounded text-sm hover:bg-opacity-90"
                >
                  🗑️ Delete
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 bg-dj-gray text-gray-300 rounded text-sm hover:bg-opacity-90"
                >
                  ✖️ Clear
                </button>
              </div>
            </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
              />
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              {filteredTracks.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={selectAllTracks}
                    className="px-3 py-2 bg-dj-gray text-gray-300 rounded text-sm hover:bg-opacity-90"
                  >
                    Select All
                  </button>
                  {selectedTracks.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="px-3 py-2 bg-dj-gray text-gray-300 rounded text-sm hover:bg-opacity-90"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Track List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dj-accent"></div>
                </div>
              ) : filteredTracks.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No target tracks found. Add some tracks to get started!
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTracks.map((track) => (
                    <div
                      key={track.track_id}
                      className={clsx(
                        "bg-dj-black border rounded-lg p-4 transition-all",
                        selectedTracks.has(track.track_id!)
                          ? "border-dj-accent bg-dj-accent bg-opacity-10"
                          : "border-dj-gray hover:border-dj-accent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection Checkbox */}
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={selectedTracks.has(track.track_id!)}
                            onChange={() => toggleTrackSelection(track.track_id!)}
                            className="rounded border-dj-gray"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{track.title}</h3>
                            <PriorityBadge priority={track.priority} />
                            {!track.is_active && (
                              <span className="px-2 py-1 bg-dj-gray text-gray-500 rounded text-xs">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 mb-2">by {track.artist}</p>

                          {/* Stats */}
                          <div className="flex gap-4 text-sm text-gray-500">
                            <span>📋 {track.playlists_found || 0} playlists</span>
                            <span>🔗 {track.adjacencies_found || 0} adjacencies</span>
                            {track.last_searched && (
                              <span>🔍 Last searched: {new Date(track.last_searched).toLocaleDateString()}</span>
                            )}
                          </div>

                          {/* Genres and Search Terms */}
                          {track.genres && track.genres.length > 0 && (
                            <div className="mt-2 flex gap-2">
                              {track.genres.map((genre, idx) => (
                                <span key={idx} className="px-2 py-1 bg-dj-gray rounded text-xs">
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleSearchNow(track.track_id!)}
                            className="p-2 text-dj-accent hover:bg-dj-gray rounded transition-all"
                            title="Search now"
                          >
                            🔍
                          </button>
                          <button
                            onClick={() => handleEditTrack(track)}
                            className="p-2 text-gray-400 hover:text-white hover:bg-dj-gray rounded transition-all"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(track.track_id!)}
                            className="p-2 text-dj-danger hover:bg-dj-gray rounded transition-all"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div ref={modalRef} className="bg-dj-dark border border-dj-gray rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingTrack ? 'Edit Target Track' : 'Add Target Track'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Artist</label>
                <input
                  type="text"
                  required
                  value={formData.artist}
                  onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                  className="w-full px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Genres */}
              <div>
                <label className="block text-sm font-medium mb-1">Genres</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newGenre}
                      onChange={(e) => setNewGenre(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGenre())}
                      placeholder="Add genre..."
                      className="flex-1 px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
                    />
                    <button
                      type="button"
                      onClick={addGenre}
                      className="px-3 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all"
                    >
                      Add
                    </button>
                  </div>
                  {formData.genres && formData.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.genres.map((genre, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-dj-gray rounded text-sm flex items-center gap-1"
                        >
                          {genre}
                          <button
                            type="button"
                            onClick={() => removeGenre(genre)}
                            className="text-dj-danger hover:text-red-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Search Terms */}
              <div>
                <label className="block text-sm font-medium mb-1">Search Terms</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSearchTerm}
                      onChange={(e) => setNewSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSearchTerm())}
                      placeholder="Add search term..."
                      className="flex-1 px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
                    />
                    <button
                      type="button"
                      onClick={addSearchTerm}
                      className="px-3 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all"
                    >
                      Add
                    </button>
                  </div>
                  {formData.search_terms && formData.search_terms.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.search_terms.map((term, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-dj-gray rounded text-sm flex items-center gap-1"
                        >
                          {term}
                          <button
                            type="button"
                            onClick={() => removeSearchTerm(term)}
                            className="text-dj-danger hover:text-red-400 ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded border-dj-gray"
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all"
                >
                  {editingTrack ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-dj-gray text-gray-300 rounded hover:bg-opacity-90 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dj-dark border border-dj-gray rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">Import Target Tracks</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  JSON Data
                  <span className="text-gray-400 ml-2">(Paste JSON array of tracks)</span>
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
                  className="w-full h-64 px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent font-mono text-sm"
                />
              </div>

              <div className="bg-dj-black p-3 rounded border border-dj-gray">
                <p className="text-sm text-gray-400">
                  <strong>Format:</strong> JSON array with fields: title, artist, priority, genres, search_terms, is_active
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleImportTracks}
                  disabled={!importData.trim()}
                  className="flex-1 px-4 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  Import Tracks
                </button>
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportData('');
                  }}
                  className="flex-1 px-4 py-2 bg-dj-gray text-gray-300 rounded hover:bg-opacity-90 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div
          className={clsx(
            'fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg transition-all z-50',
            notification.type === 'success' ? 'bg-dj-accent text-black' : 'bg-dj-danger text-white'
          )}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default TargetTracksManager;