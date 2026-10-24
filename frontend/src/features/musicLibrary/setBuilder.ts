/**
 * Naarm Set Builder logic, ported from the music library artifact (musicLibrary/artifact/index.html).
 *
 * Pure TypeScript: no DOM, no window.SongNodes, so it runs under vitest in node. The music rules
 * (tiers, shapes, wave targets, scoring, spares, key moves, slot count, play time) are the
 * artifact's and must behave the same way (design-system 17-governance, "How rules are derived").
 * Presentation (labels, verdict glyphs, formatting) lives in the pages and goes through SN.
 *
 * Keys: the builder reads Camelot codes the way the artifact did (number + letter). Pages pass
 * tracks whose `k` has already been normalised with SN.camelot.
 */
import type { LibraryTrack, SavedSet, SavedSetTrack } from './data';

/* ------------------------------------------------------------------ constants */

/** Rotation values (pipeline lifecycle). */
export const ROT: Record<number, string> = { 1: 'High', 2: 'Standard', 3: 'Vault' };

export type Tier = 'low' | 'building' | 'high';
/** Artifact TIER: 1–4 Low, 5–7 Building, 8–10 High. */
export function tierOf(e: number | null | undefined): Tier | null {
  if (e == null || !Number.isFinite(e) || e <= 0) return null;
  return e <= 4 ? 'low' : e <= 7 ? 'building' : 'high';
}
export const TIERS: Tier[] = ['low', 'building', 'high'];

/** Pillars as the pipeline stores them, with the label people read (01-writing: "UK garage"). */
export const PILLARS: { id: string; label: string }[] = [
  { id: 'House', label: 'House' },
  { id: 'Techno', label: 'Techno' },
  { id: 'UKG', label: 'UK garage' },
];
export const pillarLabel = (p: string | null | undefined): string | null =>
  p == null ? null : PILLARS.find((x) => x.id === p)?.label ?? p;

