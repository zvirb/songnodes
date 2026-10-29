/** @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MoveNext } from './MoveNext';
import CamelotPage from './CamelotPage';

globalThis.window.SongNodes = {
  format: {
    dateOnly: (d: string) => d,
    count: (c: number) => c.toString(),
    bpm: (b: number) => b.toString()
  },
  camelot: (k: string) => k,
  status: () => ({ status: 'ok', label: 'ok' }),
  icon: () => '<svg></svg>',
  html: { energy: () => '<span>energy</span>', key: (k: string) => `<span>${k}</span>` }
} as unknown as typeof window.SongNodes;

vi.mock('../../hooks/useUnifiedTracks', () => ({
  useUnifiedTracks: () => ({
    tracks: [
      { id: '1', artist: 'Artist A', title: 'Track A', key: '8A', bpm: 124, energy: 0.8 },
      { id: '2', artist: 'Artist B', title: 'Track B', key: '8B', bpm: 126, energy: 0.6 },
    ],
    isLoading: false,
    source: 'library-fixture'
  })
}));

vi.mock('../../shell/AppShell', () => ({
  usePageHeader: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

describe('CamelotPage', () => {
  it('renders page header and track table', () => {
    render(
      <MemoryRouter>
        <CamelotPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Camelot wheel')).toBeDefined();
    expect(screen.getByText('Keys, mood and energy across the library.')).toBeDefined();
    expect(screen.getByText('Artist A –')).toBeDefined();
    expect(screen.getByText('Track A')).toBeDefined();
  });
});

describe('MoveNext', () => {
  it('renders EmptyPanel when no key is selected', () => {
    render(<MoveNext activeKey={null} counts={{}} onMove={vi.fn()} />);
    expect(screen.getByText(/Pick a key on the wheel/i)).toBeDefined();
  });

  it('renders 6 move cards when a key is selected', () => {
    const handleMove = vi.fn();
    render(<MoveNext activeKey="8A" counts={{ '9A': 5 }} onMove={handleMove} />);

    expect(screen.getByText('Where can I move next')).toBeDefined();

    // There should be 6 buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(6);

    // Check for specific labels
    expect(screen.getByText('Up one')).toBeDefined();
    expect(screen.getByText('Relative major')).toBeDefined();

    // Check track count
    expect(screen.getByText('5 tracks')).toBeDefined();
    expect(screen.getAllByText('0 tracks')).toHaveLength(5);

    // Test clicking a card
    fireEvent.click(buttons[1]); // Up one (9A)
    expect(handleMove).toHaveBeenCalledWith('9A');
  });
});
