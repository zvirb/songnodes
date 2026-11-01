/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TrackItem, TRACK_ROW_HEIGHT } from './TrackItem';
import type { Track, TrackRecommendation } from './types';

const current: Track = { id: 'c', name: 'Strobe', artist: 'Deadmau5', bpm: 128, key: '8A' } as Track;
const track: Track = {
  id: 't1', name: 'Anneessens', artist: 'DkA', bpm: 119.8, key: '7A', duration: 597, genre: 'Electro',
} as Track;

function renderRow(overrides: Partial<React.ComponentProps<typeof TrackItem>> = {}) {
  const recommendation: TrackRecommendation = {
    track,
    score: 35,
    reasons: [{ type: 'harmonic', description: 'Perfect harmonic match', weight: 25 }],
    compatibility: { harmonic: 'perfect', energy: 'risky', bpm: 'close' },
  } as TrackRecommendation;
  return render(
    <TrackItem
      recommendation={recommendation}
      currentTrack={current}
      isSelected={false}
      isFocused={false}
      showReasons
      onSelect={vi.fn()}
      style={{ position: 'absolute', height: `${TRACK_ROW_HEIGHT}px` }}
      {...overrides}
    />,
  );
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('TrackItem (IB1: reason no longer overlaps the title)', () => {
  it('follows the TrackCell card: one name run on line one, meta on line two', () => {
    const { container } = renderRow();
    const row = container.querySelector('[role="option"]') as HTMLElement;
    const cell = row.querySelector(':scope > .sn-track-cell') as HTMLElement;
    expect(cell).not.toBeNull();

    const lines = Array.from(cell.children).map((el) => el.className);
    expect(lines).toEqual(['sn-track-cell__title', 'sn-track-cell__meta']);

    const name = cell.querySelector('.sn-track-cell__title > .sn-track-cell__name') as HTMLElement;
    expect(name.textContent).toBe('DkA – Anneessens');
    expect(name.getAttribute('title')).toBe('DkA – Anneessens');
    expect(name.querySelector('.sn-track-cell__artist')?.textContent).toBe('DkA –');

    // The artwork sits beside the cell, not inside the title line.
    expect(cell.querySelector('img, svg')).toBeNull();
  });

  it('renders the top reason as the last item of the meta line, after a separator', () => {
    const { container } = renderRow();
    const meta = container.querySelector('.sn-track-cell__meta') as HTMLElement;
    const mix = meta.querySelector(':scope > .sn-track-cell__mix') as HTMLElement;
    expect(mix).not.toBeNull();
    expect(mix.textContent).toBe('Perfect harmonic match');
    expect(mix.getAttribute('title')).toBe('Perfect harmonic match');
    expect(meta.lastElementChild).toBe(mix);
    expect(mix.previousElementSibling?.className).toBe('sn-track-cell__sep');
    expect(meta.querySelector('.sn-track-cell__dur')?.textContent).toBe('9:57');
    // Exactly one reason element in the whole row.
    expect(container.querySelectorAll('.sn-track-cell__mix')).toHaveLength(1);
  });

  it('omits the reason and separator when reasons are hidden', () => {
    const { container } = renderRow({ showReasons: false });
    expect(container.querySelector('.sn-track-cell__mix')).toBeNull();
    expect(container.querySelector('.sn-track-cell__sep')).toBeNull();
  });

  it('virtual row height is the two-line TrackCell plus space-2 above and below', () => {
    expect(TRACK_ROW_HEIGHT).toBe(72);
    const { container } = renderRow();
    const row = container.querySelector('[role="option"]') as HTMLElement;
    expect(row.style.height).toBe('72px');
  });
});
