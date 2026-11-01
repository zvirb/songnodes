import { describe, it, expect } from 'vitest';
import {
  getGenreCluster,
  isSameGenreCluster,
  checkKeyCompatibility,
  getHarmonicDistance,
  calculateBPMSimilarity,
} from './harmonicCompatibility';

describe('harmonicCompatibility', () => {
  describe('getGenreCluster', () => {
    it('correctly maps electronic genres to the electronic cluster', () => {
      expect(getGenreCluster('techno')).toBe('electronic');
      expect(getGenreCluster('House')).toBe('electronic');
      expect(getGenreCluster('Deep House')).toBe('electronic');
      expect(getGenreCluster('Tech House')).toBe('electronic');
      expect(getGenreCluster('Progressive Trance')).toBe('electronic');
    });

    it('correctly maps other genre clusters', () => {
      expect(getGenreCluster('Hip Hop')).toBe('hiphop');
      expect(getGenreCluster('Rap')).toBe('hiphop');
      expect(getGenreCluster('Indie Rock')).toBe('rock');
      expect(getGenreCluster('Alternative')).toBe('rock');
      expect(getGenreCluster('Synth Pop')).toBe('pop');
      expect(getGenreCluster('Reggaeton')).toBe('latin');
      expect(getGenreCluster('Ambient Chillout')).toBe('chill');
      expect(getGenreCluster('Drum and Bass')).toBe('bass');
      expect(getGenreCluster('Dubstep')).toBe('bass');
    });

    it('returns "other" for unknown or missing genres', () => {
      expect(getGenreCluster('Classical')).toBe('other');
      expect(getGenreCluster('Jazz Fusion')).toBe('other');
      expect(getGenreCluster('')).toBe('other');
      expect(getGenreCluster(null)).toBe('other');
      expect(getGenreCluster(undefined)).toBe('other');
    });

    it('returns cached results on repeated lookups', () => {
      const first = getGenreCluster('Tech House');
      const second = getGenreCluster('Tech House');
      expect(first).toBe('electronic');
      expect(second).toBe('electronic');
    });
  });

  describe('isSameGenreCluster', () => {
    it('returns true when both genres belong to the same cluster', () => {
      expect(isSameGenreCluster('techno', 'house')).toBe(true);
      expect(isSameGenreCluster('Hip Hop', 'Trap')).toBe(true);
      expect(isSameGenreCluster('Drum and Bass', 'Dubstep')).toBe(true);
    });

    it('returns false when genres belong to different clusters', () => {
      expect(isSameGenreCluster('techno', 'Hip Hop')).toBe(false);
      expect(isSameGenreCluster('rock', 'ambient')).toBe(false);
    });

    it('returns false when one or both genres resolve to "other" or are falsy', () => {
      expect(isSameGenreCluster('unknown', 'unknown')).toBe(false);
      expect(isSameGenreCluster('techno', 'unknown')).toBe(false);
      expect(isSameGenreCluster(null, 'house')).toBe(false);
      expect(isSameGenreCluster(undefined, undefined)).toBe(false);
    });
  });

  describe('checkKeyCompatibility & getHarmonicDistance', () => {
    it('returns expected compatibility and distance from table', () => {
      expect(checkKeyCompatibility('8A', '8A')).toBe('same');
      expect(getHarmonicDistance('8A', '8A')).toBe(0.5);

      expect(checkKeyCompatibility('8A', '8B')).toBe('perfect');
      expect(getHarmonicDistance('8A', '8B')).toBe(0.6);

      expect(checkKeyCompatibility('8A', '9A')).toBe('compatible');
      expect(getHarmonicDistance('8A', '9A')).toBe(0.8);

      expect(checkKeyCompatibility('8A', '10A')).toBe('semitone');
      expect(getHarmonicDistance('8A', '10A')).toBe(1.2);

      expect(checkKeyCompatibility('8A', '3A')).toBe('incompatible');
      expect(getHarmonicDistance('8A', '3A')).toBe(2.0);
    });
  });

  describe('calculateBPMSimilarity', () => {
    it('calculates BPM similarity with decay', () => {
      expect(calculateBPMSimilarity(128, 128)).toBe(1);
      expect(calculateBPMSimilarity(128, 130)).toBeGreaterThan(0.9);
      expect(calculateBPMSimilarity(null, 128)).toBe(0.5);
    });
  });
});
