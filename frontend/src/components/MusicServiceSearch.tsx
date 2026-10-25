import React, { useState } from 'react';
import { Search, SearchX, Plus } from 'lucide-react';
import { SN } from '../lib/songnodes';
import { EmptyPanel } from './ds';
import './MusicServiceSearch.css';
import { api } from '../services/api';

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

interface MusicServiceSearchResult {
  id: string;
  name?: string;
  title?: string;
  artist?: string;
  artists?: Array<{ name: string }>;
  album?: { name?: string; images?: Array<{ url: string }> };
  duration_ms?: number;
  preview_url?: string;
  image?: string;
}

interface MusicServiceSearchResponse {
  tracks?: MusicServiceSearchResult[];
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
      const services: Array<'spotify' | 'tidal'> =
        selectedService === 'both' ? ['spotify', 'tidal'] : [selectedService];
      const allResults: MusicServiceTrack[] = [];

      for (const service of services) {
        try {
          const response = await api.get(`/music-search/${service}`, {
            q: searchQuery,
            limit: 20,
          });
          const data = response.data as MusicServiceSearchResponse;

          const tracks = data.tracks
            ?.filter(track => (track.name || track.title) && (track.artists?.[0]?.name || track.artist))
            .map(track => ({
              id: `${service}_${track.id}`,
              title: track.name || track.title || '',
              artist: track.artists?.[0]?.name || track.artist || '',
              album: track.album?.name,
              duration_ms: track.duration_ms,
              spotify_id: service === 'spotify' ? track.id : undefined,
              tidal_id: service === 'tidal' ? track.id : undefined,
              preview_url: track.preview_url,
              image_url: track.album?.images?.[0]?.url || track.image,
              service,
            })) || [];

          allResults.push(...tracks);
        } catch (err) {
          console.error(`Error searching ${service}:`, err);
          // Continue with other service even if one fails
        }
      }

      if (allResults.length === 0 && services.length > 0) {
        setError('No results from the services. Check that TIDAL and Spotify are connected in Settings.');
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
    <div className="mss">
      <div className="mss__controls" role="search">
        <input
          type="search"
          className="sn-input"
          placeholder="Artist and title"
          aria-label="Search TIDAL and Spotify"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <select className="sn-input" aria-label="Services" value={selectedService} onChange={(e) => setSelectedService(e.target.value as any)}>
          <option value="both">TIDAL and Spotify</option>
          <option value="spotify">Spotify</option>
          <option value="tidal">TIDAL</option>
        </select>
        <button type="button" className="sn-btn sn-btn--sm" onClick={handleSearch} disabled={isSearching || !searchQuery.trim()} aria-busy={isSearching || undefined}>
          {isSearching ? <span className="sn-spinner" aria-hidden="true" /> : <Search size={16} strokeWidth={2} aria-hidden="true" />}
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </div>

      {error && (
        <p className="sn-inline-message sn-inline-message--boxed" data-status="warn" role="alert">{error}</p>
      )}

      {selectedTracks.size > 0 && (
        <div className="mss__bulk">
          <span role="status">{selectedTracks.size} selected</span>
          <button type="button" className="sn-btn sn-btn--sm" onClick={handleAddSelected}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Add {selectedTracks.size} to targets
          </button>
          <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={selectAll}>Select all {searchResults.length}</button>
          <button type="button" className="sn-btn sn-btn--sm sn-btn--quiet" onClick={clearSelection}>Clear selection</button>
        </div>
      )}

      {isSearching ? (
        <span className="sn-loading-state__inline" role="status"><span className="sn-spinner" aria-hidden="true" />Searching…</span>
      ) : searchResults.length === 0 ? (
        searchQuery && error === null ? (
          <EmptyPanel compact icon={SearchX} title="No results">Try the artist and title in a different order.</EmptyPanel>
        ) : !searchQuery ? (
          <EmptyPanel compact icon={Search} title="Find tracks to target">Search TIDAL and Spotify, then add tracks to your target list.</EmptyPanel>
        ) : null
      ) : (
        <ul className="mss__list">
          {searchResults.map((track) => {
            const sel = selectedTracks.has(track.id);
            return (
              <li key={track.id} className="mss__item" aria-selected={sel}>
                <label className="sn-checkbox sn-checkbox--bare">
                  <input type="checkbox" checked={sel} onChange={() => toggleTrackSelection(track.id)} aria-label={`Select ${track.artist} – ${track.title}`} />
                </label>
                {track.image_url && <img src={track.image_url} alt="" className="mss__art" />}
                <div className="sn-track-cell mss__main">
                  <span className="sn-track-cell__title">
                    <span className="sn-track-cell__name" title={`${track.artist} – ${track.title}`}>
                      <span className="sn-track-cell__artist">{track.artist} –</span> {track.title}
                    </span>
                  </span>
                  <span className="sn-track-cell__meta">
                    {track.album ? <span className="sn-track-cell__mix">{track.album}</span> : null}
                    {track.album && track.duration_ms ? <span className="sn-track-cell__sep" aria-hidden="true">·</span> : null}
                    {track.duration_ms ? <span className="sn-track-cell__dur">{SN.format.duration(track.duration_ms / 1000)}</span> : null}
                  </span>
                </div>
                <span className="sn-tag">{track.service === 'spotify' ? 'Spotify' : 'TIDAL'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MusicServiceSearch;
