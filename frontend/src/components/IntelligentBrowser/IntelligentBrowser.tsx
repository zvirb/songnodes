/**
 * IntelligentBrowser - Main Component
 * Modular, accessible track recommendation interface adhering strictly to Design System.
 */

import React, { useRef, useMemo } from 'react';
import { CurrentTrack } from './CurrentTrack';
import { SearchBar } from './SearchBar';
import { FilterTabs } from './FilterTabs';
import { TrackItem } from './TrackItem';
import {
  useBrowserState,
  useKeyboardNavigation,
  useVirtualization,
  useDebouncedValue,
  useAnnouncer
} from './hooks';
import { calculateRecommendations, filterBySearch } from './utils';
import type { Track, GraphEdge, IntelligentBrowserConfig } from './types';
import { SearchX, ListMusic } from 'lucide-react';
import { EmptyPanel } from '../ds';
import styles from './IntelligentBrowser.module.css';

interface IntelligentBrowserProps {
  currentTrack: Track | null;
  allTracks: Track[];
  onTrackSelect: (track: Track) => void;
  config?: Partial<IntelligentBrowserConfig>;
  graphEdges?: GraphEdge[];
  onPreview?: (track: Track) => void;
}

const DEFAULT_CONFIG: IntelligentBrowserConfig = {
  maxRecommendations: 15,
  sortBy: 'score',
  groupBy: 'none',
  showReasons: true,
  autoUpdate: true,
  updateInterval: 5000
};

export const IntelligentBrowser: React.FC<IntelligentBrowserProps> = ({
  currentTrack,
  allTracks,
  onTrackSelect,
  config = {},
  graphEdges = [],
  onPreview
}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [state, dispatch] = useBrowserState();
  const { announcement, announce } = useAnnouncer();
  const parentRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(state.searchQuery, 300);

  const allRecommendations = useMemo(() => {
    return calculateRecommendations(currentTrack, allTracks, graphEdges);
  }, [currentTrack, allTracks, graphEdges]);

  const recommendations = useMemo(() => {
    let filtered = filterBySearch(allRecommendations, debouncedSearch);

    switch (state.sortBy) {
      case 'energy':
        filtered = filtered.sort((a, b) => {
          const aDiff = Math.abs((a.track.energy ?? 0) - (currentTrack?.energy ?? 0));
          const bDiff = Math.abs((b.track.energy ?? 0) - (currentTrack?.energy ?? 0));
          return aDiff - bDiff;
        });
        break;

      case 'bpm':
        filtered = filtered.sort((a, b) => {
          const aDiff = Math.abs((a.track.bpm ?? 0) - (currentTrack?.bpm ?? 0));
          const bDiff = Math.abs((b.track.bpm ?? 0) - (currentTrack?.bpm ?? 0));
          return aDiff - bDiff;
        });
        break;

      case 'score':
      default:
        break;
    }

    return filtered.slice(0, finalConfig.maxRecommendations);
  }, [allRecommendations, debouncedSearch, state.sortBy, currentTrack, finalConfig.maxRecommendations]);

  const virtualizer = useVirtualization(recommendations, parentRef, 64);

  const handleSelect = (track: Track, multi: boolean = false) => {
    dispatch({ type: 'SELECT_TRACK', payload: { trackId: track.id, multi } });
    onTrackSelect(track);
    announce(`Selected ${track.name} by ${track.artist}`);
  };

  const handleFocusChange = (trackId: string | null) => {
    dispatch({ type: 'FOCUS_TRACK', payload: trackId });
    if (trackId) {
      const track = recommendations.find(r => r.track.id === trackId);
      if (track) {
        announce(`Focused on ${track.track.name} by ${track.track.artist}, score ${track.score}`);
      }
    }
  };

  useKeyboardNavigation(
    recommendations,
    state.focusedTrackId,
    handleFocusChange,
    handleSelect
  );

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Up next"
      aria-describedby="browser-instructions"
    >
      <div id="browser-instructions" className="sn-sr">
        Navigate with arrow keys. Press Enter to select a track.
        Press Escape to clear focus.
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sn-sr"
      >
        {announcement}
      </div>

      <button
        type="button"
        className="sn-skip"
        onClick={() => {
          const recommendationsList = document.getElementById('recommendations-list');
          recommendationsList?.focus();
          recommendationsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        Skip to track recommendations
      </button>

      <CurrentTrack track={currentTrack} />

      {currentTrack ? (
        <>
          <SearchBar
            value={state.searchQuery}
            onChange={(value) => dispatch({ type: 'SEARCH', payload: value })}
            resultCount={recommendations.length}
          />

          <FilterTabs
            sortBy={state.sortBy}
            onSortChange={(sortBy) => dispatch({ type: 'SORT', payload: sortBy })}
            resultCount={recommendations.length}
          />
        </>
      ) : null}

      <div
        ref={parentRef}
        id="recommendations-list"
        className={styles.list}
        role="listbox"
        aria-label="Track recommendations"
        aria-multiselectable="true"
        tabIndex={0}
      >
        {recommendations.length === 0 ? (
          state.searchQuery ? (
            <EmptyPanel
              compact
              icon={SearchX}
              title="No suggestions match this search"
              meta={<span className="sn-tag">{state.searchQuery}</span>}
              actions={
                <button
                  type="button"
                  className="sn-btn"
                  onClick={() => dispatch({ type: 'SEARCH', payload: '' })}
                >
                  Clear search
                </button>
              }
            >
              None of the {allRecommendations.length} suggestions match.
            </EmptyPanel>
          ) : currentTrack ? (
            <EmptyPanel compact icon={ListMusic} title="No suggestions for this track">
              Suggestions come from transitions DJs have played and from key, energy and tempo matches.
            </EmptyPanel>
          ) : null
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const recommendation = recommendations[virtualItem.index];
              return (
                <TrackItem
                  key={recommendation.track.id}
                  recommendation={recommendation}
                  currentTrack={currentTrack!}
                  isSelected={state.selectedTracks.has(recommendation.track.id)}
                  isFocused={state.focusedTrackId === recommendation.track.id}
                  showReasons={finalConfig.showReasons}
                  onSelect={handleSelect}
                  onPreview={onPreview}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      <details className={styles.help}>
        <summary>Keyboard shortcuts</summary>
        <dl className={styles.helpList}>
          <dt><kbd>↑ ↓</kbd></dt>
          <dd>Navigate tracks</dd>

          <dt><kbd>Enter</kbd> / <kbd>Space</kbd></dt>
          <dd>Select track</dd>

          <dt><kbd>Ctrl/Cmd + Click</kbd></dt>
          <dd>Multi-select</dd>

          <dt><kbd>Escape</kbd></dt>
          <dd>Clear focus or search</dd>

          <dt><kbd>Home / End</kbd></dt>
          <dd>First or last track</dd>
        </dl>
      </details>
    </div>
  );
};