/** Artifact SRCNAME, plus the chart's full name as the design system writes it. */
export function sourceName(id: string): string {
  if (id === 'ARIA_Club') return 'ARIA Club Chart';
  return id
    .replace(/^PBS_/, 'PBS ')
    .replace(/^RRR_/, '3RRR ')
    .replace(/^triplej_/, 'triple j ')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

export interface Shape {
  /** Label in the shape select. */
  name: string;
  /** Short name for cards and summaries. */
  short: string;
  /** Segments [from, to, share]: climb from→to, then drop into the next segment. */
  segs: [number, number, number][];
}

/** Artifact SHAPES (energy curves are the reference for every shape preset). */
export const SHAPES: Record<string, Shape> = {
  journey: { name: 'Journey, two peaks', short: 'Journey two peaks', segs: [[4, 8, 0.38], [5, 9, 0.47], [7, 7, 0.15]] },
  peak: { name: 'Peak time, three waves', short: 'Peak time three waves', segs: [[6, 8, 0.3], [6, 9, 0.35], [6, 9, 0.35]] },
  warmup: { name: 'Warm-up opener', short: 'Warm-up opener', segs: [[3, 6, 1]] },
  closing: { name: 'Closing, last peak then wind down', short: 'Closing', segs: [[7, 9, 0.35], [6, 7, 0.3], [4, 4, 0.35]] },
  groove: { name: 'Steady groove', short: 'Steady groove', segs: [[5, 7, 1]] },
};
export type ShapeKey = keyof typeof SHAPES;

export type PoolKey = 'active' | 'high' | 'all' | 'crate';
export const POOLS: { id: PoolKey; label: string }[] = [
  { id: 'active', label: 'High and Standard rotation' },
  { id: 'high', label: 'High rotation only' },
  { id: 'all', label: 'Everything, including the Vault' },
  { id: 'crate', label: 'Filtered crate' },
];

/** Default genre mix in percent (the artifact's 4 : 3 : 3 weights). */
export const DEFAULT_MIX: Record<string, number> = { House: 40, Techno: 30, UKG: 30 };
export const MIN_MINUTES = 20;
export const MAX_MINUTES = 360;

/* ------------------------------------------------------------------ crate filters */

export interface CrateFilters {
  q: string;
  pillar: string[];
  tier: Tier[];
  rot: number[];
  src: string;
  tags: string[];
  /** Has key and BPM */
  key: boolean;
  /** Needs an energy check */
  rev: boolean;
  /** Played on 2+ shows */
  multi: boolean;
}

/** Artifact default: High and Standard rotation, nothing else. */
export const DEFAULT_FILTERS: CrateFilters = { q: '', pillar: [], tier: [], rot: [1, 2], src: '', tags: [], key: false, rev: false, multi: false };

export type FilterGroup = 'q' | 'pillar' | 'tier' | 'rot' | 'src' | 'tags' | 'key' | 'rev' | 'multi';

/** Does a track pass every filter except `skip` (used for per-chip counts)? */
export function matchesFilters(t: LibraryTrack, F: CrateFilters, skip?: FilterGroup): boolean {
  const q = F.q.trim().toLowerCase();
  if (skip !== 'q' && q && !`${t.a} ${t.t} ${t.m || ''} ${t.lbl || ''}`.toLowerCase().includes(q)) return false;
  if (skip !== 'pillar' && F.pillar.length && !F.pillar.includes(t.p ?? '')) return false;
  if (skip !== 'tier' && F.tier.length) { const tr = tierOf(t.e); if (!tr || !F.tier.includes(tr)) return false; }
  if (skip !== 'rot' && F.rot.length && !F.rot.includes(t.rot ?? -1)) return false;
  if (skip !== 'src' && F.src && !t.src.includes(F.src)) return false;
  if (skip !== 'tags' && F.tags.length && !F.tags.every((x) => t.tags.includes(x))) return false;
  if (skip !== 'key' && F.key && !(t.k && t.bpm)) return false;
  if (skip !== 'rev' && F.rev && !t.rev) return false;
  if (skip !== 'multi' && F.multi && t.src.length < 2) return false;
  return true;
}

export const filterTracks = (tracks: LibraryTrack[], F: CrateFilters) => tracks.filter((t) => matchesFilters(t, F));

/** Number of filters that differ from the default (search text excluded). */
export function activeFilterCount(F: CrateFilters): number {
  const D = DEFAULT_FILTERS;
  const sameSet = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x) => b.includes(x));
  let n = F.pillar.length + F.tier.length + F.tags.length;
  if (!sameSet(F.rot, D.rot)) n += 1;
  if (F.src) n += 1;
  if (F.key) n += 1;
  if (F.rev) n += 1;
  if (F.multi) n += 1;
  return n;
}

/** Coerce anything read from storage or a URL into valid filters. */
export function sanitiseFilters(raw: unknown): CrateFilters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    q: typeof r.q === 'string' ? r.q : '',
    pillar: strs(r.pillar),
    tier: strs(r.tier).filter((x): x is Tier => (TIERS as string[]).includes(x)),
    rot: Array.isArray(r.rot) ? r.rot.map(Number).filter((x) => x === 1 || x === 2 || x === 3) : [...DEFAULT_FILTERS.rot],
    src: typeof r.src === 'string' ? r.src : '',
    tags: strs(r.tags),
    key: r.key === true,
    rev: r.rev === true,
    multi: r.multi === true,
  };
}

/** Filters as URL query parameters (a shared URL wins over stored filters). */
export function filtersToParams(F: CrateFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (F.q) p.set('q', F.q);
  if (F.pillar.length) p.set('pillar', F.pillar.join(','));
  if (F.tier.length) p.set('tier', F.tier.join(','));
  if (F.rot.join(',') !== DEFAULT_FILTERS.rot.join(',')) p.set('rot', F.rot.length ? F.rot.join(',') : 'any');
  if (F.src) p.set('src', F.src);
  if (F.tags.length) p.set('tags', F.tags.join(','));
  const checks = [F.key && 'key', F.rev && 'energy', F.multi && 'shows'].filter(Boolean);
  if (checks.length) p.set('checks', checks.join(','));
  return p;
}

