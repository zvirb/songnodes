import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface TargetSuggestion {
  id: string;
  title: string;
  artist: string;
  genres?: string[];
  reason?: string;
  source_track_id?: string;
}

export interface UseTargetSuggestions {
  suggestions: TargetSuggestion[];
  loading: boolean;
  error: string | null;
  dismissedIds: string[];
  refresh: () => Promise<void>;
  promoteSuggestion: (suggestion: TargetSuggestion) => Promise<void>;
  dismissSuggestion: (id: string) => void;
}

const DISMISSED_KEY = 'sn-dismissed-suggestions';

function getDismissedIds(): string[] {
  try {
    const data = localStorage.getItem(DISMISSED_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // Storage unavailable or corrupted
  }
  return [];
}

function saveDismissedIds(ids: string[]): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch (e) {
    // Storage unavailable
  }
}

export function useTargetSuggestions(): UseTargetSuggestions {
  const [suggestions, setSuggestions] = useState<TargetSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setDismissedIds(getDismissedIds());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The API endpoint for suggestions. If it doesn't exist yet, it might return 404.
      const res = await fetch('/api/v1/target-tracks/suggestions');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: TargetSuggestion[] = await res.json();

      setSuggestions(data.filter(s => !dismissedIds.includes(s.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [dismissedIds]);

  // Initial load
  useEffect(() => {
    // We only want to fetch after dismissedIds are loaded, but since we set them sync in effect,
    // we can just depend on dismissedIds. However, to avoid double fetching, we can use a ref.
    // Given the simplicity, we'll just let the consumer call refresh() or we auto-fetch.
    let mounted = true;

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/v1/target-tracks/suggestions');
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const data: TargetSuggestion[] = await res.json();

        if (mounted) {
          const currentDismissed = getDismissedIds();
          setSuggestions(data.filter(s => !currentDismissed.includes(s.id)));
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSuggestions();

    return () => {
      mounted = false;
    };
  }, []); // Only fetch once on mount

  const promoteSuggestion = async (suggestion: TargetSuggestion) => {
    // POST to /api/v1/target-tracks
    await api.post('/target-tracks', {
      title: suggestion.title,
      artist: suggestion.artist,
      genres: suggestion.genres || [],
      priority: 'medium',
      is_active: true
    });

    // Remove from local state
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const dismissSuggestion = (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    saveDismissedIds(newDismissed);
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  return {
    suggestions,
    loading,
    error,
    dismissedIds,
    refresh,
    promoteSuggestion,
    dismissSuggestion
  };
}
