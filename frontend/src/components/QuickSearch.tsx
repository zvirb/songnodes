import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { LocateFixed, ListPlus, Route, Search as SearchIcon, X } from 'lucide-react';

import { useStore } from '../store/useStore';
import { Track } from '../types';

interface SearchableTrackItem {
  id: string;
  nodeId: string;
  title: string;
  artist: string;
  genre?: string;
  bpm?: number;
  key?: string;
  year?: number;
  track: Track;
}

type CommandResult = {
  item: SearchableTrackItem;
  score?: number;
};

const ACTION_ICON_SIZE = 16;

export const QuickSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastFocusedElement = useRef<HTMLElement | null>(null);

  const nodes = useStore((state) => state.graphData.nodes);
  const selectNode = useStore((state) => state.graph.selectNode);
  const navigateToNode = useStore((state) => state.view.navigateToNode);
  const addTrackToSetlist = useStore((state) => state.setlist.addTrackToSetlist);
  const currentSetlist = useStore((state) => state.currentSetlist);
  const setStartTrack = useStore((state) => state.pathfinding.setStartTrack);
  const setEndTrack = useStore((state) => state.pathfinding.setEndTrack);
  const addWaypoint = useStore((state) => state.pathfinding.addWaypoint);
  const removeWaypoint = useStore((state) => state.pathfinding.removeWaypoint);
  const pathfindingState = useStore((state) => state.pathfindingState);
  const toggleLeftPanel = useStore((state) => state.panels.toggleLeftPanel);
  const leftPanel = useStore((state) => state.panelState.leftPanel);

  const searchableItems = useMemo<SearchableTrackItem[]>(() => {
    const dedup = new Map<string, SearchableTrackItem>();

    nodes.forEach((node) => {
      if (node.type && node.type !== 'track') {
        return;
      }

      const baseTrack = node.track;
      const metadata = node.metadata || {};

      const trackName = baseTrack?.name || baseTrack?.title || node.title || metadata.title || node.label;
      const artistName = baseTrack?.artist || metadata.artist || node.artist;

      if (!trackName || !artistName) {
        return;
      }

      const trackId = baseTrack?.id ?? node.id;

      const derivedTrack: Track = {
        id: trackId,
        name: trackName,
        title: trackName,
        artist: artistName,
        album: baseTrack?.album ?? metadata.album,
        bpm: baseTrack?.bpm ?? metadata.bpm ?? node.bpm,
        key: baseTrack?.key ?? metadata.key ?? node.key,
        camelotKey: baseTrack?.camelotKey ?? metadata.camelotKey ?? metadata.camelot_key ?? node.camelot_key,
        energy: baseTrack?.energy ?? metadata.energy ?? node.energy,
        genre: baseTrack?.genre ?? metadata.genre ?? node.genre,
        duration: baseTrack?.duration ?? metadata.duration ?? node.duration,
        preview_url: baseTrack?.preview_url ?? metadata.preview_url ?? metadata.previewUrl,
        year: baseTrack?.year ?? metadata.year ?? metadata.release_year ?? node.year,
        status: baseTrack?.status ?? 'unplayed',
      };

      if (!dedup.has(node.id)) {
        dedup.set(node.id, {
          id: node.id,
          nodeId: node.id,
          title: trackName,
          artist: artistName,
          genre: derivedTrack.genre,
          bpm: derivedTrack.bpm,
          key: derivedTrack.camelotKey || derivedTrack.key,
          year: derivedTrack.year,
          track: derivedTrack,
        });
      }
    });

    return Array.from(dedup.values());
  }, [nodes]);

  const fuse = useMemo(() => {
    return new Fuse(searchableItems, {
      keys: [
        { name: 'title', weight: 0.45 },
        { name: 'artist', weight: 0.35 },
        { name: 'genre', weight: 0.15 },
        { name: 'track.camelotKey', weight: 0.05 },
      ],
      threshold: 0.35,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [searchableItems]);

  const results = useMemo<CommandResult[]>(() => {
    if (!isOpen) {
      return [];
    }

    if (!query.trim()) {
      return searchableItems
        .slice(0, 12)
        .map((item) => ({ item }));
    }

    return fuse.search(query.trim()).slice(0, 12).map((res) => ({
      item: res.item,
      score: res.score,
    }));
  }, [fuse, isOpen, query, searchableItems]);

  useEffect(() => {
    setHighlightedIndex((prev) => {
      if (results.length === 0) return 0;
      return Math.min(prev, results.length - 1);
    });
  }, [results.length]);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setHighlightedIndex(0);

    const target = lastFocusedElement.current;
    if (target) {
      requestAnimationFrame(() => target.focus());
    }
  }, []);

  const focusTrack = useCallback(
    (item: SearchableTrackItem, shouldClose: boolean) => {
      selectNode(item.nodeId);
      navigateToNode(item.nodeId, { highlight: true, selectNode: true });
      if (shouldClose) {
        closePalette();
      }
    },
    [closePalette, navigateToNode, selectNode],
  );

  const handleAddToSetlist = useCallback(
    (item: SearchableTrackItem) => {
      addTrackToSetlist(item.track);
      if (!currentSetlist && leftPanel !== 'setlist') {
        toggleLeftPanel('setlist');
      }
    },
    [addTrackToSetlist, currentSetlist, leftPanel, toggleLeftPanel],
  );

  const pathActionLabel = useCallback(
    (trackId: string) => {
      if (!pathfindingState.startTrackId) return 'Set as path start';
      if (pathfindingState.startTrackId === trackId) return 'Clear path start';
      if (!pathfindingState.endTrackId) return 'Set as path end';
      if (pathfindingState.endTrackId === trackId) return 'Clear path end';
      if (pathfindingState.selectedWaypoints.has(trackId)) return 'Remove waypoint';
      return 'Add waypoint';
    },
    [pathfindingState.endTrackId, pathfindingState.selectedWaypoints, pathfindingState.startTrackId],
  );

  const handlePathAction = useCallback(
    (item: SearchableTrackItem) => {
      const trackId = item.track.id;

      if (!pathfindingState.startTrackId) {
        setStartTrack(trackId);
        if (leftPanel !== 'path') {
          toggleLeftPanel('path');
        }
        closePalette();
        return;
      }

      if (pathfindingState.startTrackId === trackId) {
        setStartTrack('');
        return;
      }

      if (!pathfindingState.endTrackId) {
        setEndTrack(trackId);
        if (leftPanel !== 'path') {
          toggleLeftPanel('path');
        }
        closePalette();
        return;
      }

      if (pathfindingState.endTrackId === trackId) {
        setEndTrack('');
        return;
      }

      if (pathfindingState.selectedWaypoints.has(trackId)) {
        removeWaypoint(trackId);
      } else {
        addWaypoint(trackId);
      }
    },
    [addWaypoint, closePalette, leftPanel, pathfindingState, removeWaypoint, setEndTrack, setStartTrack, toggleLeftPanel],
  );

  const openPalette = useCallback(() => {
    lastFocusedElement.current = document.activeElement as HTMLElement | null;
    setIsOpen(true);
  }, []);

  useEffect(() => {
    const handleGlobalKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!isOpen) {
          openPalette();
        }
        return;
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !isTypingTarget) {
        event.preventDefault();
        if (!isOpen) {
          openPalette();
        }
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        closePalette();
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [closePalette, isOpen, openPalette]);

  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      inputRef.current?.blur();
    }
  }, [isOpen]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        if (results.length === 0) return;
        setHighlightedIndex((prev) => (prev + 1) % results.length);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        if (results.length === 0) return;
        setHighlightedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      }
      case 'Enter': {
        event.preventDefault();
        const selected = results[highlightedIndex];
        if (selected) {
          focusTrack(selected.item, true);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        if (query) {
          setQuery('');
        } else {
          closePalette();
        }
        break;
      }
      default:
        break;
    }
  };

  const showEmptyState = results.length === 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-dialog)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 'var(--space-16)',
        backgroundColor: 'var(--overlay)'
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0 }}
        onClick={closePalette}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '720px',
          margin: '0 var(--space-4)',
          overflow: 'hidden',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--line)',
          backgroundColor: 'var(--surface-1)',
          color: 'var(--fg)',
          boxShadow: 'var(--shadow-3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)', padding: '0 var(--space-4)' }}>
          <SearchIcon size={18} strokeWidth={2} style={{ marginRight: 'var(--space-3)', color: 'var(--fg-3)' }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search tracks, artists, genres…"
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              padding: 'var(--space-3) 0',
              fontSize: '1rem',
              color: 'var(--fg)',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-body)'
            }}
            aria-label="Quick search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
              aria-label="Clear query"
              title="Clear query"
            >
              <X size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
            <kbd style={{ padding: '2px var(--space-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', background: 'var(--surface-2)', fontFamily: 'var(--font-data)' }}>
              Cmd+K
            </kbd>
          </div>
        </div>

        <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {showEmptyState ? (
            <div style={{ padding: 'var(--space-8)', textAlign: 'center', fontSize: '0.875rem', color: 'var(--fg-2)' }}>
              {searchableItems.length === 0 ? (
                <div>
                  <p style={{ margin: 0 }}>No tracks available yet.</p>
                  <p style={{ margin: 'var(--space-1) 0 0', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                    Load graph data or add target tracks to scrape.
                  </p>
                </div>
              ) : (
                <p style={{ margin: 0 }}>No matches for “{query}”.</p>
              )}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {results.map(({ item, score }, index) => {
                const isActive = index === highlightedIndex;
                const pathLabel = pathActionLabel(item.track.id);

                return (
                  <li key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <button
                      type="button"
                      onClick={() => focusTrack(item, true)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-3)',
                        padding: 'var(--space-3) var(--space-4)',
                        textAlign: 'left',
                        backgroundColor: isActive ? 'var(--hover-bg)' : 'transparent',
                        border: 'none',
                        color: 'var(--fg)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </span>
                          {score !== undefined ? (
                            <span className="sn-tag">
                              {Math.round((1 - (score ?? 0)) * 100)}%
                            </span>
                          ) : null}
                        </div>
                        <div style={{ marginTop: '2px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
                          <span style={{ fontWeight: 500, color: 'var(--fg-2)' }}>{item.artist}</span>
                          {item.genre ? <span className="sn-tag">{item.genre}</span> : null}
                          {item.bpm ? <span style={{ fontFamily: 'var(--font-data)' }}>{item.bpm} BPM</span> : null}
                          {item.key ? <span style={{ fontFamily: 'var(--font-data)' }}>{item.key}</span> : null}
                          {item.year ? <span>{item.year}</span> : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            focusTrack(item, true);
                          }}
                          title="Focus in graph"
                          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                        >
                          <LocateFixed size={ACTION_ICON_SIZE} strokeWidth={2} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAddToSetlist(item);
                          }}
                          title={currentSetlist ? 'Add to current setlist' : 'Create a setlist and add track'}
                          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                        >
                          <ListPlus size={ACTION_ICON_SIZE} strokeWidth={2} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePathAction(item);
                          }}
                          title={pathLabel}
                          className="sn-btn sn-btn--icon sn-btn--quiet sn-btn--sm"
                        >
                          <Route size={ACTION_ICON_SIZE} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)', padding: 'var(--space-2) var(--space-4)', fontSize: '0.75rem', color: 'var(--fg-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <kbd style={{ padding: '2px var(--space-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', background: 'var(--surface-2)', fontFamily: 'var(--font-data)' }}>↑↓</kbd>
            Navigate
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <kbd style={{ padding: '2px var(--space-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', background: 'var(--surface-2)', fontFamily: 'var(--font-data)' }}>Enter</kbd>
            Focus
            <kbd style={{ padding: '2px var(--space-1)', border: '1px solid var(--line)', borderRadius: 'var(--radius-chip)', background: 'var(--surface-2)', fontFamily: 'var(--font-data)' }}>Esc</kbd>
            Close
          </div>
        </div>
      </div>
    </div>
  );
};
