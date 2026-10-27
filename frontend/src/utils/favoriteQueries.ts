export interface FavoriteItem<T> {
  id: string;
  label: string;
  payload: T;
  createdAt: number;
}

function getStorageKey(namespace: string): string {
  return `sn-favs-${namespace}`;
}

function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

export function getFavorites<T>(namespace: string): FavoriteItem<T>[] {
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
    // Basic schema guard
    return parsed.filter(
      (item): item is FavoriteItem<T> =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as any).id === 'string' &&
        typeof (item as any).label === 'string' &&
        typeof (item as any).createdAt === 'number' &&
        'payload' in item
    );
  } catch {
    return [];
  }
}

export function saveFavorite<T>(
  namespace: string,
  item: Omit<FavoriteItem<T>, 'id' | 'createdAt'>
): FavoriteItem<T> {
  const existing = getFavorites<T>(namespace);

  // Prevent duplicate by label
  const duplicateIndex = existing.findIndex((fav) => fav.label === item.label);

  const newItem: FavoriteItem<T> = {
    id: generateId(),
    label: item.label,
    payload: item.payload,
    createdAt: Date.now(),
  };

  let updated: FavoriteItem<T>[];
  if (duplicateIndex !== -1) {
    // If a duplicate label exists, we could either update it or ignore.
    // The prompt mentions "duplicate prevention". Let's assume updating payload/createdAt or just preventing.
    // We will update it. Or if it's strictly "prevent", maybe we return existing?
    // Let's replace the existing one to update its payload.
    updated = [...existing];
    updated[duplicateIndex] = { ...newItem, id: existing[duplicateIndex].id }; // keep old ID? Or use new ID? Let's keep old ID
    newItem.id = existing[duplicateIndex].id;
  } else {
    updated = [...existing, newItem];
  }

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(getStorageKey(namespace), JSON.stringify(updated));
    } catch {
      // Gracefully handle storage errors
    }
  }

  return newItem;
}

export function removeFavorite(namespace: string, id: string): void {
  const existing = getFavorites<any>(namespace);
  const updated = existing.filter((item) => item.id !== id);

  if (isLocalStorageAvailable()) {
    try {
      localStorage.setItem(getStorageKey(namespace), JSON.stringify(updated));
    } catch {
      // Gracefully handle storage errors
    }
  }
}

export function isFavorite(namespace: string, label: string): boolean {
  const existing = getFavorites<any>(namespace);
  return existing.some((item) => item.label === label);
}
