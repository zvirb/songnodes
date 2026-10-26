/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from './recentSearches';

describe('recentSearches', () => {
  const namespace = 'library';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns empty array when no searches saved', () => {
    expect(getRecentSearches(namespace)).toEqual([]);
  });

  it('ignores empty and whitespace-only queries', () => {
    expect(saveRecentSearch(namespace, '')).toEqual([]);
    expect(saveRecentSearch(namespace, '   ')).toEqual([]);
    expect(getRecentSearches(namespace)).toEqual([]);
  });

  it('trims query whitespace and stores correctly', () => {
    const res = saveRecentSearch(namespace, '  House Music  ');
    expect(res).toEqual(['House Music']);
    expect(getRecentSearches(namespace)).toEqual(['House Music']);
  });

  it('deduplicates case-insensitively keeping most recent at index 0', () => {
    saveRecentSearch(namespace, 'Techno');
    saveRecentSearch(namespace, 'House');
    const updated = saveRecentSearch(namespace, 'techno');

    expect(updated).toEqual(['techno', 'House']);
    expect(getRecentSearches(namespace)).toEqual(['techno', 'House']);
  });

  it('caps items at maxItems (default 10 and custom limit)', () => {
    for (let i = 1; i <= 12; i++) {
      saveRecentSearch(namespace, `Query ${i}`);
    }
    const defaultCap = getRecentSearches(namespace);
    expect(defaultCap.length).toBe(10);
    expect(defaultCap[0]).toBe('Query 12');

    const customCap = saveRecentSearch(namespace, 'Custom Cap Query', 3);
    expect(customCap.length).toBe(3);
    expect(customCap[0]).toBe('Custom Cap Query');
  });

  it('removes individual items case-insensitively', () => {
    saveRecentSearch(namespace, 'Techno');
    saveRecentSearch(namespace, 'House');
    saveRecentSearch(namespace, 'Ambient');

    // Attempt removing empty string
    expect(removeRecentSearch(namespace, '   ')).toEqual(['Ambient', 'House', 'Techno']);

    const res = removeRecentSearch(namespace, 'house');
    expect(res).toEqual(['Ambient', 'Techno']);
    expect(getRecentSearches(namespace)).toEqual(['Ambient', 'Techno']);
  });

  it('clears all items for a namespace', () => {
    saveRecentSearch(namespace, 'Techno');
    saveRecentSearch(namespace, 'House');
    saveRecentSearch('pathfinder', 'Path Query');

    clearRecentSearches(namespace);
    expect(getRecentSearches(namespace)).toEqual([]);
    expect(getRecentSearches('pathfinder')).toEqual(['Path Query']);
  });

  it('handles invalid JSON stored in localStorage gracefully', () => {
    localStorage.setItem(`sn-recent-${namespace}`, 'invalid-json{');
    expect(getRecentSearches(namespace)).toEqual([]);
  });

  it('handles non-array JSON stored in localStorage gracefully', () => {
    localStorage.setItem(`sn-recent-${namespace}`, JSON.stringify({ key: 'val' }));
    expect(getRecentSearches(namespace)).toEqual([]);
  });

  it('filters out non-string items if stored array is corrupt', () => {
    localStorage.setItem(`sn-recent-${namespace}`, JSON.stringify(['valid', 123, null, { foo: 'bar' }]));
    expect(getRecentSearches(namespace)).toEqual(['valid']);
  });

  it('handles localStorage getItem / setItem / removeItem quota or access errors gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Access denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage error');
    });

    expect(getRecentSearches(namespace)).toEqual([]);
    expect(saveRecentSearch(namespace, 'Techno')).toEqual(['Techno']);
    expect(removeRecentSearch(namespace, 'Techno')).toEqual([]);
    expect(() => clearRecentSearches(namespace)).not.toThrow();
  });

  it('handles non-browser SSR environment where window is undefined', () => {
    const originalWindow = globalThis.window;
    // Cast to unknown first to allow deleting window property for SSR simulation
    delete (globalThis as unknown as Record<string, unknown>).window;

    try {
      expect(getRecentSearches(namespace)).toEqual([]);
      expect(saveRecentSearch(namespace, 'Techno')).toEqual(['Techno']);
      expect(removeRecentSearch(namespace, 'Techno')).toEqual([]);
      expect(() => clearRecentSearches(namespace)).not.toThrow();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
