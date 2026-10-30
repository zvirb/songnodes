import { describe, expect, it, vi } from 'vitest';
import { camelotToKey, type CamelotKey } from './harmonic';

describe('camelotToKey', () => {
  it('names a valid Camelot key', () => {
    expect(camelotToKey('8A')).toMatch(/minor/i);
  });

  it('returns an en dash, never "Unknown", for an invalid key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(camelotToKey('13Z' as CamelotKey)).toBe('–');
    warn.mockRestore();
  });
});
