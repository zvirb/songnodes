import { describe, expect, it } from 'vitest';
import { compatibleKeys } from './camelotLogic';

describe('compatibleKeys', () => {
  it('returns empty array for invalid or null keys', () => {
    expect(compatibleKeys(null)).toEqual([]);
    expect(compatibleKeys('')).toEqual([]);
    expect(compatibleKeys('13A')).toEqual([]);
    expect(compatibleKeys('8C')).toEqual([]);
    expect(compatibleKeys('0A')).toEqual([]);
  });

  it('calculates compatible keys for a standard minor key', () => {
    // 8A (A minor)
    // Same: 8A
    // Relative: 8B
    // +1: 9A
    // -1: 7A
    const result = compatibleKeys('8A');
    expect(result).toHaveLength(4);
    expect(result).toContain('8A');
    expect(result).toContain('8B');
    expect(result).toContain('9A');
    expect(result).toContain('7A');
  });

  it('calculates compatible keys for a standard major key', () => {
    // 8B (C major)
    // Same: 8B
    // Relative: 8A
    // +1: 9B
    // -1: 7B
    const result = compatibleKeys('8B');
    expect(result).toHaveLength(4);
    expect(result).toContain('8B');
    expect(result).toContain('8A');
    expect(result).toContain('9B');
    expect(result).toContain('7B');
  });

  it('wraps around from 12 to 1', () => {
    // 12A
    // Same: 12A
    // Relative: 12B
    // +1: 1A
    // -1: 11A
    const result = compatibleKeys('12A');
    expect(result).toContain('12A');
    expect(result).toContain('12B');
    expect(result).toContain('1A');
    expect(result).toContain('11A');
  });

  it('wraps around from 1 to 12', () => {
    // 1B
    // Same: 1B
    // Relative: 1A
    // +1: 2B
    // -1: 12B
    const result = compatibleKeys('1B');
    expect(result).toContain('1B');
    expect(result).toContain('1A');
    expect(result).toContain('2B');
    expect(result).toContain('12B');
  });

  it('handles lowercase input correctly', () => {
    const result = compatibleKeys('8a');
    expect(result).toContain('8A');
    expect(result).toContain('8B');
    expect(result).toContain('9A');
    expect(result).toContain('7A');
  });
});
