import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { api } from '../services/api';

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

  // Form state for add/edit
  const [formData, setFormData] = useState<Partial<TargetTrack>>({
    title: '',
    artist: '',
    priority: 'medium',
    genres: [],
    search_terms: [],
    is_active: true
  });

  const modalRef = useRef<HTMLDivElement>(null);

  // Load target tracks
  useEffect(() => {
    loadTracks();
  }, []);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/target-tracks');
      setTracks(response.data);
    } catch (error) {
      showNotification('error', 'Failed to load target tracks');
      console.error('Error loading tracks:', error);
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
    setEditingTrack(null);
    setIsAddModalOpen(true);
  };

  const handleEditTrack = (track: TargetTrack) => {
    setFormData(track);
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

  // Filter tracks based on search and priority
  const filteredTracks = tracks.filter(track => {
    const matchesSearch = !searchQuery ||
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPriority = selectedPriority === 'all' || track.priority === selectedPriority;

    return matchesSearch && matchesPriority;
  });

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
          </h2>
          <button
            onClick={handleAddTrack}
            className="px-4 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            Add Track
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
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
        </div>
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
                className="bg-dj-black border border-dj-gray rounded-lg p-4 hover:border-dj-accent transition-all"
              >
                <div className="flex items-start justify-between">
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

      {/* Notification */}
      {notification && (
        <div
          className={clsx(
            'fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg transition-all',
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