/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawnRadius, fitFloor, hoodSize, labelsForAll, readGraphView, storeGraphView, viewTracks, zoomRange } from './graphView';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

// A ternary tree: three links from the anchor reach 1 + 3 + 9 + 27 = 40 tracks (GraphControls → View, DR-057).
const tree = (n: number) => {
  const ids = Array.from({ length: n }, (_, i) => `t${i}`);
  const links = ids.slice(1).map((id, i) => ({ source: `t${Math.floor(i / 3)}`, target: id, weight: 1 + ((i + 1) % 3) }));
  return { ids, links };
};

describe('viewTracks', () => {
  it('Whole library draws every track', () => {
    const { ids, links } = tree(50);
    expect(viewTracks('library', ids, links, 't0')).toEqual({ ids: null, anchor: 't0', capped: false });
  });

  it('Neighbourhood draws the anchor and the tracks within 3 links', () => {
    const { ids, links } = tree(500);
    const cut = viewTracks('neighbourhood', ids, links, 't0', { steps: 3, max: 200 });
    expect(cut.ids?.size).toBe(40);
    expect(cut.capped).toBe(false);
  });

  it('caps the neighbourhood, strongest links first, and says so', () => {
    const { ids, links } = tree(5000);
    const cut = viewTracks('neighbourhood', ids, links, 't0', { steps: 10, max: 200 });
    expect(cut.ids?.size).toBe(200);
    expect(cut.capped).toBe(true);
  });

  it('with no anchor uses the most-linked track, as the ring layout does', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const links = [{ source: 'a', target: 'b', weight: 1 }, { source: 'c', target: 'b', weight: 1 }, { source: 'd', target: 'b', weight: 1 }];
    expect(viewTracks('neighbourhood', ids, links, null).anchor).toBe('b');
  });
});

describe('zoom in each view', () => {
  it('Neighbourhood keeps 25–400%; Whole library lets a lower fit become the zoom-out limit', () => {
    expect(zoomRange('neighbourhood', 0.05)).toEqual({ min: 0.25, max: 4 });
    expect(zoomRange('library', 0.05)).toEqual({ min: 0.05, max: 4 });
    expect(zoomRange('library', 0.6)).toEqual({ min: 0.25, max: 4 });
    expect(fitFloor('neighbourhood')).toBe(0.25);
    expect(fitFloor('library')).toBeLessThan(0.01);
  });

  it('below 25% nodes stay at least 1.5px on screen and only focused tracks keep labels', () => {
    expect(drawnRadius(4, 1)).toBe(4);
    expect(drawnRadius(4, 0.25)).toBe(4);
    expect(drawnRadius(4, 0.05) * 0.05).toBeCloseTo(1.5);
    expect(labelsForAll(0.25)).toBe(true);
    expect(labelsForAll(0.2)).toBe(false);
  });
});

describe('remembered per device', () => {
  it('defaults to Neighbourhood and remembers Whole library', () => {
    expect(readGraphView()).toBe('neighbourhood');
    storeGraphView('library');
    expect(readGraphView()).toBe('library');
  });

  it('falls back to the default when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => storeGraphView('library')).not.toThrow();
    expect(readGraphView()).toBe('neighbourhood');
  });

  it('reads the neighbourhood size from the tokens', () => {
    const values: Record<string, number> = { 'graph-hood-steps': 3, 'graph-hood-max': 200 };
    expect(hoodSize((name) => values[name])).toEqual({ steps: 3, max: 200 });
  });
});
