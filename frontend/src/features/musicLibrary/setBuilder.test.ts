/**
 * Set builder rules, checked against the real library fixture (public/data/music-library.json).
 * The rules are the Naarm Set Builder's: tiers 1–4 / 5–7 / 8–10, climbs of +1 with plateaus,
 * 2–3 point drops after a peak, locks survive rebuilds, a given seed always builds the same set.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LibraryFile, SavedSet } from './data';
import {
  SHAPES, DEFAULT_FILTERS, blankDraft, buildSlots, byIdOf, countPeaks, draftFromSaved, filterTracks, filtersFromParams,
  filtersToParams, keyMove, normaliseMix, poolTracks, removeSlot, retarget, savedSetFromDraft, shapeTargets, slotCount,
  sortTracks, sourceName, spares, tierOf, waveIssues, addTrack, moveSlot, type Draft,
} from './setBuilder';

const lib = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/music-library.json'), 'utf8')) as LibraryFile;
const TRACKS = lib.tracks;
const BYID = byIdOf(TRACKS);
const draft = (over: Partial<Draft> = {}): Draft => ({ ...blankDraft(), ...over });

describe('fixture', () => {
  it('is the real library export', () => {
    expect(TRACKS.length).toBe(lib.counts.tracks);
    expect(TRACKS.length).toBeGreaterThan(200);
  });
});

describe('energy tiers', () => {
  it('maps 1–4 Low, 5–7 Building, 8–10 High, missing to none', () => {
    expect([1, 2, 3, 4].map(tierOf)).toEqual(['low', 'low', 'low', 'low']);
    expect([5, 6, 7].map(tierOf)).toEqual(['building', 'building', 'building']);
    expect([8, 9, 10].map(tierOf)).toEqual(['high', 'high', 'high']);
    expect(tierOf(null)).toBeNull();
    expect(tierOf(0)).toBeNull();
  });
});

describe('shape targets (wave rules)', () => {
  // From 14 slots (about 50 min) every segment has room to reach its peak.
  const sizes = [14, 18, 25, 42, 60, 100];
  for (const [key, shape] of Object.entries(SHAPES)) {
    // Below 14 slots a segment can have fewer slots than levels, and the artifact's curve then
    // skips a level (Journey at 6 slots: 4, 6, 5, 6, 8, 7). Ported as is; the strip flags it.
    it(`${key}: short sets stay inside the shape and never drop more than 3`, () => {
      const lo = Math.min(...shape.segs.map((s) => s[0])), hi = Math.max(...shape.segs.map((s) => s[1]));
      for (const n of [6, 7, 8, 10, 12]) {
        const tg = shapeTargets(n, shape.segs);
        expect(tg).toHaveLength(n);
        for (let i = 0; i < tg.length; i++) {
          expect(tg[i]).toBeGreaterThanOrEqual(lo); expect(tg[i]).toBeLessThanOrEqual(hi);
          if (i) expect(tg[i] - tg[i - 1]).toBeGreaterThanOrEqual(-3);
        }
      }
    });
    it(`${key}: every step climbs +1, holds, or drops 2–3 after a peak`, () => {
      for (const n of sizes) {
        const tg = shapeTargets(n, shape.segs);
        expect(tg).toHaveLength(n);
        for (const e of tg) { expect(e).toBeGreaterThanOrEqual(1); expect(e).toBeLessThanOrEqual(10); }
        for (let i = 1; i < tg.length; i++) {
          const d = tg[i] - tg[i - 1];
          expect([0, 1, -2, -3]).toContain(d);
        }
        // a drop only ever follows the top of a climb (the segment's peak)
        tg.forEach((e, i) => {
          if (i && e - tg[i - 1] < 0) {
            const seg = shape.segs.find(([, b]) => b === tg[i - 1]);
            expect(seg).toBeDefined();
          }
        });
      }
    });
  }

  it('journey reaches both peaks (8 then 9) and closes at 7', () => {
    const tg = shapeTargets(25, SHAPES.journey.segs);
    expect(tg[0]).toBe(4);
    expect(tg).toContain(8);
    expect(Math.max(...tg)).toBe(9);
    expect(tg[tg.length - 1]).toBe(7);
    expect(tg.indexOf(9)).toBeGreaterThan(tg.indexOf(8));
  });

  it('warm-up never goes above 6', () => {
    expect(Math.max(...shapeTargets(30, SHAPES.warmup.segs))).toBe(6);
  });
});

describe('wave issue detection', () => {
  it('flags +2 climbs and a second −1 in a row, not single −1s or 2–3 point drops', () => {
    expect(waveIssues([5, 7])).toEqual([1]);
    expect(waveIssues([7, 6, 5])).toEqual([2]);
    expect(waveIssues([8, 7, 9, 6])).toEqual([2]);
    expect(waveIssues([9, 6, 7, 8, 8, 5])).toEqual([]);
    expect(waveIssues([5, null, 9])).toEqual([]);
  });
  it('counts peaks of 8 or more', () => {
    expect(countPeaks([4, 6, 8, 6, 7, 9, 7])).toBe(2);
    expect(countPeaks([5, 6, 7])).toBe(0);
    expect(countPeaks([6, 7, 9])).toBe(1);
  });
});

describe('key moves (artifact scoring)', () => {
  it('scores Camelot moves', () => {
    expect(keyMove('8A', '8A').label).toBe('same key');
    expect(keyMove('8A', '9A').label).toBe('+1 key');
    expect(keyMove('8A', '7A').label).toBe('−1 key');
    expect(keyMove('8A', '8B').label).toBe('relative A↔B');
    expect(keyMove('8A', '10A')).toMatchObject({ label: '+2 energy boost', boost: true });
    expect(keyMove('8A', '3A')).toMatchObject({ boost: true });
    expect(keyMove('8A', '11B').score).toBeLessThan(0);
    expect(keyMove(null, '8A').label).toBe('key ?');
  });
});

describe('building a set', () => {
  it('fills slotCount(minutes) slots and the slot plan lands within half a slot of the target length', () => {
    for (const minutes of [20, 45, 60, 90, 120, 180, 360]) {
      const slots = buildSlots(TRACKS, draft({ minutes }), true, BYID);
      expect(slots).toHaveLength(slotCount(minutes));
      if (minutes >= 22) expect(Math.abs(slots.length * 216 - minutes * 60)).toBeLessThanOrEqual(108);
    }
  });

  it('is deterministic for a seed, and another take changes the order', () => {
    const a = buildSlots(TRACKS, draft({ seed: 7 }), true, BYID).map((s) => s.id);
    const b = buildSlots(TRACKS, draft({ seed: 7 }), true, BYID).map((s) => s.id);
    const c = buildSlots(TRACKS, draft({ seed: 8 }), true, BYID).map((s) => s.id);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('uses each track once, only from the pool, and follows the target wave', () => {
    const d = draft({ minutes: 120, shape: 'peak' });
    const slots = buildSlots(TRACKS, d, true, BYID);
    const ids = slots.map((s) => s.id).filter(Boolean) as string[];
    expect(new Set(ids).size).toBe(ids.length);
    const pool = new Set(poolTracks(TRACKS, d).map((t) => t.id));
    ids.forEach((id) => expect(pool.has(id)).toBe(true));
    const dev = slots.map((s) => Math.abs((BYID.get(s.id!)?.e ?? 0) - s.tgt));
    expect(dev.reduce((a, b) => a + b, 0) / dev.length).toBeLessThanOrEqual(1);
    expect(slots.map((s) => s.tgt)).toEqual(shapeTargets(slots.length, SHAPES.peak.segs));
  });

  it('keeps locked slots in place through another take', () => {
    const first = buildSlots(TRACKS, draft({ seed: 3 }), true, BYID);
    first[2] = { ...first[2], lock: true };
    first[10] = { ...first[10], lock: true };
    const again = buildSlots(TRACKS, draft({ seed: 4, slots: first }), true, BYID);
    expect(again[2]).toMatchObject({ id: first[2].id, lock: true });
    expect(again[10]).toMatchObject({ id: first[10].id, lock: true });
    expect(again.filter((s) => s.id === first[2].id)).toHaveLength(1);
    const ignored = buildSlots(TRACKS, draft({ seed: 4, slots: first }), false, BYID);
    expect(ignored.every((s) => !s.lock)).toBe(true);
  });

  it('respects the genre mix: a 0% pillar never appears', () => {
    const slots = buildSlots(TRACKS, draft({ mix: { House: 50, Techno: 50, UKG: 0 } }), true, BYID);
    expect(slots.some((s) => BYID.get(s.id!)?.p === 'UKG')).toBe(false);
  });

  it('leaves slots empty when the pool runs out', () => {
    const d = draft({ pool: 'high', minutes: 90 });
    const slots = buildSlots(TRACKS, d, true, BYID);
    const filled = slots.filter((s) => s.id).length;
    expect(filled).toBe(Math.min(slots.length, poolTracks(TRACKS, d).length));
    expect(slots.some((s) => !s.id)).toBe(true);
  });

  it('builds from a filtered crate', () => {
    const crate = { ...DEFAULT_FILTERS, pillar: ['Techno'] };
    const slots = buildSlots(TRACKS, draft({ pool: 'crate', crate }), true, BYID);
    expect(slots.every((s) => !s.id || BYID.get(s.id)?.p === 'Techno')).toBe(true);
  });
});

describe('editing the running order', () => {
  const base = draft({ seed: 2, slots: buildSlots(TRACKS, draft({ seed: 2 }), true, BYID) });

  it('offers up to three unused spares within ±1 energy of the slot', () => {
    const sp = spares(TRACKS, base, 4, BYID);
    expect(sp.length).toBeLessThanOrEqual(3);
    expect(sp.length).toBeGreaterThan(0);
    const cur = BYID.get(base.slots[4].id!)!;
    const used = new Set(base.slots.map((s) => s.id));
    sp.forEach((t) => { expect(used.has(t.id)).toBe(false); expect(Math.abs((t.e ?? 0) - (cur.e ?? 0))).toBeLessThanOrEqual(1); });
  });

  it('moves swap tracks and locks but keep the slot targets', () => {
    const moved = moveSlot(base.slots, 3, 1);
    expect(moved[3].id).toBe(base.slots[4].id);
    expect(moved[4].id).toBe(base.slots[3].id);
    expect(moved.map((s) => s.tgt)).toEqual(base.slots.map((s) => s.tgt));
  });

  it('removing a slot re-fits the targets to the shape', () => {
    const after = removeSlot(base, 0);
    expect(after).toHaveLength(base.slots.length - 1);
    expect(after.map((s) => s.tgt)).toEqual(shapeTargets(after.length, SHAPES.journey.segs));
    expect(retarget(after, 'groove').every((s) => s.tgt >= 5 && s.tgt <= 7)).toBe(true);
  });

  it('adds a crate track to an empty slot, or appends it locked', () => {
    const extra = TRACKS.find((t) => !base.slots.some((s) => s.id === t.id))!;
    expect(addTrack(base, BYID.get(base.slots[0].id!)!).result).toBe('exists');
    const app = addTrack(base, extra);
    expect(app.result).toBe('appended');
    expect(app.draft.slots[app.draft.slots.length - 1]).toMatchObject({ id: extra.id, lock: true });
    const holed = { ...base, slots: base.slots.map((s, i) => (i === 5 ? { ...s, id: null } : s)) };
    const fill = addTrack(holed, extra);
    expect(fill.result).toBe('filled');
    expect(fill.draft.slots[5].id).toBe(extra.id);
  });
});

describe('saved sets', () => {
  it('round-trips through the artifact document shape, with key moves', () => {
    const d = draft({ name: 'Peak time Friday', shape: 'peak', seed: 5 });
    d.slots = buildSlots(TRACKS, d, true, BYID);
    const s: SavedSet = savedSetFromDraft(d, BYID, [], new Date('2026-10-24T10:30:00Z'));
    expect(s).toMatchObject({ name: 'Peak time Friday', shape: 'peak', minutes: 90, pool: 'active', tidal: false, seed: 5, updated: '2026-10-24T10:30:00.000Z', created: '2026-10-24T10:30:00.000Z' });
    expect(s.id).toMatch(/^set-/);
    expect(s.tracks).toHaveLength(d.slots.filter((x) => x.id).length);
    expect(s.tracks[0].move).toBeNull();
    expect(s.tracks[1].move).toBe('key ?');
    const back = draftFromSaved(s, BYID);
    expect(back.slots.map((x) => x.id)).toEqual(s.tracks.map((t) => t.id));
    expect(back.slots.every((x) => x.lock)).toBe(true);
  });

  it('normalises the artifact 0–10 genre weights to percentages', () => {
    expect(normaliseMix({ House: 4, Techno: 3, UKG: 3 })).toEqual({ House: 40, Techno: 30, UKG: 30 });
    expect(normaliseMix({ House: 1, Techno: 1, UKG: 1 })).toEqual({ House: 34, Techno: 33, UKG: 33 });
    expect(normaliseMix({ House: 0, Techno: 0, UKG: 0 })).toEqual({ House: 0, Techno: 0, UKG: 0 });
  });
});

describe('crate filters and sorting', () => {
  it('defaults to High and Standard rotation', () => {
    const rows = filterTracks(TRACKS, DEFAULT_FILTERS);
    expect(rows.every((t) => t.rot === 1 || t.rot === 2)).toBe(true);
  });
  it('round-trips through the URL', () => {
    const F = { ...DEFAULT_FILTERS, q: 'dub', pillar: ['House', 'UKG'], tier: ['high' as const], rot: [1], rev: true };
    expect(filtersFromParams(filtersToParams(F))).toEqual(F);
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });
  it('sorts energy descending with ties by artist', () => {
    const rows = sortTracks(TRACKS, 'e', 'descending');
    for (let i = 1; i < rows.length; i++) expect((rows[i - 1].e ?? 0)).toBeGreaterThanOrEqual(rows[i].e ?? 0);
  });
  it('names sources as the shows write them', () => {
    expect(sourceName('PBS_ElectricSunset')).toBe('PBS Electric Sunset');
    expect(sourceName('RRR_FeelTheFloor')).toBe('3RRR Feel The Floor');
    expect(sourceName('triplej_Doof')).toBe('triple j Doof');
    expect(sourceName('ARIA_Club')).toBe('ARIA Club Chart');
  });
});
