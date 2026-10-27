/** @vitest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { useTargetSuggestions } from './useTargetSuggestions';
import { api } from '../services/api';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/api', () => ({
  api: {
    post: vi.fn()
  }
}));

describe('useTargetSuggestions', () => {
  const mockSuggestions = [
    { id: '1', title: 'Track 1', artist: 'Artist 1' },
    { id: '2', title: 'Track 2', artist: 'Artist 2' }
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads suggestions successfully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuggestions
    });

    const { result } = renderHook(() => useTargetSuggestions());

    expect(result.current.loading).toBe(true);

    // Wait for the async useEffect to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.suggestions).toEqual(mockSuggestions);
  });

  it('handles API error gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const { result } = renderHook(() => useTargetSuggestions());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('HTTP 404: Not Found');
    expect(result.current.suggestions).toEqual([]);
  });

  it('filters out dismissed suggestions on load', async () => {
    localStorage.setItem('sn-dismissed-suggestions', JSON.stringify(['1']));

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuggestions
    });

    const { result } = renderHook(() => useTargetSuggestions());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].id).toBe('2');
  });

  it('promotes suggestion and removes it from list', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuggestions
    });

    const { result } = renderHook(() => useTargetSuggestions());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.promoteSuggestion(mockSuggestions[0]);
    });

    expect(api.post).toHaveBeenCalledWith('/target-tracks', {
      title: 'Track 1',
      artist: 'Artist 1',
      genres: [],
      priority: 'medium',
      is_active: true
    });

    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].id).toBe('2');
  });

  it('dismisses suggestion and persists to localStorage', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuggestions
    });

    const { result } = renderHook(() => useTargetSuggestions());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.dismissSuggestion('1');
    });

    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].id).toBe('2');

    const dismissed = JSON.parse(localStorage.getItem('sn-dismissed-suggestions') || '[]');
    expect(dismissed).toContain('1');
  });
});