const FILTER_PARAMS = ['q', 'pillar', 'tier', 'rot', 'src', 'tags', 'checks'];
export const hasFilterParams = (p: URLSearchParams) => FILTER_PARAMS.some((k) => p.has(k));

export function filtersFromParams(p: URLSearchParams): CrateFilters {
  const list = (k: string) => (p.get(k) ? p.get(k)!.split(',').filter(Boolean) : []);
  const checks = list('checks');
  const rot = p.get('rot');
  return sanitiseFilters({
    q: p.get('q') ?? '',
    pillar: list('pillar'),
    tier: list('tier'),
    rot: rot == null ? DEFAULT_FILTERS.rot : rot === 'any' ? [] : rot.split(',').map(Number),
    src: p.get('src') ?? '',
    tags: list('tags'),
    key: checks.includes('key'),
    rev: checks.includes('energy'),
    multi: checks.includes('shows'),
  });
}

/* ------------------------------------------------------------------ sorting */

export type SortKey = 'e' | 'track' | 'bpm' | 'k' | 'p' | 'rot' | 'src' | 'last';
export type SortDir = 'ascending' | 'descending';

/** Camelot order: 1A, 1B, 2A … 12B; unknown keys last. */
export function keyOrder(k: string | null | undefined): number {
  if (!k) return 999;
  const n = parseInt(k, 10);
  return Number.isNaN(n) ? 999 : n * 2 + (k.endsWith('B') ? 1 : 0);
}

function sortValue(t: LibraryTrack, k: SortKey): number | string | null {
  switch (k) {
    case 'e': return t.e;
    case 'track': return `${t.a} ${t.t}`.toLowerCase();
    case 'bpm': return t.bpm;
    case 'k': return t.k ? keyOrder(t.k) : null;
    case 'p': return pillarLabel(t.p)?.toLowerCase() ?? null;
    case 'rot': return t.rot;
    case 'src': return t.src.length;
    case 'last': return t.last;
  }
}

/** One sort at a time; missing values always sort last; ties by artist, then title (DataTable). */
export function sortTracks(rows: LibraryTrack[], key: SortKey, dir: SortDir): LibraryTrack[] {
  const m = dir === 'ascending' ? 1 : -1;
  return rows.slice().sort((x, y) => {
    const a = sortValue(x, key), b = sortValue(y, key);
    if (a == null && b != null) return 1;
    if (b == null && a != null) return -1;
    if (a != null && b != null && a !== b) return (a < b ? -1 : 1) * m;
    return x.a.localeCompare(y.a, 'en-AU') || x.t.localeCompare(y.t, 'en-AU');
  });
}

/* ------------------------------------------------------------------ Camelot moves (artifact keyMove) */

export interface KeyMove { label: string; score: number; boost?: boolean }

const cam = (k: string | null | undefined) => {
  if (!k) return null;
  const n = parseInt(k, 10);
  return Number.isNaN(n) ? null : { n, l: k.slice(-1).toUpperCase() };
};

/** The artifact's scoring of a key move. Display verdicts come from SN.compat. */
export function keyMove(a: string | null | undefined, b: string | null | undefined): KeyMove {
  const x = cam(a), y = cam(b);
  if (!x || !y) return { label: 'key ?', score: 0.3 };
  const d = (((y.n - x.n) % 12) + 12) % 12;
  if (x.l === y.l) {
    if (d === 0) return { label: 'same key', score: 3 };
    if (d === 1 || d === 11) return { label: d === 1 ? '+1 key' : '−1 key', score: 2.6 };
    if (d === 2) return { label: '+2 energy boost', score: 2.0, boost: true };
    if (d === 7) return { label: '+7 lift', score: 1.4, boost: true };
    return { label: 'key clash', score: -2 };
  }
  if (d === 0) return { label: 'relative A↔B', score: 2.6 };
  return { label: 'key clash', score: -2 };
}

