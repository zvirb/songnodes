import React, { useState } from 'react';
import { api } from '../services/api';
import clsx from 'clsx';
import { Button, Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge } from './ui';

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
      <div className="flex-shrink-0 space-y-4 p-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex gap-2 items-center">
          <Input
            type="text"
            placeholder="Search for tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Select
            value={selectedService}
            onValueChange={(val) => setSelectedService(val as any)}
          >
            <SelectTrigger className="w-[160px] bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)]">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--color-bg-elevated-2)] border-[var(--color-border-default)] text-[var(--color-text-primary)]">
              <SelectItem value="both">Both Services</SelectItem>
              <SelectItem value="spotify">Spotify Only</SelectItem>
              <SelectItem value="tidal">Tidal Only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleSearch}
            loading={isSearching}
            disabled={!searchQuery.trim()}
            variant="primary"
          >
            Search
          </Button>
        </div>

        {error && (
          <div className="bg-[var(--color-error-bg)] border border-[var(--color-error-border)] rounded-[var(--radius-base)] p-3 text-sm text-[var(--color-error)]">
            {error}
          </div>
        )}

        {selectedTracks.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated-2)] border border-[var(--color-brand-primary)] rounded-[var(--radius-base)]">
            <span className="text-sm text-[var(--color-text-primary)] font-medium">
              {selectedTracks.size} track{selectedTracks.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                onClick={handleAddSelected}
                size="sm"
                variant="primary"
              >
                Add to Targets
              </Button>
              <Button
                onClick={selectAll}
                size="sm"
                variant="secondary"
              >
                Select All
              </Button>
              <Button
                onClick={clearSelection}
                size="sm"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {isSearching ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-brand-primary)]"></div>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="text-center text-[var(--color-text-tertiary)] py-8">
            {searchQuery ? 'No results found. Try a different search.' : 'Search for tracks to add to your target list'}
          </div>
        ) : (
          <div className="space-y-2">
            {searchResults.map((track) => {
              const isSelected = selectedTracks.has(track.id);
              return (
                <div
                  key={track.id}
                  className={clsx(
                    "bg-[var(--color-bg-elevated-1)] border rounded-[var(--radius-card)] p-3 transition-all cursor-pointer flex items-center gap-3",
                    isSelected
                      ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                      : "border-[var(--color-card-border)] hover:border-[var(--color-border-strong)]"
                  )}
                  onClick={() => toggleTrackSelection(track.id)}
                >
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 rounded border-[var(--color-border-default)] accent-[var(--color-brand-primary)] cursor-pointer"
                  />

                  {/* Album Art */}
                  {track.image_url ? (
                    <img
                      src={track.image_url}
                      alt={track.album || track.title}
                      className="w-12 h-12 rounded-[var(--radius-sm)] object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-[var(--radius-sm)] bg-[var(--color-bg-elevated-3)] shrink-0 flex items-center justify-center text-xs text-[var(--color-text-tertiary)]">
                      🎵
                    </div>
                  )}

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{track.title}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{track.artist}</p>
                    {track.album && (
                      <p className="text-xs text-[var(--color-text-tertiary)] truncate">{track.album}</p>
                    )}
                  </div>

                  {/* Service Badge and Duration */}
                  <div className="flex items-center gap-2 shrink-0">
                    {track.duration_ms && (
                      <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                      </span>
                    )}
                    <span className={clsx(
                      'px-2 py-0.5 rounded-[var(--radius-badge)] text-xs font-semibold uppercase',
                      track.service === 'spotify'
                        ? 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30'
                        : 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30'
                    )}>
                      {track.service}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicServiceSearch;
