/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getFavorites,
  saveFavorite,
  removeFavorite,
  isFavorite,
} from './favoriteQueries';

describe('favoriteQueries', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds a favorite and retrieves it', () => {
    const namespace = 'test';
    const payload = { filters: ['a', 'b'] };

    const saved = saveFavorite(namespace, { label: 'My preset', payload });
    expect(saved.id).toBeDefined();
    expect(saved.createdAt).toBeGreaterThan(0);
    expect(saved.label).toBe('My preset');
    expect(saved.payload).toEqual(payload);

    const favorites = getFavorites<typeof payload>(namespace);
    expect(favorites).toHaveLength(1);
    expect(favorites[0]).toEqual(saved);
  });

  it('prevents duplicates by updating existing label', () => {
    const namespace = 'test';
    const firstSaved = saveFavorite(namespace, { label: 'Preset 1', payload: 'old' });
    const secondSaved = saveFavorite(namespace, { label: 'Preset 1', payload: 'new' });

    expect(firstSaved.id).toEqual(secondSaved.id);

    const favorites = getFavorites(namespace);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].payload).toBe('new');
  });

  it('removes a favorite', () => {
    const namespace = 'test';
    const saved = saveFavorite(namespace, { label: 'To remove', payload: null });

    expect(getFavorites(namespace)).toHaveLength(1);
    removeFavorite(namespace, saved.id);
    expect(getFavorites(namespace)).toHaveLength(0);
  });

  it('checks if a favorite exists by label', () => {
    const namespace = 'test';
    saveFavorite(namespace, { label: 'Check me', payload: null });

    expect(isFavorite(namespace, 'Check me')).toBe(true);
    expect(isFavorite(namespace, 'Not here')).toBe(false);
  });

  it('recovers from invalid JSON', () => {
    const namespace = 'test';
    localStorage.setItem(`sn-favs-${namespace}`, '{ bad json');

    const favorites = getFavorites(namespace);
    expect(favorites).toEqual([]);

    // Saving should still work and overwrite bad state
    saveFavorite(namespace, { label: 'New', payload: 123 });
    expect(getFavorites(namespace)).toHaveLength(1);
  });

  it('ignores invalid schema elements in storage', () => {
    const namespace = 'test';
    localStorage.setItem(`sn-favs-${namespace}`, JSON.stringify([
      { id: '1', label: 'Valid', payload: 'yes', createdAt: 1000 },
      { id: '2', label: 'Missing payload', createdAt: 1000 },
      { label: 'Missing id', payload: 'no', createdAt: 1000 },
      'just a string',
      null,
    ]));

    const favorites = getFavorites(namespace);
    expect(favorites).toHaveLength(1);
    expect(favorites[0].id).toBe('1');
  });
});