/* ------------------------------------------------------------------ shapes and the draft */

/** Guide rules: climb +1 at a time with each level held evenly; drops between segments are 2–3 points at once. */
export function shapeTargets(n: number, segs: Shape['segs']): number[] {
  const tot = segs.reduce((a, s) => a + s[2], 0);
  const sizes = segs.map((s) => Math.max(1, Math.round((n * s[2]) / tot)));
  while (sizes.reduce((a, b) => a + b, 0) > n) { const i = sizes.indexOf(Math.max(...sizes)); sizes[i]--; }
  while (sizes.reduce((a, b) => a + b, 0) < n) { const i = sizes.indexOf(Math.max(...sizes)); sizes[i]++; }
  const out: number[] = [];
  segs.forEach(([a, b], si) => {
    const m = sizes[si], lv = b - a + 1;
    for (let j = 0; j < m; j++) out.push(a + Math.min(lv - 1, Math.floor((j * lv) / m)));
  });
  return out.slice(0, n);
}

export interface Slot { id: string | null; lock: boolean; tgt: number }

export interface Draft {
  id: string | null;
  name: string;
  shape: string;
  minutes: number;
  /** Genre mix in percent, keyed by pillar id (House, Techno, UKG). */
  mix: Record<string, number>;
  pool: PoolKey;
  tidal: boolean;
  slots: Slot[];
  seed: number;
  /** Library filters that define the pool when pool is "crate". */
  crate?: CrateFilters | null;
}

export function blankDraft(): Draft {
  return { id: null, name: 'New set', shape: 'journey', minutes: 90, mix: { ...DEFAULT_MIX }, pool: 'active', tidal: false, slots: [], seed: 1, crate: null };
}

export const shapeOf = (key: string): Shape => SHAPES[key] ?? SHAPES.journey;

/** Time a track is actually heard in a mix (artifact playSecs). */
export const playSecs = (t: Pick<LibraryTrack, 'd'> | null | undefined) => Math.max(150, Math.min(300, ((t?.d || 360) as number) * 0.6));
/** Slots for a length: one per 3:36 of set time, at least 6 (artifact slotCount). */
export const slotCount = (minutes: number) => Math.max(6, Math.round((minutes * 60) / 216));

/** Tracks the builder may pick from: rotation pool (or the filtered crate), pillars with a mix share above 0. */
export function poolTracks(tracks: LibraryTrack[], d: Pick<Draft, 'pool' | 'mix' | 'crate'>): LibraryTrack[] {
  const ok = d.pool === 'high' ? [1] : d.pool === 'all' ? [1, 2, 3] : [1, 2];
  const base = d.pool === 'crate' && d.crate ? filterTracks(tracks, d.crate) : tracks.filter((t) => ok.includes(t.rot ?? -1));
  return base.filter((t) => (d.mix[t.p ?? ''] ?? 1) > 0);
}

/** Deterministic LCG (artifact rng). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Artifact score: closeness to target, key move, BPM gap, genre continuity, mix share, rotation, sources, tags. */
export function score(
  t: LibraryTrack, target: number, prev: LibraryTrack | null, counts: Record<string, number>, total: number,
  wantUp: boolean, rand: () => number, mix: Record<string, number>, run = 3,
): number {
  let s = -3 * Math.abs((t.e ?? 0) - target);
  if (prev) {
    const km = keyMove(prev.k, t.k);
    s += km.boost ? (wantUp ? km.score + 0.6 : km.score - 1) : km.score;
    if (t.bpm && prev.bpm) { const d = Math.abs(t.bpm - prev.bpm); s += d <= 2 ? 2 : d <= 4 ? 1 : d <= 8 ? 0 : -2; } else s += 0.3;
    // switch genres in the Building tier, after a run of 3+
    if (t.p !== prev.p) s += (target >= 5 && target <= 7 ? 0 : -2) + (run < 3 ? -1.5 : 0);
    else s += 1.5;
  }
  const wsum = (mix.House || 0) + (mix.Techno || 0) + (mix.UKG || 0) || 1;
  const share = (mix[t.p ?? ''] || 0) / wsum;
  s -= Math.max(0, (counts[t.p ?? ''] || 0) - share * total) * 0.6;
  s += t.rot === 1 ? 1.5 : t.rot === 2 ? 0.5 : 0;
  s += Math.min(t.src.length, 4) * 0.3;
  if (target >= 8 && t.tags.includes('Crowdpleaser')) s += 1;
  if (target <= 5 && t.tags.includes('Dub')) s += 0.5;
  return s + rand() * 0.8;
}

