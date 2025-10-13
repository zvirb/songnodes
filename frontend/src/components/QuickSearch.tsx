import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import clsx from 'clsx';
import { LocateFixed, ListPlus, Route, Search as SearchIcon } from 'lucide-react';

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
        closePalette();
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closePalette}
      />

      <div className="relative w-full max-w-3xl mx-4 overflow-hidden rounded-xl border border-dj-gray bg-dj-dark shadow-2xl">
        <div className="flex items-center border-b border-dj-gray px-4">
          <SearchIcon size={18} className="mr-3 flex-none text-gray-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search tracks, artists, genres…"
            className="flex-1 bg-transparent py-3 text-base text-white placeholder-gray-500 focus:outline-none"
            aria-label="Quick search"
          />
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-gray-500">
            <span className="hidden sm:inline">Ctrl</span>
            <kbd className="rounded border border-dj-gray px-1.5 py-0.5">K</kbd>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {showEmptyState ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              {searchableItems.length === 0 ? (
                <div className="space-y-2">
                  <p>No tracks available yet.</p>
                  <p className="text-xs text-gray-500">
                    Load graph data via the API gateway (`docker compose up -d rest-api api-gateway`) or add target tracks to scrape.
                  </p>
                </div>
              ) : (
                <p>No matches for “{query}”. Try a different search or adjust your filters.</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-dj-gray/60">
              {results.map(({ item, score }, index) => {
                const isActive = index === highlightedIndex;
                const pathLabel = pathActionLabel(item.track.id);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => focusTrack(item, true)}
                      className={clsx(
                        'flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors',
                        isActive ? 'bg-dj-gray text-white' : 'text-gray-200 hover:bg-dj-gray',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{item.title}</span>
                          {score !== undefined && (
                            <span className="rounded-full bg-dj-gray px-2 py-0.5 text-[11px] text-gray-200">
                              {Math.round((1 - (score ?? 0)) * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-gray-400">
                          <span className="truncate font-medium text-gray-300">{item.artist}</span>
                          {item.genre && <span className="rounded bg-dj-gray px-1.5 py-0.5 text-xs uppercase tracking-wide text-gray-400">{item.genre}</span>}
                          {item.bpm && <span>{item.bpm} BPM</span>}
                          {item.key && <span>{item.key}</span>}
                          {item.year && <span>{item.year}</span>}
                        </div>
                      </div>

                      <div className="flex flex-none items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            focusTrack(item, true);
                          }}
                          title="Focus in graph"
                          className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-md border border-dj-gray text-gray-300 transition-colors hover:border-gray-400 hover:text-white',
                          )}
                        >
                          <LocateFixed size={ACTION_ICON_SIZE} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAddToSetlist(item);
                          }}
                          title={currentSetlist ? 'Add to current setlist' : 'Create a setlist and add track'}
                          className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-md border border-dj-gray text-gray-300 transition-colors hover:border-gray-400 hover:text-white',
                            !currentSetlist && 'border-dashed',
                          )}
                        >
                          <ListPlus size={ACTION_ICON_SIZE} aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handlePathAction(item);
                          }}
                          title={pathLabel}
                          className={clsx(
                            'flex h-8 w-8 items-center justify-center rounded-md border border-dj-gray text-gray-300 transition-colors hover:border-gray-400 hover:text-white',
                            (pathfindingState.startTrackId === item.track.id || pathfindingState.endTrackId === item.track.id || pathfindingState.selectedWaypoints.has(item.track.id)) && 'border-gray-200 text-white',
                          )}
                        >
                          <Route size={ACTION_ICON_SIZE} aria-hidden="true" />
                        </button>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-dj-gray/80 px-4 py-2 text-[11px] uppercase tracking-wide text-gray-500">
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-dj-gray px-1.5 py-0.5">↑↓</kbd>
            Navigate
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-dj-gray px-1.5 py-0.5">Enter</kbd>
            Focus
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="rounded border border-dj-gray px-1.5 py-0.5">Esc</kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
