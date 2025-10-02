import React, { useState } from 'react';
import { api } from '../services/api';
import clsx from 'clsx';

interface MusicServiceTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration_ms?: number;
  spotify_id?: string;
  tidal_id?: string;
  preview_url?: string;
  image_url?: string;
  service: 'spotify' | 'tidal';
}

interface Props {
  onAddToTargets: (tracks: MusicServiceTrack[]) => void;
}

const MusicServiceSearch: React.FC<Props> = ({ onAddToTargets }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<'both' | 'spotify' | 'tidal'>('both');
  const [searchResults, setSearchResults] = useState<MusicServiceTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      const services = selectedService === 'both' ? ['spotify', 'tidal'] : [selectedService];
      const allResults: MusicServiceTrack[] = [];

      for (const service of services) {
        try {
          const response = await api.get(`/music-search/${service}`, {
            params: { q: searchQuery, limit: 20 }
          });

          const tracks = response.data.tracks?.map((track: any) => ({
            id: `${service}_${track.id}`,
            title: track.name || track.title,
            artist: track.artists?.[0]?.name || track.artist,
            album: track.album?.name,
            duration_ms: track.duration_ms,
            spotify_id: service === 'spotify' ? track.id : undefined,
            tidal_id: service === 'tidal' ? track.id : undefined,
            preview_url: track.preview_url,
            image_url: track.album?.images?.[0]?.url || track.image,
            service: service as 'spotify' | 'tidal'
          })) || [];

          allResults.push(...tracks);
        } catch (err) {
          console.error(`Error searching ${service}:`, err);
          // Continue with other service even if one fails
        }
      }

      if (allResults.length === 0 && services.length > 0) {
        setError('No results found. Check your API keys in Settings.');
      }

      setSearchResults(allResults);
    } catch (err: any) {
      setError(err.message || 'Search failed');
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
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

  const handleAddSelected = () => {
    const tracksToAdd = searchResults.filter(t => selectedTracks.has(t.id));
    onAddToTargets(tracksToAdd);
    setSelectedTracks(new Set());
  };

  const selectAll = () => {
    setSelectedTracks(new Set(searchResults.map(t => t.id)));
  };

  const clearSelection = () => {
    setSelectedTracks(new Set());
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Controls */}
      <div className="flex-shrink-0 space-y-4 p-4 border-b border-dj-gray">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search for tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
          />
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value as any)}
            className="px-3 py-2 bg-dj-black border border-dj-gray rounded focus:outline-none focus:border-dj-accent"
          >
            <option value="both">Both Services</option>
            <option value="spotify">Spotify Only</option>
            <option value="tidal">Tidal Only</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-dj-accent text-black rounded hover:bg-opacity-90 transition-all disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : '🔍 Search'}
          </button>
        </div>

        {error && (
          <div className="bg-dj-danger bg-opacity-20 border border-dj-danger rounded p-3 text-sm">
            {error}
          </div>
        )}

        {selectedTracks.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-dj-black border border-dj-accent rounded">
            <span className="text-sm">{selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected</span>
            <div className="flex gap-2">
              <button
                onClick={handleAddSelected}
                className="px-3 py-1 bg-dj-accent text-black rounded text-sm hover:bg-opacity-90"
              >
                ➕ Add to Targets
              </button>
              <button
                onClick={selectAll}
                className="px-3 py-1 bg-dj-gray text-gray-300 rounded text-sm hover:bg-opacity-90"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1 bg-dj-gray text-gray-300 rounded text-sm hover:bg-opacity-90"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {isSearching ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dj-accent"></div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {searchQuery ? 'No results found. Try a different search.' : 'Search for tracks to add to your target list'}
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((track) => (
              <div
                key={track.id}
                className={clsx(
                  "bg-dj-black border rounded-lg p-3 transition-all cursor-pointer",
                  selectedTracks.has(track.id)
                    ? "border-dj-accent bg-dj-accent bg-opacity-10"
                    : "border-dj-gray hover:border-dj-accent"
                )}
                onClick={() => toggleTrackSelection(track.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.id)}
                    onChange={() => {}}
                    className="rounded border-dj-gray"
                  />

                  {/* Album Art */}
                  {track.image_url && (
                    <img
                      src={track.image_url}
                      alt={track.album}
                      className="w-12 h-12 rounded"
                    />
                  )}

                  {/* Track Info */}
                  <div className="flex-1">
                    <h4 className="font-semibold">{track.title}</h4>
                    <p className="text-sm text-gray-400">{track.artist}</p>
                    {track.album && (
                      <p className="text-xs text-gray-500">{track.album}</p>
                    )}
                  </div>

                  {/* Service Badge */}
                  <div className="flex items-center gap-2">
                    {track.duration_ms && (
                      <span className="text-xs text-gray-500">
                        {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    )}
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-semibold uppercase',
                      track.service === 'spotify' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                    )}>
                      {track.service}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicServiceSearch;