export const byIdOf = (tracks: LibraryTrack[]) => new Map(tracks.map((t) => [t.id, t]));

/** Build the running order around locked slots (artifact build). */
export function buildSlots(tracks: LibraryTrack[], d: Draft, keepLocked = true, byId = byIdOf(tracks)): Slot[] {
  const n = slotCount(d.minutes), targets = shapeTargets(n, shapeOf(d.shape).segs);
  const slots: Slot[] = [];
  const locked = new Map<number, string>();
  if (keepLocked) d.slots.forEach((s, i) => { if (s.lock && s.id && i < n) locked.set(i, s.id); });
  const used = new Set(locked.values()), counts: Record<string, number> = {}, P = poolTracks(tracks, d), rand = rng(d.seed);
  for (let i = 0; i < n; i++) {
    const tgt = targets[i];
    if (locked.has(i)) {
      const t = byId.get(locked.get(i)!);
      slots.push({ id: t?.id || null, lock: true, tgt });
      if (t) counts[t.p ?? ''] = (counts[t.p ?? ''] || 0) + 1;
      continue;
    }
    const prev = slots.length ? byId.get(slots[slots.length - 1].id ?? '') ?? null : null;
    const wantUp = i > 0 && tgt > targets[i - 1];
    let run = 0;
    for (let j = slots.length - 1; j >= 0 && prev && byId.get(slots[j].id ?? '')?.p === prev.p; j--) run++;
    let best: LibraryTrack | null = null, bs = -1e9;
    for (const t of P) {
      if (used.has(t.id)) continue;
      const s = score(t, tgt, prev, counts, i + 1, wantUp, rand, d.mix, run);
      if (s > bs) { bs = s; best = t; }
    }
    if (best) { used.add(best.id); counts[best.p ?? ''] = (counts[best.p ?? ''] || 0) + 1; }
    slots.push({ id: best?.id || null, lock: false, tgt });
  }
  return slots;
}

/** Re-fit slot targets to the shape after a shape change or a removal (artifact retarget). */
export function retarget(slots: Slot[], shape: string): Slot[] {
  const tg = shapeTargets(Math.max(slots.length, 1), shapeOf(shape).segs);
  return slots.map((s, i) => ({ ...s, tgt: tg[i] }));
}

