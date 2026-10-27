/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QuickSearch } from './QuickSearch';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../store/useStore', () => ({
  useStore: vi.fn((selector) => {
    const state = {
      graphData: { nodes: [] },
      graph: { selectNode: vi.fn() },
      view: { navigateToNode: vi.fn() },
      setlist: { addTrackToSetlist: vi.fn() },
      currentSetlist: null,
      pathfinding: { setStartTrack: vi.fn(), setEndTrack: vi.fn(), addWaypoint: vi.fn(), removeWaypoint: vi.fn() },
      pathfindingState: { selectedWaypoints: new Set() },
      panels: { toggleLeftPanel: vi.fn() },
      panelState: { leftPanel: null },
    };
    return selector(state);
  })
}));

describe('QuickSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('opens and shows recent routes and tracks', () => {
    localStorage.setItem('sn-recent-quick-search', JSON.stringify([
      JSON.stringify({ id: 'route-/sets' })
    ]));

    render(
      <MemoryRouter>
        <QuickSearch />
      </MemoryRouter>
    );

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    expect(screen.getAllByPlaceholderText(/search tracks/i)[0]).toBeDefined();

    // Check recent items
    const btn = screen.getAllByRole('button', { name: /sets/i })[0];
    expect(btn).toBeDefined();
  });

  it('filters by module prefix', () => {
    render(
      <MemoryRouter>
        <QuickSearch />
      </MemoryRouter>
    );

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getAllByPlaceholderText(/search tracks/i)[0];
    fireEvent.change(input, { target: { value: 'set' } });

    expect(screen.getAllByRole('button', { name: /sets/i })[0]).toBeDefined();
  });

  it('navigates when module is selected with Enter', () => {
    render(
      <MemoryRouter>
        <QuickSearch />
      </MemoryRouter>
    );

    fireEvent.keyDown(document, { key: 'k', metaKey: true });

    const input = screen.getAllByPlaceholderText(/search tracks/i)[0];
    fireEvent.change(input, { target: { value: 'set' } });

    // Select first item
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockNavigate).toHaveBeenCalledWith('/sets');

    const recent = JSON.parse(localStorage.getItem('sn-recent-quick-search') || '[]');
    expect(recent[0]).toContain('route-/sets');
  });
});
