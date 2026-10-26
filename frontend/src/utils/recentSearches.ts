/**
 * Pure, typed utility to record and retrieve recent searches per context in localStorage.
 */

function getStorageKey(namespace: string): string {
  return `sn-recent-${namespace}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Retrieves recent searches for a given namespace.
 */
export function getRecentSearches(namespace: string): string[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(getStorageKey(namespace));
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * Saves a recent search query for a namespace.
 * Trims whitespace, deduplicates case-insensitively (putting newest at index 0),
 * caps at maxItems, and handles localStorage errors/SSR gracefully.
 */
export function saveRecentSearch(
  namespace: string,
  query: string,
  maxItems = 10
): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return getRecentSearches(namespace);
  }

  const existing = getRecentSearches(namespace);
  const lowerTrimmed = trimmed.toLowerCase();

  const filtered = existing.filter((item) => item.toLowerCase() !== lowerTrimmed);
  const updated = [trimmed, ...filtered].slice(0, Math.max(1, maxItems));

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(getStorageKey(namespace), JSON.stringify(updated));
    } catch {
      // Gracefully handle storage errors (e.g. quota exceeded)
    }
  }

  return updated;
}

/**
 * Removes an individual query from recent searches for a namespace (case-insensitive match).
 */
export function removeRecentSearch(namespace: string, query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return getRecentSearches(namespace);
  }

  const existing = getRecentSearches(namespace);
  const lowerTrimmed = trimmed.toLowerCase();
  const updated = existing.filter((item) => item.toLowerCase() !== lowerTrimmed);

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(getStorageKey(namespace), JSON.stringify(updated));
    } catch {
      // Gracefully handle storage errors
    }
  }

  return updated;
}

/**
 * Clears all recent searches for a namespace.
 */
export function clearRecentSearches(namespace: string): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  try {
    localStorage.removeItem(getStorageKey(namespace));
  } catch {
    // Gracefully handle storage errors
  }
}
