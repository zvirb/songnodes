/**
 * Custom hooks for IntelligentBrowser
 * State management, keyboard navigation, and virtualization logic
 */

import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { BrowserState, BrowserAction, Track, TrackRecommendation } from './types';

/**
 * Browser state reducer
 */
const browserReducer = (state: BrowserState, action: BrowserAction): BrowserState => {
  switch (action.type) {
    case 'SELECT_TRACK':
      const newSelection = new Set(state.selectedTracks);
      if (action.payload.multi) {
        if (newSelection.has(action.payload.trackId)) {
          newSelection.delete(action.payload.trackId);
        } else {
          newSelection.add(action.payload.trackId);
        }
      } else {
        newSelection.clear();
        newSelection.add(action.payload.trackId);
      }
      return { ...state, selectedTracks: newSelection };

    case 'FOCUS_TRACK':
      return { ...state, focusedTrackId: action.payload };

    case 'SEARCH':
      return { ...state, searchQuery: action.payload };

    case 'SORT':
      return { ...state, sortBy: action.payload };

    case 'CHANGE_VIEW':
      return { ...state, viewMode: action.payload };

    case 'TOGGLE_FILTERS':
      return { ...state, showFilters: !state.showFilters };

    case 'CLEAR_SELECTION':
      return { ...state, selectedTracks: new Set() };

    default:
      return state;
  }
};

/**
 * Hook for managing browser state
 */
export const useBrowserState = () => {
  const initialState: BrowserState = {
    selectedTracks: new Set(),
    focusedTrackId: null,
    searchQuery: '',
    sortBy: 'score',
    viewMode: 'list',
    showFilters: false
  };

  return useReducer(browserReducer, initialState);
};

/**
 * Hook for keyboard navigation
 */
export const useKeyboardNavigation = (
  recommendations: TrackRecommendation[],
  focusedTrackId: string | null,
  onFocusChange: (trackId: string | null) => void,
  onSelect: (track: Track, multi: boolean) => void
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!recommendations.length) return;

      const currentIndex = focusedTrackId
        ? recommendations.findIndex(r => r.track.id === focusedTrackId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < recommendations.length - 1) {
            onFocusChange(recommendations[currentIndex + 1].track.id);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            onFocusChange(recommendations[currentIndex - 1].track.id);
          }
          break;

        case 'Home':
          e.preventDefault();
          if (recommendations.length > 0) {
            onFocusChange(recommendations[0].track.id);
          }
          break;

        case 'End':
          e.preventDefault();
          if (recommendations.length > 0) {
            onFocusChange(recommendations[recommendations.length - 1].track.id);
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (focusedTrackId) {
            const track = recommendations.find(r => r.track.id === focusedTrackId);
            if (track) {
              onSelect(track.track, e.ctrlKey || e.metaKey);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          onFocusChange(null);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [recommendations, focusedTrackId, onFocusChange, onSelect]);
};

/**
 * Hook for virtualized list rendering
 */
export const useVirtualization = (
  recommendations: TrackRecommendation[],
  parentRef: React.RefObject<HTMLDivElement>,
  estimateSize: number = 80
) => {
  return useVirtualizer({
    count: recommendations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
    measureElement: typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
      ? element => element.getBoundingClientRect().height
      : undefined
  });
};

/**
 * Hook for debounced search
 */
export const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for announcements to screen readers
 */
export const useAnnouncer = () => {
  const [announcement, setAnnouncement] = useState<string>('');
  const timeoutRef = useRef<NodeJS.Timeout>();

  const announce = useCallback((message: string, polite: boolean = true) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setAnnouncement(message);

    // Clear announcement after it's been read
    timeoutRef.current = setTimeout(() => {
      setAnnouncement('');
    }, 1000);
  }, []);

  return { announcement, announce };
};

/**
 * Hook for managing command palette state
 */
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) };
};

/**
 * useState with type assertion to fix common TS issues
 */
import { useState } from 'react';
