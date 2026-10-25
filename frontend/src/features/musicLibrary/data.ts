/**
 * Music library data contract (Naarm Set Builder, ported from E:\musicLibrary\artifact).
 *
 * public/data/music-library.json is a copy of musicLibrary/outputs/artifact/library.json,
 * written by the weekly run (`python3 pipeline/run_weekly.py db`) and copied in with
 * scripts/sync-music-library.sh. Field names are the pipeline's compact keys; do not
 * rename them here, map them at the edge.
 */

export interface LibraryTrack {
  id: string;
  /** Artist */
  a: string;
  /** Title */
  t: string;
  /** Mix name, e.g. "Original Mix" */
  m: string | null;
  /** Duration in seconds */
  d: number | null;
  bpm: number | null;
  /** Key as given by the source (Camelot or musical); normalise with SN.camelot */
  k: string | null;
  /** Energy 1–10 (Mixed In Key scale) */
  e: number | null;
  /** Pillar: House, Techno, UK garage, … */
  p: string | null;
  /** Rotation: 1 High, 2 Standard, 3 Vault/Archive (pipeline lifecycle) */
  rot: number | null;
  tags: string[];
  /** Source ids where the track was heard (see LibraryFile.sources) */
  src: string[];
  /** First and last heard, ISO dates */
  first: string | null;
  last: string | null;
  /** Genre */
  g: string | null;
  /** Label */
  lbl: string | null;
  sync: string | null;
  tidal: string | null;
  dz: string | null;
  bp: string | null;
  /** ARIA Club Chart position from the latest run: rank, weeks in, peak. */
  chart: { rank: number; weeks: number; peak?: number } | null;
  /** Needs review (energy check) */
  rev: boolean;
  /** Hand override applied */
  ovr: boolean;
  /** Has a local file */
  local: boolean;

  /** MusicBrainz provenance */
  mbid?: string;
  mbconf?: string;
  mbdump?: string;
  source_url?: string;
}

export interface LibrarySource { id: string; prior: number; club: boolean; on: boolean }
export interface LibraryRun { date: string; added: number; rejected: number; promoted: number; demoted: number; archived: number; review_queue: number }

export interface LibraryFile {
  generated: string;
  ledger_updated: string;
  counts: { tracks: number; pending: number; rejected: number; beatport_check: number };
  sources: LibrarySource[];
  runs: LibraryRun[];
  tracks: LibraryTrack[];
}

let cache: Promise<LibraryFile> | null = null;

export function loadLibrary(): Promise<LibraryFile> {
  if (!cache) {
    cache = (async () => {
      try {
        const res = await fetch('/api/v1/library/search?limit=5000');
        if (res.ok) {
          const tracks = await res.json() as LibraryTrack[];
          return {
            generated: new Date().toISOString(),
            ledger_updated: new Date().toISOString(),
            counts: { tracks: tracks.length, pending: 0, rejected: 0, beatport_check: 0 },
            sources: [],
            runs: [],
            tracks
          };
        }
      } catch (e) {
        console.warn('API library search error, falling back to static JSON', e);
      }

      const r = await fetch('/data/music-library.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(`Library file returned ${r.status}`);
      return r.json() as Promise<LibraryFile>;
    })().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}

export const SAVED_SETS_KEY = 'sn-music-library-sets';

export interface SavedSetTrack {
  id: string;
  tgt: number;
  a?: string; t?: string; m?: string | null; e?: number | null; k?: string | null; bpm?: number | null;
  tidal?: string | null;
  move?: string | null;
}

export interface SavedSet {
  id: string;
  name: string;
  shape: string;
  minutes: number;
  mix: Record<string, number>;
  pool: string;
  tidal: boolean;
  seed: number;
  tracks: SavedSetTrack[];
  updated: string;
  created: string;
}

export async function readSavedSetsAsync(): Promise<SavedSet[]> {
  try {
    const res = await fetch('/api/v1/library/sets');
    if (res.ok) {
      return await res.json() as SavedSet[];
    }
  } catch (e) {
    console.warn('API sets read failed, falling back to local storage', e);
  }
  return readSavedSets();
}

export async function writeSavedSetsAsync(sets: SavedSet[]): Promise<void> {
  try {
    const res = await fetch('/api/v1/library/sets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sets),
    });
  } catch (e) {
    console.warn('API sets write failed, falling back to local storage', e);
  }
  writeSavedSets(sets);
}

export function readSavedSets(): SavedSet[] {
  try {
    const raw = localStorage.getItem(SAVED_SETS_KEY);
    return raw ? (JSON.parse(raw) as SavedSet[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedSets(sets: SavedSet[]): void {
  try { localStorage.setItem(SAVED_SETS_KEY, JSON.stringify(sets)); } catch { /* storage blocked: sets stay in memory */ }
}
