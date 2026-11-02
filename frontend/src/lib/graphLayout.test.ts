/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { cssEase, edgeBandOf, edgeBandStyles, fitTransform, nodeRadius, pickAnchor, ringSpacing, seatTracks, ZOOM_LIMITS, type SeatLink, type SeatTrack } from './graphLayout';

// Spec values from design-system/tokens.json (graph group) and components/GraphStyles/README.md.
const SPEC = { first: 58, step: 40, aspect: 1.7, seatGap: 30 };

const chain = (n: number) => {
  const tracks: SeatTrack[] = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, labelWidth: 120 }));
  const links: SeatLink[] = tracks.slice(1).map((t, i) => ({ source: tracks[i].id, target: t.id, weight: 1 }));
  return { tracks, links };
};

const nearest = (seats: Record<string, { x: number; y: number }>) => {
  const pts = Object.values(seats);
  return pts.map((p, i) => Math.min(...pts.filter((_, j) => j !== i).map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
};

describe('ringSpacing', () => {
  it('reads the four graph tokens', () => {
    const values: Record<string, number> = { 'graph-ring-first': 58, 'graph-ring-step': 40, 'graph-ring-aspect': 1.7, 'graph-seat-gap': 30 };
    expect(ringSpacing((name) => values[name])).toEqual(SPEC);
  });

  it('leaves a missing token undefined so the bundle default (the same spec value) applies', () => {
    expect(ringSpacing(() => undefined)).toEqual({ first: undefined, step: undefined, aspect: undefined, seatGap: undefined });
  });
});

describe('nodeRadius', () => {
  it('follows clamp(4, 4 + 20 × √(links ÷ most links), 24)', () => {
    expect(nodeRadius(0, 10)).toBe(4);
    expect(nodeRadius(10, 10)).toBe(24);
    expect(nodeRadius(1, 4)).toBeCloseTo(14);
    expect(nodeRadius(3, 0)).toBe(4);
  });
});

describe('seatTracks', () => {
  it('puts the anchor at the centre and its links on the first ring', () => {
    const { tracks, links } = chain(3);
    tracks.forEach((t) => { delete t.labelWidth; });
    const { seats, anchor } = seatTracks(tracks, links, 't1', SPEC);
    expect(anchor).toBe('t1');
    expect(seats.t1).toEqual({ x: 0, y: 0, ring: 0 });
    for (const id of ['t0', 't2']) {
      const { x, y, ring } = seats[id];
      expect(ring).toBe(1);
      // On the ring-1 ellipse: vertical radius 58, horizontal 58 × 1.7.
      expect((x / (SPEC.first * SPEC.aspect)) ** 2 + (y / SPEC.first) ** 2).toBeCloseTo(1, 2);
    }
  });

  it('keeps 300 tracks within the ring spacing, not hundreds of px apart', () => {
    const { tracks, links } = chain(300);
    const { seats } = seatTracks(tracks, links, null, SPEC);
    expect(Object.keys(seats)).toHaveLength(300);
    const nn = nearest(seats).sort((a, b) => a - b);
    const median = nn[Math.floor(nn.length / 2)];
    // Each seat keeps clear its node and its 120px label at zoom 1.5, so neighbours sit about one seat box apart.
    // (The old force layout put the same tracks 150–900px apart by link distance.)
    expect(median).toBeLessThan(100);
    expect(Math.max(...nn)).toBeLessThan(150);
  });

  it('picks the track with the most links when nothing is playing', () => {
    const tracks: SeatTrack[] = ['a', 'b', 'c', 'hub'].map((id) => ({ id }));
    const links: SeatLink[] = ['a', 'b', 'c'].map((id) => ({ source: 'hub', target: id, weight: 1 }));
    expect(seatTracks(tracks, links, null, SPEC).anchor).toBe('hub');
  });

  it('keeps existing seats while the anchor stays the same', () => {
    const { tracks, links } = chain(20);
    const first = seatTracks(tracks, links, 't0', SPEC).seats;
    const more = [...tracks.map((t) => ({ ...t, seat: first[t.id] })), { id: 'new' }];
    const again = seatTracks(more, [...links, { source: 't5', target: 'new', weight: 1 }], 't0', SPEC).seats;
    tracks.forEach((t) => expect(again[t.id]).toEqual(first[t.id]));
    expect(again.new).toBeDefined();
  });

  it('sizes nodes by their share of links', () => {
    const tracks: SeatTrack[] = ['a', 'b', 'hub'].map((id) => ({ id }));
    const links: SeatLink[] = [{ source: 'hub', target: 'a', weight: 1 }, { source: 'hub', target: 'b', weight: 1 }];
    const { radius } = seatTracks(tracks, links, null, SPEC);
    expect(radius.hub).toBe(24);
    expect(radius.a).toBeCloseTo(4 + 20 * Math.SQRT1_2);
  });
});

describe('fitTransform', () => {
  const viewport = { width: 1000, height: 800 };

  it('centres and scales the bounds into the padded canvas', () => {
    const t = fitTransform([{ x: -100, y: -50 }, { x: 300, y: 150 }], viewport, 50)!;
    expect(t.k).toBeCloseTo(Math.min(900 / 400, 700 / 200));
    // Offsets are from the canvas centre: the bounds centre (100, 50) lands on it.
    expect(t.x).toBeCloseTo(-100 * t.k);
    expect(t.y).toBeCloseTo(-50 * t.k);
  });

  it('includes node radii in the bounds', () => {
    const t = fitTransform([{ x: 0, y: 0, r: 100 }], viewport, 0)!;
    expect(t.k).toBeCloseTo(4);
    expect(fitTransform([{ x: 0, y: 0, r: 200 }], viewport, 0)!.k).toBeCloseTo(2);
  });

  it('stays within the GraphControls zoom range', () => {
    expect(fitTransform([{ x: 0, y: 0 }], viewport, 0)!.k).toBe(ZOOM_LIMITS.max);
    expect(fitTransform([{ x: -1e5, y: 0 }, { x: 1e5, y: 0 }], viewport, 0)!.k).toBe(ZOOM_LIMITS.min);
  });

  it('returns null with nothing to fit', () => {
    expect(fitTransform([], viewport, 0)).toBeNull();
    expect(fitTransform([{ x: 0, y: 0 }], { width: 0, height: 0 }, 0)).toBeNull();
  });
});

describe('cssEase', () => {
  it('follows a cubic-bezier token and pins the ends', () => {
    const ease = cssEase('cubic-bezier(0.2, 0, 0, 1)');
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeGreaterThan(0.5); // ease-standard decelerates
    expect(cssEase('cubic-bezier(0, 0, 1, 1)')(0.3)).toBeCloseTo(0.3, 3);
  });

  it('falls back to linear for anything else', () => {
    expect(cssEase('')(0.4)).toBe(0.4);
  });
});

describe('pickAnchor', () => {
  const ids = new Set(['a', 'b', 'c']);
  it('takes now playing first, then the first selected track, then the anchor already in use', () => {
    expect(pickAnchor(ids, 'a', ['b'], 'c')).toBe('a');
    expect(pickAnchor(ids, null, ['b', 'c'], 'a')).toBe('b');
    expect(pickAnchor(ids, null, [], 'c')).toBe('c');
  });

  it('skips ids that are not in the graph, and gives null when nothing applies (most-linked track)', () => {
    expect(pickAnchor(ids, 'gone', ['gone too', 'c'], null)).toBe('c');
    expect(pickAnchor(ids, null, [], 'gone')).toBeNull();
  });
});

describe('seatTracks with an anchor', () => {
  it('seats around the given anchor instead of the most-linked track', () => {
    const { tracks, links } = chain(6);
    const { anchor, seats } = seatTracks(tracks, links, null, SPEC, 't5');
    expect(anchor).toBe('t5');
    expect(seats.t5).toMatchObject({ x: 0, y: 0, ring: 0 });
  });
});

describe('edge bands', () => {
  it('reads the band tokens and falls back to the spec values', () => {
    const values: Record<string, number> = { 'graph-edge-w-1': 1, 'graph-edge-op-4': 1 };
    expect(edgeBandStyles((name) => values[name])).toEqual([
      { width: 1, alpha: 0.35 }, { width: 2, alpha: 0.55 }, { width: 3.5, alpha: 0.8 }, { width: 6, alpha: 1 },
    ]);
  });

  it('scales occurrence counts by the strongest link and keeps 0–1 strengths as they are', () => {
    // Live weights 1–3: 1/3 Fair, 2/3 Strong, 3/3 Very strong with the default cuts 0.25 / 0.50 / 0.75.
    expect([1, 2, 3].map((w) => edgeBandOf(w, 3))).toEqual([2, 3, 4]);
    expect([0.1, 0.3, 0.6, 0.9].map((w) => edgeBandOf(w, 0.9))).toEqual([1, 2, 3, 4]);
    expect(edgeBandOf(0, 0)).toBe(1);
  });
});

describe('seating the live graph shape (report 2 Nov 2026)', () => {
  // 463 linked tracks in 23 components (largest 76, 44, 28), 454 links with weights 1–3, all API positions (0, 0).
  const sizes = [76, 44, 28, ...Array.from({ length: 20 }, (_, i) => 15 + (i % 3))];
  sizes[sizes.length - 1] += 463 - sizes.reduce((a, b) => a + b, 0);
  const tracks: SeatTrack[] = [];
  const links: SeatLink[] = [];
  let n = 0;
  sizes.forEach((size, c) => {
    const first = n;
    for (let i = 0; i < size; i++, n++) {
      tracks.push({ id: `c${c}t${i}`, labelWidth: 150 });
      if (i > 0) links.push({ source: `c${c}t${Math.floor((i - 1) / 2)}`, target: `c${c}t${i}`, weight: 1 + ((n - first) % 3) });
    }
  });

  it('gives every track a seat, none at (0, 0) except the anchor, a seat gap apart', () => {
    expect(tracks).toHaveLength(463);
    const { seats, anchor } = seatTracks(tracks, links, null, SPEC);
    expect(Object.keys(seats)).toHaveLength(463);
    const atOrigin = Object.entries(seats).filter(([, p]) => p.x === 0 && p.y === 0).map(([id]) => id);
    expect(atOrigin).toEqual([anchor]);
    const gaps = nearest(seats).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    expect(median).toBeGreaterThanOrEqual(30);
    expect(median).toBeLessThanOrEqual(90);
  });
});