/** Three spares for a slot: same energy ±1, scored against the previous slot, other pillars nudged up (artifact spares). */
export function spares(tracks: LibraryTrack[], d: Draft, i: number, byId = byIdOf(tracks)): LibraryTrack[] {
  const s = d.slots[i];
  if (!s) return [];
  const cur = byId.get(s.id ?? '') ?? null, prev = i ? byId.get(d.slots[i - 1].id ?? '') ?? null : null;
  const used = new Set(d.slots.map((x) => x.id)), counts = {}, rand = () => 0;
  const target = cur?.e ?? s.tgt;
  return poolTracks(tracks, d)
    .filter((t) => !used.has(t.id) && Math.abs((t.e ?? 0) - target) <= 1)
    .map((t) => [t, score(t, target, prev, counts, 1, false, rand, d.mix) + (cur && t.p !== cur.p ? 0.4 : 0)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((x) => x[0]);
}

export type AddResult = 'exists' | 'filled' | 'appended';
/** Add a track from the crate: fill the first empty slot, or append a locked slot (artifact addToSet). */
export function addTrack(d: Draft, t: LibraryTrack): { draft: Draft; result: AddResult } {
  if (d.slots.some((s) => s.id === t.id)) return { draft: d, result: 'exists' };
  const empty = d.slots.findIndex((s) => !s.id);
  const slots = d.slots.map((s) => ({ ...s }));
  if (empty >= 0) { slots[empty].id = t.id; return { draft: { ...d, slots }, result: 'filled' }; }
  slots.push({ id: t.id, lock: true, tgt: t.e || 5 });
  return { draft: { ...d, slots }, result: 'appended' };
}

/** Swap two neighbours' tracks and locks; targets stay with the position (artifact up/down). */
export function moveSlot(slots: Slot[], i: number, dir: -1 | 1): Slot[] {
  const j = i + dir;
  if (j < 0 || j >= slots.length) return slots;
  const S = slots.map((s) => ({ ...s }));
  [S[i].id, S[j].id] = [S[j].id, S[i].id];
  [S[i].lock, S[j].lock] = [S[j].lock, S[i].lock];
  return S;
}

export function removeSlot(d: Draft, i: number): Slot[] {
  const S = d.slots.filter((_, k) => k !== i);
  return retarget(S, d.shape);
}

/* ------------------------------------------------------------------ set analysis */

/** Peaks: a local high of 8+ (artifact countPeaks). */
export function countPeaks(es: number[]): number {
  let n = 0;
  for (let i = 1; i < es.length - 1; i++) if (es[i] >= 8 && es[i] >= es[i - 1] && es[i] > es[i + 1]) n++;
  if (es.length > 1 && es[es.length - 1] >= 8 && es[es.length - 1] > es[es.length - 2]) n++;
  return n;
}

/**
 * Slot indexes whose arriving transition breaks the wave: energy +2 or more (too steep), or a
 * second −1 in a row (artifact renderSet issues). Index i means the move from slot i−1 to slot i.
 */
export function waveIssues(es: (number | null)[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < es.length; i++) {
    const p = es[i - 1], t = es[i];
    if (p == null || t == null) continue;
    const dE = t - p;
    if (dE >= 2) out.push(i);
    else if (dE === -1) { const pp = es[i - 2]; if (pp != null && p - pp === -1) out.push(i); }
  }
  return out;
}

/** Genre switch judgement: in the Building tier after a run of 3+ is the move the rules want. */
export function genreRunBefore(slots: (LibraryTrack | null)[], i: number): number {
  const prev = slots[i - 1];
  if (!prev) return 0;
  let run = 0;
  for (let j = i - 1; j >= 0 && slots[j]?.p === prev.p; j--) run++;
  return run;
}

/** Seconds of mixed time for the filled slots. */
export const mixedSecs = (ts: (Pick<LibraryTrack, 'd'> | null | undefined)[]) => ts.reduce((a, t) => a + (t ? playSecs(t) : 0), 0);

/* ------------------------------------------------------------------ genre mix */

/** Scale weights to whole percentages that add up to 100 (largest remainder). Zeros stay zero. */
export function normaliseMix(mix: Record<string, number> | null | undefined): Record<string, number> {
  const src = { ...DEFAULT_MIX, ...(mix || {}) };
  const keys = PILLARS.map((p) => p.id);
  const vals = keys.map((k) => Math.max(0, Number(src[k]) || 0));
  const sum = vals.reduce((a, b) => a + b, 0);
  if (!sum) return Object.fromEntries(keys.map((k) => [k, 0]));
  const raw = vals.map((v) => (v * 100) / sum), fl = raw.map(Math.floor);
  let left = 100 - fl.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - fl[i], i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { fl[i]++; left--; } });
  return Object.fromEntries(keys.map((k, i) => [k, fl[i]]));
}

export const mixTotal = (mix: Record<string, number>) => PILLARS.reduce((a, p) => a + (Number(mix[p.id]) || 0), 0);

/* ------------------------------------------------------------------ saved sets */

export function newSetId(now = Date.now()): string { return 'set-' + now.toString(36); }

