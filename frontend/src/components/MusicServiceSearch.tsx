import React, { useState } from 'react';
import { api } from '../services/api';
import { Button, Badge, Card, Input } from './ui';

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
          const response = await (api as any).get(`/music-search/${service}`, {
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
    <div className="h-full flex flex-col space-y-4">
      {/* Search Controls */}
      <Card variant="elevated" className="p-4 space-y-4">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search for tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value as any)}
            className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-md text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-input-focus)]"
          >
            <option value="both">Both Services</option>
            <option value="spotify">Spotify Only</option>
            <option value="tidal">Tidal Only</option>
          </select>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            variant="primary"
          >
            {isSearching ? 'Searching...' : '🔍 Search'}
          </Button>
        </div>

        {error && (
          <Card className="border-[var(--color-error-border)] bg-[var(--color-error-bg)] p-3">
            <p className="text-xs text-[var(--color-error)] font-medium">{error}</p>
          </Card>
        )}

        {selectedTracks.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated-2)] border border-[var(--color-border-subtle)] rounded-lg">
            <span className="text-sm text-[var(--color-text-secondary)] font-medium">
              {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleAddSelected}>
                ➕ Add to Targets
              </Button>
              <Button size="sm" variant="outline" onClick={selectAll}>
                Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isSearching ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand-primary)]"></div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center text-[var(--color-text-tertiary)] py-8 text-sm">
            {searchQuery ? 'No results found. Try a different search.' : 'Search for tracks to add to your target list'}
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((track) => (
              <Card
                key={track.id}
                variant="default"
                className={`p-3 transition-all cursor-pointer border ${
                  selectedTracks.has(track.id)
                    ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]'
                    : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-default)]'
                }`}
                onClick={() => toggleTrackSelection(track.id)}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedTracks.has(track.id)}
                    onChange={() => {}}
                    className="w-4 h-4 accent-[var(--color-brand-primary)] rounded"
                  />

                  {track.image_url && (
                    <img
                      src={track.image_url}
                      alt={track.album}
                      className="w-12 h-12 rounded object-cover"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{track.title}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{track.artist}</p>
                    {track.album && (
                      <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{track.album}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {track.duration_ms && (
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    )}
                    <Badge variant={track.service === 'spotify' ? 'success' : 'secondary'} size="sm">
                      {track.service}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicServiceSearch;