/** The artifact's saved-set document, with `move` labels from the artifact's key scoring. */
export function savedSetFromDraft(d: Draft, byId: Map<string, LibraryTrack>, existing: SavedSet[], now = new Date()): SavedSet {
  const filled = d.slots.filter((s) => s.id);
  const tracks: SavedSetTrack[] = filled.map((s, i) => {
    const t = byId.get(s.id!), p = i ? byId.get(filled[i - 1].id!) : null;
    return { id: s.id!, tgt: s.tgt, a: t?.a, t: t?.t, m: t?.m, e: t?.e, k: t?.k, bpm: t?.bpm, tidal: t?.tidal || null, move: p && t ? keyMove(p.k, t.k).label : null };
  });
  const iso = now.toISOString();
  const id = d.id || newSetId(now.getTime());
  return {
    id, name: d.name.trim() || 'Untitled set', shape: d.shape, minutes: d.minutes, mix: { ...d.mix }, pool: d.pool,
    tidal: !!d.tidal, seed: d.seed || 1, tracks, updated: iso, created: existing.find((x) => x.id === id)?.created || iso,
  };
}

/** Open a saved set as the draft: every slot locked (artifact open). */
export function draftFromSaved(s: SavedSet, byId: Map<string, LibraryTrack>): Draft {
  return {
    id: s.id, name: s.name, shape: s.shape in SHAPES ? s.shape : 'journey', minutes: s.minutes || 90,
    mix: normaliseMix(s.mix), pool: (POOLS.some((p) => p.id === s.pool) ? s.pool : 'active') as PoolKey,
    tidal: !!s.tidal, seed: s.seed || 1, crate: null,
    slots: (s.tracks || []).map((t) => ({ id: t.id, lock: true, tgt: t.tgt ?? byId.get(t.id)?.e ?? 5 })),
  };
}

/** Coerce a stored draft (shape may be from an older version). */
export function sanitiseDraft(raw: unknown): Draft {
  const b = blankDraft();
  if (!raw || typeof raw !== 'object') return b;
  const r = raw as Partial<Draft>;
  return {
    id: typeof r.id === 'string' ? r.id : null,
    name: typeof r.name === 'string' ? r.name : b.name,
    shape: typeof r.shape === 'string' && r.shape in SHAPES ? r.shape : b.shape,
    minutes: Number.isFinite(r.minutes) ? Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Number(r.minutes))) : b.minutes,
    mix: r.mix && typeof r.mix === 'object' ? { ...DEFAULT_MIX, ...r.mix } : b.mix,
    pool: POOLS.some((p) => p.id === r.pool) ? (r.pool as PoolKey) : b.pool,
    tidal: !!r.tidal,
    seed: Number.isFinite(r.seed) ? Number(r.seed) : 1,
    slots: Array.isArray(r.slots) ? r.slots.filter((s) => s && typeof s === 'object').map((s) => ({ id: typeof s.id === 'string' ? s.id : null, lock: !!s.lock, tgt: Number(s.tgt) || 5 })) : [],
    crate: r.crate ? sanitiseFilters(r.crate) : null,
  };
}

/** Plain-text tracklist, "1. Artist – Title (Mix)" lines with energy, BPM and key where known. */
export function tracklistText(d: Draft, byId: Map<string, LibraryTrack>): string {
  const head = `${d.name || 'Untitled set'} · ${shapeOf(d.shape).name} · ${d.minutes} min`;
  const lines = d.slots.map((s, i) => {
    const n = String(i + 1).padStart(2, ' ');
    const t = byId.get(s.id ?? '');
    if (!t) return `${n}. –`;
    const data = [t.e != null ? `energy ${t.e}` : null, t.bpm ? `${t.bpm} BPM` : null, t.k || null].filter(Boolean).join(' · ');
    return `${n}. ${t.a} – ${t.t}${t.m ? ` (${t.m})` : ''}${data ? `  [${data}]` : ''}`;
  });
  return [head, '', ...lines].join('\n');
}
